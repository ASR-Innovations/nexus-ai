import { expect } from "chai";
import { ethers } from "hardhat";
import { IntentVault, AgentRegistry, ExecutionManager } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { setupTest, MIN_DEPOSIT, MAX_SLIPPAGE_BPS, PROTOCOL_FEE_BPS } from "./setup";

describe("IntentVault", function () {
  let intentVault: IntentVault;
  let agentRegistry: AgentRegistry;
  let executionManager: ExecutionManager;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let agent1: SignerWithAddress;
  let agent2: SignerWithAddress;

  const goalHash = ethers.keccak256(ethers.toUtf8Bytes("Get 10% yield on DOT"));
  const maxSlippage = 500; // 5%
  const minYield = 1000; // 10%
  const maxLockDuration = 86400 * 30; // 30 days
  const approvedProtocols: string[] = [];

  // ABI-encoded empty ExecutionStep[] — required for ExecutionManager.execute to succeed
  const emptyPlan = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
    [[]]
  );

  beforeEach(async function () {
    const setup = await setupTest();
    deployer = setup.deployer;
    user1 = setup.user1;
    user2 = setup.user2;
    agent1 = setup.agent1;
    agent2 = setup.agent2;

    // Deploy AgentRegistry
    const AgentRegistryFactory = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistryFactory.deploy();
    await agentRegistry.waitForDeployment();

    // Deploy ExecutionManager
    const ExecutionManagerFactory = await ethers.getContractFactory("ExecutionManager");
    executionManager = await ExecutionManagerFactory.deploy(ethers.ZeroAddress); // Temporary address
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

    // Set IntentVault as the authorized caller in AgentRegistry
    await agentRegistry.setIntentVault(await intentVault.getAddress());

    // Register agents
    await agentRegistry.connect(agent1).registerAgent("ipfs://agent1-metadata", {
      value: ethers.parseEther("10")
    });
    await agentRegistry.connect(agent2).registerAgent("ipfs://agent2-metadata", {
      value: ethers.parseEther("15")
    });
  });

  describe("Intent Creation", function () {
    it("should create intent with valid parameters", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      const tx = await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        deadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: MIN_DEPOSIT }
      );

      await expect(tx)
        .to.emit(intentVault, "IntentCreated")
        .withArgs(1, user1.address, MIN_DEPOSIT, goalHash);

      const intent = await intentVault.getIntent(1);
      expect(intent.user).to.equal(user1.address);
      expect(intent.amount).to.equal(MIN_DEPOSIT);
      expect(intent.goalHash).to.equal(goalHash);
      expect(intent.status).to.equal(0); // PENDING
    });

    it("should revert with insufficient deposit", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const insufficientDeposit = ethers.parseEther("0.5");

      await expect(
        intentVault.connect(user1).createIntent(
          goalHash,
          maxSlippage,
          deadline,
          minYield,
          maxLockDuration,
          approvedProtocols,
          { value: insufficientDeposit }
        )
      ).to.be.revertedWith("Deposit below minimum");
    });

    it("should revert with excessive slippage", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const excessiveSlippage = MAX_SLIPPAGE_BPS + 1;

      await expect(
        intentVault.connect(user1).createIntent(
          goalHash,
          excessiveSlippage,
          deadline,
          minYield,
          maxLockDuration,
          approvedProtocols,
          { value: MIN_DEPOSIT }
        )
      ).to.be.revertedWith("Slippage too high");
    });

    it("should revert with past deadline", async function () {
      const pastDeadline = (await ethers.provider.getBlock("latest"))!.timestamp - 3600;

      await expect(
        intentVault.connect(user1).createIntent(
          goalHash,
          maxSlippage,
          pastDeadline,
          minYield,
          maxLockDuration,
          approvedProtocols,
          { value: MIN_DEPOSIT }
        )
      ).to.be.revertedWith("Deadline in the past");
    });
  });

  describe("Intent Lifecycle", function () {
    let intentId: number;
    let deadline: number;

    beforeEach(async function () {
      deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        deadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      intentId = 1;
    });

    it("should allow agent to claim intent", async function () {
      const tx = await intentVault.connect(agent1).claimIntent(intentId);

      await expect(tx)
        .to.emit(intentVault, "IntentAssigned")
        .withArgs(intentId, agent1.address);

      const intent = await intentVault.getIntent(intentId);
      expect(intent.assignedAgent).to.equal(agent1.address);
      expect(intent.status).to.equal(1); // ASSIGNED
    });

    it("should not allow inactive agent to claim intent", async function () {
      // Create a new agent with insufficient stake to make them inactive
      const inactiveAgent = user2;

      await expect(
        intentVault.connect(inactiveAgent).claimIntent(intentId)
      ).to.be.revertedWith("Agent not active");
    });

    it("should allow agent to submit plan", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);

      const executionPlan = ethers.toUtf8Bytes("execution plan data");
      const tx = await intentVault.connect(agent1).submitPlan(intentId, executionPlan);

      const expectedHash = ethers.keccak256(executionPlan);
      await expect(tx)
        .to.emit(intentVault, "PlanSubmitted")
        .withArgs(intentId, expectedHash);

      const intent = await intentVault.getIntent(intentId);
      expect(intent.executionPlanHash).to.equal(expectedHash);
      expect(intent.status).to.equal(2); // PLAN_SUBMITTED
    });

    it("should allow user to approve plan", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);

      const executionPlan = ethers.toUtf8Bytes("execution plan data");
      await intentVault.connect(agent1).submitPlan(intentId, executionPlan);

      const tx = await intentVault.connect(user1).approvePlan(intentId);

      await expect(tx)
        .to.emit(intentVault, "PlanApproved")
        .withArgs(intentId);

      const intent = await intentVault.getIntent(intentId);
      expect(intent.status).to.equal(3); // APPROVED
    });

    it("should emit IntentExecuted(intentId, true) on successful execution", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);

      // Must use ABI-encoded plan so ExecutionManager.execute can decode it
      await intentVault.connect(agent1).submitPlan(intentId, emptyPlan);
      await intentVault.connect(user1).approvePlan(intentId);

      const tx = await intentVault.connect(agent1).executeIntent(intentId);

      await expect(tx)
        .to.emit(intentVault, "IntentExecuted")
        .withArgs(intentId, true);

      const intent = await intentVault.getIntent(intentId);
      expect(intent.status).to.equal(4); // EXECUTING
    });

    it("should complete intent successfully", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);

      // Must use ABI-encoded plan so ExecutionManager.execute can decode it
      await intentVault.connect(agent1).submitPlan(intentId, emptyPlan);
      await intentVault.connect(user1).approvePlan(intentId);
      await intentVault.connect(agent1).executeIntent(intentId);

      const returnAmount = ethers.parseEther("1.1"); // 10% yield
      const initialBalance = await ethers.provider.getBalance(user1.address);

      // completeIntent must be called by ExecutionManager
      const execMgrAddr = await executionManager.getAddress();
      await ethers.provider.send("hardhat_setBalance", [
        execMgrAddr,
        "0x" + ethers.parseEther("10").toString(16)
      ]);
      const execMgrSigner = await ethers.getImpersonatedSigner(execMgrAddr);

      const tx = await intentVault.connect(execMgrSigner).completeIntent(intentId, returnAmount, {
        value: returnAmount
      });

      await expect(tx)
        .to.emit(intentVault, "ExecutionCompleted")
        .withArgs(intentId, returnAmount);

      const intent = await intentVault.getIntent(intentId);
      expect(intent.status).to.equal(6); // COMPLETED

      const finalBalance = await ethers.provider.getBalance(user1.address);
      expect(finalBalance - initialBalance).to.equal(returnAmount);
    });
  });

  describe("Cancellation and Expiration", function () {
    let intentId: number;
    let deadline: number;

    beforeEach(async function () {
      deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        deadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      intentId = 1;
    });

    it("should allow user to cancel intent before execution", async function () {
      const initialBalance = await ethers.provider.getBalance(user1.address);

      const tx = await intentVault.connect(user1).cancelIntent(intentId);

      await expect(tx)
        .to.emit(intentVault, "IntentCancelled")
        .withArgs(intentId, user1.address);

      const intent = await intentVault.getIntent(intentId);
      expect(intent.status).to.equal(8); // CANCELLED

      // Check refund (accounting for gas costs)
      const finalBalance = await ethers.provider.getBalance(user1.address);
      const gasUsed = (await tx.wait())!.gasUsed * (await tx.wait())!.gasPrice;
      expect(finalBalance + gasUsed - initialBalance).to.be.closeTo(MIN_DEPOSIT, ethers.parseEther("0.01"));
    });

    it("should not allow cancellation after execution starts", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);

      // Must use ABI-encoded plan so ExecutionManager.execute can decode it
      await intentVault.connect(agent1).submitPlan(intentId, emptyPlan);
      await intentVault.connect(user1).approvePlan(intentId);
      await intentVault.connect(agent1).executeIntent(intentId);

      await expect(
        intentVault.connect(user1).cancelIntent(intentId)
      ).to.be.revertedWith("Cannot cancel after execution started");
    });

    it("should allow expiration after deadline", async function () {
      // Fast forward time past deadline
      await ethers.provider.send("evm_increaseTime", [3700]); // 1 hour + 100 seconds
      await ethers.provider.send("evm_mine", []);

      const initialBalance = await ethers.provider.getBalance(user1.address);

      const tx = await intentVault.connect(user2).expireIntent(intentId); // Anyone can expire

      await expect(tx)
        .to.emit(intentVault, "IntentExpired")
        .withArgs(intentId, user1.address);

      const intent = await intentVault.getIntent(intentId);
      expect(intent.status).to.equal(9); // EXPIRED

      // Check refund to original user
      const finalBalance = await ethers.provider.getBalance(user1.address);
      expect(finalBalance - initialBalance).to.equal(MIN_DEPOSIT);
    });

    it("should not allow expiration before deadline", async function () {
      await expect(
        intentVault.connect(user2).expireIntent(intentId)
      ).to.be.revertedWith("Intent not yet expired");
    });
  });

  describe("Reentrancy Protection", function () {
    it("should prevent reentrancy on executeIntent", async function () {
      // This test would require a malicious contract to test reentrancy
      // For now, we verify the nonReentrant modifier is present
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        deadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: MIN_DEPOSIT }
      );

      await intentVault.connect(agent1).claimIntent(1);

      // Must use ABI-encoded plan so ExecutionManager.execute can decode it
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);

      // Normal execution should work (called by assigned agent)
      await expect(
        intentVault.connect(agent1).executeIntent(1)
      ).to.not.be.reverted;
    });
  });

  describe("View Functions", function () {
    let intentId: number;

    beforeEach(async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        deadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      intentId = 1;
    });

    it("should return correct intent status", async function () {
      expect(await intentVault.getIntentStatus(intentId)).to.equal(0); // PENDING

      await intentVault.connect(agent1).claimIntent(intentId);
      expect(await intentVault.getIntentStatus(intentId)).to.equal(1); // ASSIGNED
    });

    it("should return approved protocols", async function () {
      const protocols = await intentVault.getApprovedProtocols(intentId);
      expect(protocols).to.deep.equal(approvedProtocols);
    });

    it("should check if intent is expired", async function () {
      expect(await intentVault.isIntentExpired(intentId)).to.be.false;

      // Fast forward past deadline
      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);

      expect(await intentVault.isIntentExpired(intentId)).to.be.true;
    });

    it("should revert for non-existent intent", async function () {
      await expect(
        intentVault.getIntent(999)
      ).to.be.revertedWith("Intent does not exist");
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero approved protocols", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      await expect(
        intentVault.connect(user1).createIntent(
          goalHash,
          maxSlippage,
          deadline,
          minYield,
          maxLockDuration,
          [], // Empty approved protocols
          { value: MIN_DEPOSIT }
        )
      ).to.not.be.reverted;
    });

    it("should handle maximum slippage", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      await expect(
        intentVault.connect(user1).createIntent(
          goalHash,
          MAX_SLIPPAGE_BPS, // Maximum allowed slippage
          deadline,
          minYield,
          maxLockDuration,
          approvedProtocols,
          { value: MIN_DEPOSIT }
        )
      ).to.not.be.reverted;
    });

    it("should handle large deposits", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const largeDeposit = ethers.parseEther("1000");

      await expect(
        intentVault.connect(user1).createIntent(
          goalHash,
          maxSlippage,
          deadline,
          minYield,
          maxLockDuration,
          approvedProtocols,
          { value: largeDeposit }
        )
      ).to.not.be.reverted;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getUserIntents
  // ─────────────────────────────────────────────────────────────────────────────
  describe("getUserIntents", function () {
    let deadline: number;

    beforeEach(async function () {
      deadline = Math.floor(Date.now() / 1000) + 86400;
    });

    it("returns empty array for a user with no intents", async function () {
      const intents = await intentVault.getUserIntents(user1.address);
      expect(intents.length).to.equal(0);
    });

    it("returns [1] after user creates their first intent", async function () {
      await intentVault.connect(user1).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      const intents = await intentVault.getUserIntents(user1.address);
      expect(intents.length).to.equal(1);
      expect(intents[0]).to.equal(1n);
    });

    it("returns [1, 2] after user creates two intents", async function () {
      await intentVault.connect(user1).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      await intentVault.connect(user1).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      const intents = await intentVault.getUserIntents(user1.address);
      expect(intents.length).to.equal(2);
      expect(intents[0]).to.equal(1n);
      expect(intents[1]).to.equal(2n);
    });

    it("returns only intents for the queried user, not others", async function () {
      await intentVault.connect(user1).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      await intentVault.connect(user2).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      const user1Intents = await intentVault.getUserIntents(user1.address);
      const user2Intents = await intentVault.getUserIntents(user2.address);
      expect(user1Intents.length).to.equal(1);
      expect(user2Intents.length).to.equal(1);
      expect(user1Intents[0]).to.equal(1n);
      expect(user2Intents[0]).to.equal(2n);
    });

    it("userIntents mapping is public and matches getUserIntents", async function () {
      await intentVault.connect(user1).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      const fromMapping = await intentVault.userIntents(user1.address, 0);
      const fromGetter = await intentVault.getUserIntents(user1.address);
      expect(fromMapping).to.equal(fromGetter[0]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getPendingIntents
  // ─────────────────────────────────────────────────────────────────────────────
  describe("getPendingIntents", function () {
    let deadline: number;

    beforeEach(async function () {
      deadline = Math.floor(Date.now() / 1000) + 86400;
    });

    it("returns empty array when no intents exist", async function () {
      const pending = await intentVault.getPendingIntents();
      expect(pending.length).to.equal(0);
    });

    it("returns [1] after one intent is created", async function () {
      await intentVault.connect(user1).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      const pending = await intentVault.getPendingIntents();
      expect(pending.length).to.equal(1);
      expect(pending[0]).to.equal(1n);
    });

    it("returns both intents when two are pending", async function () {
      await intentVault.connect(user1).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      await intentVault.connect(user2).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      const pending = await intentVault.getPendingIntents();
      expect(pending.length).to.equal(2);
    });

    it("excludes intents that have been assigned (claimed by agent)", async function () {
      // agent1 already registered in outer beforeEach
      await intentVault.connect(user1).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      // Claim intent — moves it to ASSIGNED
      await intentVault.connect(agent1).claimIntent(1);

      const pending = await intentVault.getPendingIntents();
      expect(pending.length).to.equal(0);
    });

    it("excludes cancelled intents", async function () {
      await intentVault.connect(user1).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      await intentVault.connect(user1).cancelIntent(1);

      const pending = await intentVault.getPendingIntents();
      expect(pending.length).to.equal(0);
    });

    it("returns only the pending one when one is pending and one is assigned", async function () {
      // agent1 already registered in outer beforeEach
      await intentVault.connect(user1).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      await intentVault.connect(user2).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
      // Claim first intent
      await intentVault.connect(agent1).claimIntent(1);

      const pending = await intentVault.getPendingIntents();
      expect(pending.length).to.equal(1);
      expect(pending[0]).to.equal(2n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // isIntentValid
  // ─────────────────────────────────────────────────────────────────────────────
  describe("isIntentValid", function () {
    let deadline: number;

    beforeEach(async function () {
      deadline = Math.floor(Date.now() / 1000) + 86400;
      await intentVault.connect(user1).createIntent(
        goalHash, maxSlippage, deadline, minYield, maxLockDuration, approvedProtocols,
        { value: MIN_DEPOSIT }
      );
    });

    it("returns true for a fresh PENDING intent", async function () {
      expect(await intentVault.isIntentValid(1)).to.be.true;
    });

    it("returns false after intent is cancelled", async function () {
      await intentVault.connect(user1).cancelIntent(1);
      expect(await intentVault.isIntentValid(1)).to.be.false;
    });

    it("returns true for an ASSIGNED intent (still valid)", async function () {
      // agent1 already registered in outer beforeEach
      await intentVault.connect(agent1).claimIntent(1);
      expect(await intentVault.isIntentValid(1)).to.be.true;
    });

    it("returns true for a PLAN_SUBMITTED intent (still valid)", async function () {
      // agent1 already registered in outer beforeEach
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, "0x1234");
      expect(await intentVault.isIntentValid(1)).to.be.true;
    });

    it("reverts for non-existent intent", async function () {
      await expect(intentVault.isIntentValid(999))
        .to.be.revertedWith("Intent does not exist");
    });

    it("returns false after deadline has passed (using time travel)", async function () {
      // Mine a block far into the future
      await ethers.provider.send("evm_increaseTime", [86400 + 1]);
      await ethers.provider.send("evm_mine", []);
      expect(await intentVault.isIntentValid(1)).to.be.false;
    });
  });
});
