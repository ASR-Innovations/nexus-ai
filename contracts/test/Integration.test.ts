import { expect } from "chai";
import { ethers } from "hardhat";
import { IntentVault, AgentRegistry, ExecutionManager } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { setupTest, MIN_DEPOSIT, MIN_STAKE, PROTOCOL_FEE_BPS } from "./setup";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("Integration Tests", function () {
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

  // Helper: impersonate ExecutionManager and call completeIntent with ETH
  async function completeIntentAs(intentId: number, returnAmount: bigint) {
    const execMgrAddr = await executionManager.getAddress();
    await ethers.provider.send("hardhat_setBalance", [
      execMgrAddr,
      "0x" + ethers.parseEther("20").toString(16)
    ]);
    const execMgrSigner = await ethers.getImpersonatedSigner(execMgrAddr);
    return intentVault.connect(execMgrSigner).completeIntent(intentId, returnAmount, {
      value: returnAmount
    });
  }

  // Helper: impersonate ExecutionManager and call failIntent with ETH
  async function failIntentAs(intentId: number, reason: string, refundAmount: bigint) {
    const execMgrAddr = await executionManager.getAddress();
    await ethers.provider.send("hardhat_setBalance", [
      execMgrAddr,
      "0x" + ethers.parseEther("20").toString(16)
    ]);
    const execMgrSigner = await ethers.getImpersonatedSigner(execMgrAddr);
    return intentVault.connect(execMgrSigner).failIntent(intentId, reason, {
      value: refundAmount
    });
  }

  beforeEach(async function () {
    const setup = await setupTest();
    deployer = setup.deployer;
    user1 = setup.user1;
    user2 = setup.user2;
    agent1 = setup.agent1;
    agent2 = setup.agent2;

    // Deploy all contracts
    const AgentRegistryFactory = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistryFactory.deploy();
    await agentRegistry.waitForDeployment();

    const ExecutionManagerFactory = await ethers.getContractFactory("ExecutionManager");
    executionManager = await ExecutionManagerFactory.deploy(ethers.ZeroAddress);
    await executionManager.waitForDeployment();

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
      value: MIN_STAKE
    });
    await agentRegistry.connect(agent2).registerAgent("ipfs://agent2-metadata", {
      value: ethers.parseEther("20")
    });
  });

  describe("Complete Intent Lifecycle", function () {
    it("should execute complete intent lifecycle successfully", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      // 1. User creates intent
      const createTx = await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        deadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: MIN_DEPOSIT }
      );

      await expect(createTx)
        .to.emit(intentVault, "IntentCreated")
        .withArgs(1, user1.address, MIN_DEPOSIT, goalHash);

      // 2. Agent claims intent
      const claimTx = await intentVault.connect(agent1).claimIntent(1);

      await expect(claimTx)
        .to.emit(intentVault, "IntentAssigned")
        .withArgs(1, agent1.address);

      // 3. Agent submits execution plan (ABI-encoded steps — positional arrays)
      // [actionType, destinationParaId, targetContract, callData, amount, minAmountOut]
      const executionSteps = [
        [1, 2034, user1.address, "0x1234", ethers.parseEther("0.9"), 0n]
      ];

      const executionPlan = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [executionSteps]
      );

      const submitTx = await intentVault.connect(agent1).submitPlan(1, executionPlan);
      const expectedHash = ethers.keccak256(executionPlan);

      await expect(submitTx)
        .to.emit(intentVault, "PlanSubmitted")
        .withArgs(1, expectedHash);

      // 4. User approves plan
      const approveTx = await intentVault.connect(user1).approvePlan(1);

      await expect(approveTx)
        .to.emit(intentVault, "PlanApproved")
        .withArgs(1);

      // 5. Assigned agent executes intent
      const executeTx = await intentVault.connect(agent1).executeIntent(1);

      await expect(executeTx)
        .to.emit(intentVault, "IntentExecuted")
        .withArgs(1, true);

      await expect(executeTx)
        .to.emit(executionManager, "ExecutionStarted")
        .withArgs(1, executionSteps.length);

      // 6. Complete intent (simulating successful XCM execution)
      const returnAmount = ethers.parseEther("1.1"); // 10% yield
      const initialUserBalance = await ethers.provider.getBalance(user1.address);

      const completeTx = await completeIntentAs(1, returnAmount);

      await expect(completeTx)
        .to.emit(intentVault, "ExecutionCompleted")
        .withArgs(1, returnAmount);

      // Verify final state
      const intent = await intentVault.getIntent(1);
      expect(intent.status).to.equal(6); // COMPLETED

      const finalUserBalance = await ethers.provider.getBalance(user1.address);
      expect(finalUserBalance - initialUserBalance).to.equal(returnAmount);

      // Verify agent reputation increased
      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.successCount).to.equal(1);
      expect(agent.totalExecutions).to.equal(1);
      expect(agent.reputationScore).to.be.greaterThan(5000); // Initial reputation
    });

    it("should handle intent failure and agent slashing", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      // Create and process intent up to execution
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

      // Use ABI-encoded empty plan so ExecutionManager.execute succeeds
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(agent1).executeIntent(1);

      // Get initial agent state
      const initialAgent = await agentRegistry.getAgent(agent1.address);
      const initialStake = initialAgent.stakeAmount;
      const initialReputation = initialAgent.reputationScore;

      // Simulate execution failure
      const initialUserBalance = await ethers.provider.getBalance(user1.address);
      const failTx = await failIntentAs(1, "XCM execution failed", MIN_DEPOSIT);

      await expect(failTx)
        .to.emit(intentVault, "ExecutionFailed")
        .withArgs(1, "XCM execution failed");

      // Verify intent failed and user got refund
      const intent = await intentVault.getIntent(1);
      expect(intent.status).to.equal(7); // FAILED

      const finalUserBalance = await ethers.provider.getBalance(user1.address);
      expect(finalUserBalance - initialUserBalance).to.equal(MIN_DEPOSIT);

      // Verify agent was slashed
      const finalAgent = await agentRegistry.getAgent(agent1.address);
      expect(finalAgent.failCount).to.equal(1);
      expect(finalAgent.totalExecutions).to.equal(1);
      expect(finalAgent.stakeAmount).to.be.lessThan(initialStake);
      expect(finalAgent.reputationScore).to.be.lessThan(initialReputation);
    });

    it("should handle multiple concurrent intents", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      // Create multiple intents
      await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        deadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: MIN_DEPOSIT }
      );

      await intentVault.connect(user2).createIntent(
        goalHash,
        maxSlippage,
        deadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: ethers.parseEther("2") }
      );

      // Different agents claim different intents
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent2).claimIntent(2);

      // Both agents submit ABI-encoded plans
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(agent2).submitPlan(2, emptyPlan);

      // Users approve their respective plans
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(user2).approvePlan(2);

      // Execute both intents (each by their assigned agent)
      await intentVault.connect(agent1).executeIntent(1);
      await intentVault.connect(agent2).executeIntent(2);

      // Complete both intents
      await completeIntentAs(1, ethers.parseEther("1.1"));
      await completeIntentAs(2, ethers.parseEther("2.2"));

      // Verify both intents completed
      const intent1 = await intentVault.getIntent(1);
      const intent2 = await intentVault.getIntent(2);

      expect(intent1.status).to.equal(6); // COMPLETED
      expect(intent2.status).to.equal(6); // COMPLETED

      // Verify both agents got reputation boost
      const agent1Data = await agentRegistry.getAgent(agent1.address);
      const agent2Data = await agentRegistry.getAgent(agent2.address);

      expect(agent1Data.successCount).to.equal(1);
      expect(agent2Data.successCount).to.equal(1);
    });

    it("should prevent unauthorized actions", async function () {
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

      // Wrong agent cannot submit plan
      await expect(
        intentVault.connect(agent2).submitPlan(1, ethers.toUtf8Bytes("plan"))
      ).to.be.revertedWith("Not assigned agent");

      await intentVault.connect(agent1).submitPlan(1, ethers.toUtf8Bytes("plan"));

      // Wrong user cannot approve plan
      await expect(
        intentVault.connect(user2).approvePlan(1)
      ).to.be.revertedWith("Not intent owner");

      await intentVault.connect(user1).approvePlan(1);

      // Wrong caller cannot execute intent (only assigned agent can)
      await expect(
        intentVault.connect(user2).executeIntent(1)
      ).to.be.revertedWith("Not assigned agent");
    });
  });

  describe("Agent Competition and Selection", function () {
    it("should allow multiple agents to compete for intents", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      // Create intent
      await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        deadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: MIN_DEPOSIT }
      );

      // First agent claims it
      await intentVault.connect(agent1).claimIntent(1);

      // Second agent cannot claim already assigned intent
      await expect(
        intentVault.connect(agent2).claimIntent(1)
      ).to.be.revertedWith("Intent not available");

      // Verify correct agent was assigned
      const intent = await intentVault.getIntent(1);
      expect(intent.assignedAgent).to.equal(agent1.address);
    });

    it("should handle agent deactivation during intent lifecycle", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      // Create intent and let agent1 claim it
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

      // Slash agent1 multiple times to deactivate them (impersonate IntentVault as caller)
      const ivAddr = await intentVault.getAddress();
      await ethers.provider.send("hardhat_setBalance", [
        ivAddr, "0x" + ethers.parseEther("20").toString(16)
      ]);
      const ivSigner = await ethers.getImpersonatedSigner(ivAddr);
      await agentRegistry.connect(ivSigner).recordFailure(agent1.address);
      await agentRegistry.connect(ivSigner).recordFailure(agent1.address);
      await agentRegistry.connect(ivSigner).recordFailure(agent1.address);

      // Verify agent is deactivated
      expect(await agentRegistry.isActiveAgent(agent1.address)).to.be.false;

      // Agent can still complete their assigned intent
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(agent1).executeIntent(1);
      await completeIntentAs(1, ethers.parseEther("1.1"));

      // But cannot claim new intents
      await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        deadline + 1000,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: MIN_DEPOSIT }
      );

      await expect(
        intentVault.connect(agent1).claimIntent(2)
      ).to.be.revertedWith("Agent not active");
    });
  });

  describe("Cross-Chain Execution Simulation", function () {
    it("should handle XCM execution steps correctly", async function () {
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

      // Create execution plan with XCM steps — [actionType, paraId, target, callData, amount, minOut]
      const executionSteps = [
        [0, 0, await agentRegistry.getAddress(), agentRegistry.interface.encodeFunctionData("MIN_STAKE"), 0n, 0n],
        [1, 2034, user1.address, "0x1234", ethers.parseEther("0.5"), 0n],
        [1, 2030, user1.address, "0x5678", ethers.parseEther("0.4"), 0n]
      ];

      const executionPlan = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [executionSteps]
      );

      await intentVault.connect(agent1).submitPlan(1, executionPlan);
      await intentVault.connect(user1).approvePlan(1);

      const executeTx = await intentVault.connect(agent1).executeIntent(1);

      // Verify execution started with correct number of steps
      await expect(executeTx)
        .to.emit(executionManager, "ExecutionStarted")
        .withArgs(1, executionSteps.length);

      // Verify XCM messages were sent
      await expect(executeTx)
        .to.emit(executionManager, "XCMSent")
        .withArgs(1, 2034, anyValue);

      await expect(executeTx)
        .to.emit(executionManager, "XCMSent")
        .withArgs(1, 2030, anyValue);

      // Verify execution is awaiting confirmation
      const execution = await executionManager.getExecution(1);
      expect(execution.status).to.equal(1); // AWAITING_CONFIRMATION
      expect(execution.totalSteps).to.equal(3);
    });

    it("should handle mixed local and XCM execution failure", async function () {
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

      // Create execution plan with failing local step — [actionType, paraId, target, callData, amount, minOut]
      const executionSteps = [
        [0, 0, await agentRegistry.getAddress(), "0xdeadbeef", 0n, 0n], // Invalid selector → fails
        [1, 2034, user1.address, "0x1234", ethers.parseEther("0.5"), 0n]
      ];

      const executionPlan = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [executionSteps]
      );

      await intentVault.connect(agent1).submitPlan(1, executionPlan);
      await intentVault.connect(user1).approvePlan(1);

      const executeTx = await intentVault.connect(agent1).executeIntent(1);

      // Verify execution failed
      await expect(executeTx)
        .to.emit(executionManager, "ExecutionFailed")
        .withArgs(1, anyValue);

      const execution = await executionManager.getExecution(1);
      expect(execution.status).to.equal(3); // FAILED
    });
  });

  describe("Economic Incentives", function () {
    it("should correctly handle protocol fees", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const depositAmount = ethers.parseEther("10");

      await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        deadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: depositAmount }
      );

      await intentVault.connect(agent1).claimIntent(1);
      // Use ABI-encoded plan so executeIntent succeeds
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);

      const expectedFee = (depositAmount * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const expectedTransfer = depositAmount - expectedFee;

      const initialExecutionManagerBalance = await ethers.provider.getBalance(
        await executionManager.getAddress()
      );

      await intentVault.connect(agent1).executeIntent(1);

      const finalExecutionManagerBalance = await ethers.provider.getBalance(
        await executionManager.getAddress()
      );

      // Verify correct amount was transferred to ExecutionManager
      expect(finalExecutionManagerBalance - initialExecutionManagerBalance)
        .to.equal(expectedTransfer);
    });

    it("should handle yield distribution correctly", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const depositAmount = ethers.parseEther("10");
      const yieldAmount = ethers.parseEther("1"); // 10% yield

      await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        deadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: depositAmount }
      );

      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(agent1).executeIntent(1);

      const initialUserBalance = await ethers.provider.getBalance(user1.address);
      const returnAmount = depositAmount + yieldAmount;

      await completeIntentAs(1, returnAmount);

      const finalUserBalance = await ethers.provider.getBalance(user1.address);

      // User should receive original deposit + yield
      expect(finalUserBalance - initialUserBalance).to.equal(returnAmount);
    });
  });

  describe("Time-based Operations", function () {
    it("should handle intent expiration correctly", async function () {
      const shortDeadline = (await ethers.provider.getBlock("latest"))!.timestamp + 10; // 10 seconds

      await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        shortDeadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: MIN_DEPOSIT }
      );

      // Fast forward past deadline
      await ethers.provider.send("evm_increaseTime", [15]);
      await ethers.provider.send("evm_mine", []);

      // Agent cannot claim expired intent
      await expect(
        intentVault.connect(agent1).claimIntent(1)
      ).to.be.revertedWith("Intent expired");

      // Anyone can expire the intent
      const initialUserBalance = await ethers.provider.getBalance(user1.address);

      await intentVault.connect(user2).expireIntent(1);

      const finalUserBalance = await ethers.provider.getBalance(user1.address);
      expect(finalUserBalance - initialUserBalance).to.equal(MIN_DEPOSIT);

      const intent = await intentVault.getIntent(1);
      expect(intent.status).to.equal(9); // EXPIRED
    });

    it("should prevent operations on expired intents", async function () {
      const shortDeadline = (await ethers.provider.getBlock("latest"))!.timestamp + 10;

      await intentVault.connect(user1).createIntent(
        goalHash,
        maxSlippage,
        shortDeadline,
        minYield,
        maxLockDuration,
        approvedProtocols,
        { value: MIN_DEPOSIT }
      );

      await intentVault.connect(agent1).claimIntent(1);

      // Fast forward past deadline
      await ethers.provider.send("evm_increaseTime", [15]);
      await ethers.provider.send("evm_mine", []);

      // Cannot submit plan for expired intent
      await expect(
        intentVault.connect(agent1).submitPlan(1, ethers.toUtf8Bytes("plan"))
      ).to.be.revertedWith("Intent expired");
    });
  });
});
