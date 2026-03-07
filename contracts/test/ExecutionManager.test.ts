import { expect } from "chai";
import { ethers } from "hardhat";
import { ExecutionManager, IntentVault, AgentRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { setupTest } from "./setup";
describe("ExecutionManager", function () {
  let executionManager: ExecutionManager;
  let intentVault: IntentVault;
  let agentRegistry: AgentRegistry;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let agent1: SignerWithAddress;
  // Impersonated signer for IntentVault — needed for onlyIntentVault calls
  let vaultSigner: any;

  beforeEach(async function () {
    const setup = await setupTest();
    deployer = setup.deployer;
    user1 = setup.user1;
    agent1 = setup.agent1;

    // Deploy AgentRegistry
    const AgentRegistryFactory = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistryFactory.deploy();
    await agentRegistry.waitForDeployment();

    // Deploy ExecutionManager with temporary address
    const ExecutionManagerFactory = await ethers.getContractFactory("ExecutionManager");
    executionManager = await ExecutionManagerFactory.deploy(ethers.ZeroAddress);
    await executionManager.waitForDeployment();

    // Deploy IntentVault
    const IntentVaultFactory = await ethers.getContractFactory("IntentVault");
    intentVault = await IntentVaultFactory.deploy(
      await agentRegistry.getAddress(),
      await executionManager.getAddress()
    );
    await intentVault.waitForDeployment();

    // Deploy ExecutionManager with correct IntentVault address
    const ExecutionManagerFactory2 = await ethers.getContractFactory("ExecutionManager");
    executionManager = await ExecutionManagerFactory2.deploy(await intentVault.getAddress());
    await executionManager.waitForDeployment();

    // Update IntentVault with correct ExecutionManager address
    await intentVault.updateExecutionManager(await executionManager.getAddress());

    // Set up impersonated IntentVault signer for onlyIntentVault functions
    const vaultAddr = await intentVault.getAddress();
    await ethers.provider.send("hardhat_setBalance", [vaultAddr, "0x" + ethers.parseEther("100").toString(16)]);
    vaultSigner = await ethers.getImpersonatedSigner(vaultAddr);
  });

  describe("Deployment", function () {
    it("should set correct IntentVault address", async function () {
      expect(await executionManager.intentVault()).to.equal(await intentVault.getAddress());
    });

    it("should set correct XCM precompile address", async function () {
      // Use ethers.getAddress to normalize checksum before comparison
      expect(await executionManager.XCM_PRECOMPILE()).to.equal(
        ethers.getAddress("0x0000000000000000000000000000000000000a00")
      );
    });
  });

  describe("Execution Plan Processing", function () {
    let intentId: number;
    let executionSteps: any[];

    beforeEach(async function () {
      intentId = 1;

      // 6-field tuple: [actionType, destinationParaId, targetContract, callData, amount, minAmountOut]
      executionSteps = [
        [0, 0, await agentRegistry.getAddress(), agentRegistry.interface.encodeFunctionData("MIN_STAKE"), 0n, 0n],  // local step
        [1, 2034, user1.address, "0x5678", ethers.parseEther("0.5"), 0n]     // XCM step
      ];
    });

    it("should execute plan with local and XCM steps", async function () {
      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [executionSteps]
      );

      const tx = await executionManager.connect(vaultSigner).execute(intentId, planData, {
        value: ethers.parseEther("1")
      });

      await expect(tx)
        .to.emit(executionManager, "ExecutionStarted")
        .withArgs(intentId, executionSteps.length);

      const execution = await executionManager.getExecution(intentId);
      expect(execution.intentId).to.equal(intentId);
      expect(execution.totalSteps).to.equal(executionSteps.length);
      expect(execution.status).to.equal(1); // AWAITING_CONFIRMATION
    });

    it("should handle empty execution plan", async function () {
      const emptySteps: any[] = [];
      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [emptySteps]
      );

      const tx = await executionManager.connect(vaultSigner).execute(intentId, planData);

      await expect(tx)
        .to.emit(executionManager, "ExecutionStarted")
        .withArgs(intentId, 0);

      const execution = await executionManager.getExecution(intentId);
      expect(execution.totalSteps).to.equal(0);
      expect(execution.status).to.equal(1); // AWAITING_CONFIRMATION (no steps to fail)
    });

    it("should only allow IntentVault to call execute", async function () {
      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [executionSteps]
      );

      await expect(
        executionManager.connect(user1).execute(intentId, planData)
      ).to.be.revertedWithCustomError(executionManager, "OnlyIntentVault");
    });

    it("should handle execution failure gracefully", async function () {
      // Create a step that will fail (calling non-existent function on a valid address)
      const failingSteps = [
        [0, 0, await agentRegistry.getAddress(), "0xdeadbeef", 0n, 0n] // Invalid function selector
      ];

      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [failingSteps]
      );

      const tx = await executionManager.connect(vaultSigner).execute(intentId, planData);

      await expect(tx)
        .to.emit(executionManager, "ExecutionFailed")
        .withArgs(intentId, "Unexpected execution error");

      const execution = await executionManager.getExecution(intentId);
      expect(execution.status).to.equal(3); // FAILED
    });
  });

  describe("XCM Message Building", function () {
    it("should build XCM transfer message for Hydration", async function () {
      const paraId = 2034;
      const beneficiary = ethers.zeroPadValue(user1.address, 32);
      const amount = ethers.parseEther("1");

      const xcmMessage = await executionManager.buildTransferXCM(paraId, beneficiary, amount);

      expect(xcmMessage).to.not.equal("0x");
      expect(xcmMessage.length).to.be.greaterThan(2); // More than just "0x"
    });

    it("should build XCM transfer message for Bifrost", async function () {
      const paraId = 2030;
      const beneficiary = ethers.zeroPadValue(user1.address, 32);
      const amount = ethers.parseEther("1");

      const xcmMessage = await executionManager.buildTransferXCM(paraId, beneficiary, amount);

      expect(xcmMessage).to.not.equal("0x");
      expect(xcmMessage.length).to.be.greaterThan(2);
    });

    it("should build XCM transfer message for Moonbeam", async function () {
      const paraId = 2004;
      const beneficiary = ethers.zeroPadValue(user1.address, 32);
      const amount = ethers.parseEther("1");

      const xcmMessage = await executionManager.buildTransferXCM(paraId, beneficiary, amount);

      expect(xcmMessage).to.not.equal("0x");
      expect(xcmMessage.length).to.be.greaterThan(2);
    });

    it("should revert for unsupported parachain", async function () {
      const unsupportedParaId = 9999;
      const beneficiary = ethers.zeroPadValue(user1.address, 32);
      const amount = ethers.parseEther("1");

      await expect(
        executionManager.buildTransferXCM(unsupportedParaId, beneficiary, amount)
      ).to.be.revertedWith("Unsupported parachain");
    });

    it("should handle zero amount transfers", async function () {
      const paraId = 2034;
      const beneficiary = ethers.zeroPadValue(user1.address, 32);
      const amount = 0;

      const xcmMessage = await executionManager.buildTransferXCM(paraId, beneficiary, amount);
      expect(xcmMessage).to.not.equal("0x");
    });

    it("should handle large amount transfers", async function () {
      const paraId = 2034;
      const beneficiary = ethers.zeroPadValue(user1.address, 32);
      const amount = ethers.parseEther("1000000");

      const xcmMessage = await executionManager.buildTransferXCM(paraId, beneficiary, amount);
      expect(xcmMessage).to.not.equal("0x");
    });
  });

  describe("Weight Estimation", function () {
    it("should estimate weight for XCM message", async function () {
      const xcmMessage = await executionManager.buildTransferXCM(
        2034,
        ethers.zeroPadValue(user1.address, 32),
        ethers.parseEther("1")
      );

      const weight = await executionManager.weighMessage(xcmMessage);

      expect(weight).to.be.greaterThan(0);
      expect(weight).to.be.lessThanOrEqual(ethers.MaxUint256); // Should be a valid uint64
    });

    it("should return fallback weight for invalid message", async function () {
      const invalidMessage = "0xdeadbeef";

      const weight = await executionManager.weighMessage(invalidMessage);

      // Should return fallback weight (1 billion)
      expect(weight).to.equal(1000000000);
    });

    it("should handle empty XCM message", async function () {
      const emptyMessage = "0x";

      const weight = await executionManager.weighMessage(emptyMessage);

      // Should return fallback weight
      expect(weight).to.equal(1000000000);
    });
  });

  describe("Execution Status Management", function () {
    let intentId: number;

    beforeEach(async function () {
      intentId = 1;

      const executionSteps = [
        [1, 2034, user1.address, "0x1234", ethers.parseEther("0.5"), 0n] // XCM step
      ];

      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [executionSteps]
      );

      await executionManager.connect(vaultSigner).execute(intentId, planData, {
        value: ethers.parseEther("1")
      });
    });

    it("should complete execution successfully", async function () {
      const tx = await executionManager.connect(vaultSigner).completeExecution(intentId);

      await expect(tx)
        .to.emit(executionManager, "ExecutionCompleted")
        .withArgs(intentId);

      const execution = await executionManager.getExecution(intentId);
      expect(execution.status).to.equal(2); // COMPLETED
    });

    it("should fail execution with reason", async function () {
      const reason = "XCM delivery failed";

      const tx = await executionManager.connect(vaultSigner).failExecution(intentId, reason);

      await expect(tx)
        .to.emit(executionManager, "ExecutionFailed")
        .withArgs(intentId, reason);

      const execution = await executionManager.getExecution(intentId);
      expect(execution.status).to.equal(3); // FAILED
    });

    it("should check if execution is in progress", async function () {
      expect(await executionManager.isExecutionInProgress(intentId)).to.be.true;

      await executionManager.connect(vaultSigner).completeExecution(intentId);
      expect(await executionManager.isExecutionInProgress(intentId)).to.be.false;
    });

    it("should not allow completion of already completed execution", async function () {
      await executionManager.connect(vaultSigner).completeExecution(intentId);

      await expect(
        executionManager.connect(vaultSigner).completeExecution(intentId)
      ).to.be.revertedWithCustomError(executionManager, "InvalidExecutionStatus");
    });

    it("should not allow failure of already completed execution", async function () {
      await executionManager.connect(vaultSigner).completeExecution(intentId);

      await expect(
        executionManager.connect(vaultSigner).failExecution(intentId, "test reason")
      ).to.be.revertedWithCustomError(executionManager, "InvalidExecutionStatus");
    });
  });

  describe("Access Control", function () {
    it("should only allow IntentVault to complete execution", async function () {
      const intentId = 1;

      await expect(
        executionManager.connect(user1).completeExecution(intentId)
      ).to.be.revertedWithCustomError(executionManager, "OnlyIntentVault");
    });

    it("should only allow IntentVault to fail execution", async function () {
      const intentId = 1;

      await expect(
        executionManager.connect(user1).failExecution(intentId, "test")
      ).to.be.revertedWithCustomError(executionManager, "OnlyIntentVault");
    });
  });

  describe("Error Handling", function () {
    it("should revert when getting non-existent execution", async function () {
      await expect(
        executionManager.getExecution(999)
      ).to.be.revertedWithCustomError(executionManager, "ExecutionNotFound");
    });

    it("should handle contract balance correctly", async function () {
      const initialBalance = await ethers.provider.getBalance(await executionManager.getAddress());

      const executionSteps = [
        [1, 2034, user1.address, "0x1234", ethers.parseEther("0.5"), 0n]
      ];

      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [executionSteps]
      );

      await executionManager.connect(vaultSigner).execute(1, planData, {
        value: ethers.parseEther("1")
      });

      const finalBalance = await ethers.provider.getBalance(await executionManager.getAddress());
      expect(finalBalance).to.be.greaterThan(initialBalance);
    });

    it("should receive ETH correctly", async function () {
      const amount = ethers.parseEther("1");

      await expect(
        user1.sendTransaction({
          to: await executionManager.getAddress(),
          value: amount
        })
      ).to.not.be.reverted;

      const balance = await ethers.provider.getBalance(await executionManager.getAddress());
      expect(balance).to.be.greaterThanOrEqual(amount);
    });
  });

  describe("Edge Cases", function () {
    it("should handle execution with only local steps", async function () {
      const localSteps = [
        [0, 0, await agentRegistry.getAddress(), agentRegistry.interface.encodeFunctionData("MIN_STAKE"), 0n, 0n]
      ];

      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [localSteps]
      );

      await expect(
        executionManager.connect(vaultSigner).execute(1, planData)
      ).to.not.be.reverted;
    });

    it("should handle execution with only XCM steps", async function () {
      const xcmSteps = [
        [1, 2034, user1.address, "0x1234", ethers.parseEther("0.5"), 0n],
        [1, 2030, user1.address, "0x5678", ethers.parseEther("0.3"), 0n]
      ];

      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [xcmSteps]
      );

      await expect(
        executionManager.connect(vaultSigner).execute(1, planData, {
          value: ethers.parseEther("1")
        })
      ).to.not.be.reverted;
    });

    it("should handle large execution plans", async function () {
      const manySteps = Array(10).fill(null).map((_, i) => [
        i % 2 === 0 ? 0 : 1,                           // actionType: 0=local, 1=XCM
        i % 2 === 0 ? 0 : 2034,                         // destinationParaId
        user1.address,
        `0x${i.toString(16).padStart(8, '0')}`,
        ethers.parseEther("0.1"),
        0n                                               // minAmountOut
      ]);

      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [manySteps]
      );

      await expect(
        executionManager.connect(vaultSigner).execute(1, planData, {
          value: ethers.parseEther("2")
        })
      ).to.not.be.reverted;
    });
  });

  describe("Gas Optimization", function () {
    it("should not exceed reasonable gas limits for execution", async function () {
      const executionSteps = [
        [1, 2034, user1.address, "0x1234", ethers.parseEther("0.5"), 0n]
      ];

      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [executionSteps]
      );

      const tx = await executionManager.connect(vaultSigner).execute(1, planData, {
        value: ethers.parseEther("1")
      });

      const receipt = await tx.wait();
      expect(receipt!.gasUsed).to.be.lessThan(500000); // Reasonable gas limit
    });

    it("should not exceed reasonable gas limits for XCM building", async function () {
      const result = await executionManager.buildTransferXCM(
        2034,
        ethers.zeroPadValue(user1.address, 32),
        ethers.parseEther("1")
      );

      // This is a view function, so we check it doesn't revert
      expect(result).to.not.equal("0x");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getCurrentStep
  // ─────────────────────────────────────────────────────────────────────────────
  describe("getCurrentStep", function () {
    it("reverts for a non-existent intent (intentId not yet executed)", async function () {
      await expect(executionManager.getCurrentStep(9999))
        .to.be.revertedWithCustomError(executionManager, "ExecutionNotFound");
    });

    it("returns 0 completedSteps right after execute() with empty plan", async function () {
      // Setup: create an intent and execute it through IntentVault
      const goalHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      const emptyPlan = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"], [[]]
      );

      // Register agent
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", {
        value: ethers.parseEther("10")
      });
      // Set agentRegistry's intentVault so recordSuccess can be called
      await agentRegistry.setIntentVault(await intentVault.getAddress());

      await intentVault.connect(user1).createIntent(
        goalHash, 500, deadline, 0, 86400, [],
        { value: ethers.parseEther("1") }
      );
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(agent1).executeIntent(1);

      // getCurrentStep should return 0 (empty plan, 0 steps completed)
      const step = await executionManager.getCurrentStep(1);
      expect(step).to.equal(0);
    });
  });
});
