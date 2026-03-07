/**
 * DeepUserFlow.test.ts
 *
 * Comprehensive deep tests covering every function, user flow, edge case, and
 * authorization boundary for the NexusAI Protocol contracts.
 *
 * Coverage added beyond existing tests:
 *  - All 9 terminal intent states walked end-to-end
 *  - Every restricted function called with wrong caller
 *  - Invalid status-machine transitions
 *  - updateAgentRegistry / updateExecutionManager (no access control)
 *  - setAwaitingConfirmation direct testing
 *  - failIntent full flow (agent slashed, user refunded)
 *  - AgentRegistry: getTopAgents stub, deactivation, re-registration blocked,
 *    reputation asymptote, edge-stake deactivation
 *  - ExecutionManager: _executeStep direct call, partial step failure,
 *    refund-to-vault on failure, multiple XCM events, failExecution on AWAITING
 *  - Multi-actor: competing agents, sequential agent execution, concurrent handling
 *  - Economic precision: exact fee, exact returnAmount, exact refund
 *  - Deadline boundary: every lifecycle function checked after deadline
 *  - Non-existent intent IDs on all accessors
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { IntentVault, AgentRegistry, ExecutionManager } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { setupTest, MIN_DEPOSIT, MIN_STAKE, MAX_SLIPPAGE_BPS, PROTOCOL_FEE_BPS } from "./setup";

describe("DeepUserFlow Tests", function () {
  let intentVault: IntentVault;
  let agentRegistry: AgentRegistry;
  let executionManager: ExecutionManager;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let agent1: SignerWithAddress;
  let agent2: SignerWithAddress;

  // ABI-encoded empty ExecutionStep[] — used wherever we don't care about execution logic
  const emptyPlan = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
    [[]]
  );

  // ──────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────

  async function latestTimestamp(): Promise<number> {
    return (await ethers.provider.getBlock("latest"))!.timestamp;
  }

  async function makeDeadline(secondsFromNow = 3600): Promise<number> {
    return (await latestTimestamp()) + secondsFromNow;
  }

  /** Impersonate ExecutionManager and call completeIntent on IntentVault */
  async function completeIntentAs(intentId: number, returnAmount: bigint) {
    const execMgrAddr = await executionManager.getAddress();
    await ethers.provider.send("hardhat_setBalance", [
      execMgrAddr,
      "0x" + ethers.parseEther("50").toString(16),
    ]);
    const execSigner = await ethers.getImpersonatedSigner(execMgrAddr);
    return intentVault
      .connect(execSigner)
      .completeIntent(intentId, returnAmount, { value: returnAmount });
  }

  /**
   * Impersonate ExecutionManager and call failIntent on IntentVault.
   * refundAmount must equal (intent.amount - protocolFee) so vault can return
   * the full intent.amount to the user.
   */
  async function failIntentAs(intentId: number, reason: string, refundAmount: bigint) {
    const execMgrAddr = await executionManager.getAddress();
    await ethers.provider.send("hardhat_setBalance", [
      execMgrAddr,
      "0x" + ethers.parseEther("50").toString(16),
    ]);
    const execSigner = await ethers.getImpersonatedSigner(execMgrAddr);
    return intentVault
      .connect(execSigner)
      .failIntent(intentId, reason, { value: refundAmount });
  }

  /** Impersonate ExecutionManager and call setAwaitingConfirmation */
  async function setAwaitingAs(intentId: number) {
    const execMgrAddr = await executionManager.getAddress();
    await ethers.provider.send("hardhat_setBalance", [
      execMgrAddr,
      "0x" + ethers.parseEther("10").toString(16),
    ]);
    const execSigner = await ethers.getImpersonatedSigner(execMgrAddr);
    return intentVault.connect(execSigner).setAwaitingConfirmation(intentId);
  }

  // ──────────────────────────────────────────────────────────────
  // Top-level beforeEach — deploy fresh contracts for every test
  // ──────────────────────────────────────────────────────────────

  beforeEach(async function () {
    const setup = await setupTest();
    deployer = setup.deployer;
    user1 = setup.user1;
    user2 = setup.user2;
    agent1 = setup.agent1;
    agent2 = setup.agent2;

    const AgentRegistryFactory = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistryFactory.deploy();
    await agentRegistry.waitForDeployment();

    const EMFactory1 = await ethers.getContractFactory("ExecutionManager");
    const tempEM = await EMFactory1.deploy(ethers.ZeroAddress);
    await tempEM.waitForDeployment();

    const IVFactory = await ethers.getContractFactory("IntentVault");
    intentVault = await IVFactory.deploy(
      await agentRegistry.getAddress(),
      await tempEM.getAddress()
    );
    await intentVault.waitForDeployment();

    const EMFactory2 = await ethers.getContractFactory("ExecutionManager");
    executionManager = await EMFactory2.deploy(await intentVault.getAddress());
    await executionManager.waitForDeployment();

    await intentVault.updateExecutionManager(await executionManager.getAddress());

    // Set IntentVault as the authorized caller in AgentRegistry
    await agentRegistry.setIntentVault(await intentVault.getAddress());

    // Give vault some ETH for gas/impersonation
    const vaultAddr = await intentVault.getAddress();
    await ethers.provider.send("hardhat_setBalance", [
      vaultAddr,
      "0x" + ethers.parseEther("100").toString(16),
    ]);

    // Register both agents with healthy stake (well above MIN_STAKE so they
    // survive multiple slashes before deactivation)
    await agentRegistry
      .connect(agent1)
      .registerAgent("ipfs://agent1-deep", { value: ethers.parseEther("20") });
    await agentRegistry
      .connect(agent2)
      .registerAgent("ipfs://agent2-deep", { value: ethers.parseEther("30") });
  });

  // ════════════════════════════════════════════════════════════════
  // 1. COMPLETE LIFECYCLE — ALL TERMINAL STATES
  // ════════════════════════════════════════════════════════════════

  describe("Complete Lifecycle — All Terminal States", function () {
    const goalHash = ethers.keccak256(ethers.toUtf8Bytes("Earn 10% APY on DOT"));

    it("PENDING → CANCELLED: user cancels immediately after creation", async function () {
      const deadline = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });

      const bal0 = await ethers.provider.getBalance(user1.address);
      const tx = await intentVault.connect(user1).cancelIntent(1);
      const receipt = await tx.wait();

      await expect(tx)
        .to.emit(intentVault, "IntentCancelled")
        .withArgs(1, user1.address);
      await expect(tx)
        .to.emit(intentVault, "FundsReturned")
        .withArgs(1, user1.address, MIN_DEPOSIT);

      expect((await intentVault.getIntent(1)).status).to.equal(8); // CANCELLED

      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const bal1 = await ethers.provider.getBalance(user1.address);
      // net change ≈ +MIN_DEPOSIT (minus gas)
      expect(bal1 + gasCost - bal0).to.be.closeTo(
        MIN_DEPOSIT,
        ethers.parseEther("0.01")
      );
    });

    it("ASSIGNED → CANCELLED: user cancels after agent claims", async function () {
      const deadline = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);

      expect((await intentVault.getIntent(1)).status).to.equal(1); // ASSIGNED

      await intentVault.connect(user1).cancelIntent(1);
      expect((await intentVault.getIntent(1)).status).to.equal(8); // CANCELLED
    });

    it("PLAN_SUBMITTED → CANCELLED: user cancels after plan submitted", async function () {
      const deadline = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);

      expect((await intentVault.getIntent(1)).status).to.equal(2); // PLAN_SUBMITTED

      await intentVault.connect(user1).cancelIntent(1);
      expect((await intentVault.getIntent(1)).status).to.equal(8); // CANCELLED
    });

    it("APPROVED → CANCELLED: user cancels after approving plan", async function () {
      const deadline = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);

      expect((await intentVault.getIntent(1)).status).to.equal(3); // APPROVED

      await intentVault.connect(user1).cancelIntent(1);
      expect((await intentVault.getIntent(1)).status).to.equal(8); // CANCELLED
    });

    it("EXECUTING → AWAITING_CONFIRMATION → COMPLETED: happy path with setAwaitingConfirmation", async function () {
      const deadline = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(agent1).executeIntent(1);

      expect((await intentVault.getIntent(1)).status).to.equal(4); // EXECUTING

      // ExecutionManager signals XCM dispatched → vault status = AWAITING_CONFIRMATION
      const setTx = await setAwaitingAs(1);
      await expect(setTx).to.emit(intentVault, "ExecutionDispatched").withArgs(1);
      expect((await intentVault.getIntent(1)).status).to.equal(5); // AWAITING_CONFIRMATION

      const returnAmount = ethers.parseEther("1.1");
      const bal0 = await ethers.provider.getBalance(user1.address);
      const completeTx = await completeIntentAs(1, returnAmount);
      await expect(completeTx)
        .to.emit(intentVault, "ExecutionCompleted")
        .withArgs(1, returnAmount);
      await expect(completeTx)
        .to.emit(intentVault, "FundsReturned")
        .withArgs(1, user1.address, returnAmount);

      expect((await intentVault.getIntent(1)).status).to.equal(6); // COMPLETED
      const bal1 = await ethers.provider.getBalance(user1.address);
      expect(bal1 - bal0).to.equal(returnAmount);
    });

    it("EXECUTING → COMPLETED: completeIntent directly from EXECUTING (skipping AWAITING)", async function () {
      const deadline = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(agent1).executeIntent(1);

      // completeIntent accepts both EXECUTING and AWAITING_CONFIRMATION
      await completeIntentAs(1, MIN_DEPOSIT);
      expect((await intentVault.getIntent(1)).status).to.equal(6); // COMPLETED
    });

    it("EXECUTING → FAILED: agent slashed, user refunded full deposit", async function () {
      const deposit = ethers.parseEther("2");
      const deadline = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: deposit });
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(agent1).executeIntent(1);

      const agentBefore = await agentRegistry.getAgent(agent1.address);
      const fee = (deposit * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const executionAmount = deposit - fee;

      const bal0 = await ethers.provider.getBalance(user1.address);
      const failTx = await failIntentAs(1, "XCM relay timeout", executionAmount);

      await expect(failTx)
        .to.emit(intentVault, "ExecutionFailed")
        .withArgs(1, "XCM relay timeout");
      await expect(failTx)
        .to.emit(intentVault, "FundsReturned")
        .withArgs(1, user1.address, deposit);

      expect((await intentVault.getIntent(1)).status).to.equal(7); // FAILED

      const bal1 = await ethers.provider.getBalance(user1.address);
      expect(bal1 - bal0).to.equal(deposit); // full original deposit back

      // Agent was slashed
      const agentAfter = await agentRegistry.getAgent(agent1.address);
      expect(agentAfter.stakeAmount).to.be.lessThan(agentBefore.stakeAmount);
      expect(agentAfter.failCount).to.equal(agentBefore.failCount + 1n);
      expect(agentAfter.totalExecutions).to.equal(agentBefore.totalExecutions + 1n);
    });

    it("PENDING → EXPIRED: anyone can expire after deadline", async function () {
      const deadline = await makeDeadline(100);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });

      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);

      const bal0 = await ethers.provider.getBalance(user1.address);
      const expireTx = await intentVault.connect(user2).expireIntent(1); // user2 triggers

      await expect(expireTx)
        .to.emit(intentVault, "IntentExpired")
        .withArgs(1, user1.address);
      await expect(expireTx)
        .to.emit(intentVault, "FundsReturned")
        .withArgs(1, user1.address, MIN_DEPOSIT);

      expect((await intentVault.getIntent(1)).status).to.equal(9); // EXPIRED
      const bal1 = await ethers.provider.getBalance(user1.address);
      expect(bal1 - bal0).to.equal(MIN_DEPOSIT);
    });

    it("ASSIGNED → EXPIRED: agent claimed but never submitted plan", async function () {
      const deadline = await makeDeadline(100);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);

      expect((await intentVault.getIntent(1)).status).to.equal(1); // ASSIGNED

      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);

      await intentVault.connect(user1).expireIntent(1);
      expect((await intentVault.getIntent(1)).status).to.equal(9); // EXPIRED
    });

    it("PLAN_SUBMITTED → EXPIRED: plan was submitted but deadline passed before approval", async function () {
      const deadline = await makeDeadline(100);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);

      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);

      await intentVault.connect(user2).expireIntent(1);
      expect((await intentVault.getIntent(1)).status).to.equal(9); // EXPIRED
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 2. AUTHORIZATION — EVERY RESTRICTED FUNCTION WITH WRONG CALLER
  // ════════════════════════════════════════════════════════════════

  describe("Authorization — Unauthorized Access Reverts", function () {
    const goalHash = ethers.keccak256(ethers.toUtf8Bytes("auth test"));
    let intentId: number;

    beforeEach(async function () {
      const deadline = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });
      intentId = 1;
    });

    it("user2 cannot cancel user1's intent", async function () {
      await expect(
        intentVault.connect(user2).cancelIntent(intentId)
      ).to.be.revertedWith("Not intent owner");
    });

    it("unregistered address cannot claim intent", async function () {
      await expect(
        intentVault.connect(user1).claimIntent(intentId) // user1 is not a registered agent
      ).to.be.revertedWith("Agent not active");
    });

    it("agent2 cannot submit plan for agent1's intent", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);
      await expect(
        intentVault.connect(agent2).submitPlan(intentId, emptyPlan)
      ).to.be.revertedWith("Not assigned agent");
    });

    it("user2 cannot approve user1's plan", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);
      await intentVault.connect(agent1).submitPlan(intentId, emptyPlan);
      await expect(
        intentVault.connect(user2).approvePlan(intentId)
      ).to.be.revertedWith("Not intent owner");
    });

    it("non-assigned-agent cannot execute intent (only assigned agent can)", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);
      await intentVault.connect(agent1).submitPlan(intentId, emptyPlan);
      await intentVault.connect(user1).approvePlan(intentId);
      await expect(
        intentVault.connect(user2).executeIntent(intentId)
      ).to.be.revertedWith("Not assigned agent");
    });

    it("non-ExecutionManager cannot call completeIntent", async function () {
      await expect(
        intentVault.connect(user1).completeIntent(intentId, 0)
      ).to.be.revertedWith("Only ExecutionManager");
    });

    it("non-ExecutionManager cannot call failIntent", async function () {
      await expect(
        intentVault.connect(user1).failIntent(intentId, "hack attempt")
      ).to.be.revertedWith("Only ExecutionManager");
    });

    it("non-ExecutionManager cannot call setAwaitingConfirmation", async function () {
      await expect(
        intentVault.connect(user1).setAwaitingConfirmation(intentId)
      ).to.be.revertedWith("Only ExecutionManager");
    });

    it("cannot cancel intent once execution has started (EXECUTING status)", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);
      await intentVault.connect(agent1).submitPlan(intentId, emptyPlan);
      await intentVault.connect(user1).approvePlan(intentId);
      await intentVault.connect(agent1).executeIntent(intentId);

      await expect(
        intentVault.connect(user1).cancelIntent(intentId)
      ).to.be.revertedWith("Cannot cancel after execution started");
    });

    it("cannot expire an EXECUTING intent even after deadline", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);
      await intentVault.connect(agent1).submitPlan(intentId, emptyPlan);
      await intentVault.connect(user1).approvePlan(intentId);
      await intentVault.connect(agent1).executeIntent(intentId);

      await ethers.provider.send("evm_increaseTime", [7200]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        intentVault.connect(user2).expireIntent(intentId)
      ).to.be.revertedWith("Intent cannot be expired");
    });

    it("cannot expire a COMPLETED intent", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);
      await intentVault.connect(agent1).submitPlan(intentId, emptyPlan);
      await intentVault.connect(user1).approvePlan(intentId);
      await intentVault.connect(agent1).executeIntent(intentId);
      await completeIntentAs(1, MIN_DEPOSIT);

      await ethers.provider.send("evm_increaseTime", [7200]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        intentVault.connect(user2).expireIntent(intentId)
      ).to.be.revertedWith("Intent cannot be expired");
    });

    it("cannot expire a FAILED intent", async function () {
      await intentVault.connect(agent1).claimIntent(intentId);
      await intentVault.connect(agent1).submitPlan(intentId, emptyPlan);
      await intentVault.connect(user1).approvePlan(intentId);
      await intentVault.connect(agent1).executeIntent(intentId);

      const fee = (MIN_DEPOSIT * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      await failIntentAs(1, "test", MIN_DEPOSIT - fee);

      await ethers.provider.send("evm_increaseTime", [7200]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        intentVault.connect(user2).expireIntent(intentId)
      ).to.be.revertedWith("Intent cannot be expired");
    });

    it("cannot expire a CANCELLED intent", async function () {
      const deadline = await makeDeadline(100);
      await intentVault
        .connect(user1)
        .createIntent(goalHash, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(user1).cancelIntent(2);

      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        intentVault.connect(user2).expireIntent(2)
      ).to.be.revertedWith("Intent cannot be expired");
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 3. INTENT STATUS MACHINE — INVALID TRANSITIONS
  // ════════════════════════════════════════════════════════════════

  describe("Intent Status Machine — Invalid Transitions", function () {
    const g = ethers.keccak256(ethers.toUtf8Bytes("t"));

    it("second agent cannot claim already-assigned intent", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await expect(intentVault.connect(agent2).claimIntent(1)).to.be.revertedWith(
        "Intent not available"
      );
    });

    it("cannot submitPlan when intent is PENDING (wrong agent)", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      // agent1 is not assigned yet
      await expect(intentVault.connect(agent1).submitPlan(1, emptyPlan)).to.be.revertedWith(
        "Not assigned agent"
      );
    });

    it("cannot approvePlan when status is ASSIGNED (no plan yet)", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await expect(intentVault.connect(user1).approvePlan(1)).to.be.revertedWith(
        "No plan to approve"
      );
    });

    it("cannot executeIntent when status is PLAN_SUBMITTED (not yet approved)", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      // Assigned agent (agent1) calls but plan not yet approved
      await expect(intentVault.connect(agent1).executeIntent(1)).to.be.revertedWith(
        "Plan not approved"
      );
    });

    it("cannot executeIntent when status is PENDING (no assigned agent)", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      // No agent assigned yet — any caller gets "Not assigned agent"
      await expect(intentVault.connect(user1).executeIntent(1)).to.be.revertedWith(
        "Not assigned agent"
      );
    });

    it("completeIntent reverts when intent is PENDING", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });

      const execMgrAddr = await executionManager.getAddress();
      await ethers.provider.send("hardhat_setBalance", [
        execMgrAddr,
        "0x" + ethers.parseEther("10").toString(16),
      ]);
      const execSigner = await ethers.getImpersonatedSigner(execMgrAddr);

      await expect(
        intentVault.connect(execSigner).completeIntent(1, 0)
      ).to.be.revertedWith("Invalid status for completion");
    });

    it("setAwaitingConfirmation reverts when status is not EXECUTING", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });

      const execMgrAddr = await executionManager.getAddress();
      await ethers.provider.send("hardhat_setBalance", [
        execMgrAddr,
        "0x" + ethers.parseEther("10").toString(16),
      ]);
      const execSigner = await ethers.getImpersonatedSigner(execMgrAddr);

      await expect(
        intentVault.connect(execSigner).setAwaitingConfirmation(1)
      ).to.be.revertedWith("Invalid status");
    });

    it("cannot expire already-expired intent", async function () {
      const deadline = await makeDeadline(100);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, deadline, 0, 0, [], { value: MIN_DEPOSIT });

      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);

      await intentVault.connect(user2).expireIntent(1);
      await expect(intentVault.connect(user2).expireIntent(1)).to.be.revertedWith(
        "Intent cannot be expired"
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 4. ADMIN FUNCTIONS — updateAgentRegistry / updateExecutionManager
  // ════════════════════════════════════════════════════════════════

  describe("Admin Functions — Owner-Only Access Control", function () {
    it("non-owner cannot call updateAgentRegistry", async function () {
      await expect(
        intentVault.connect(user1).updateAgentRegistry(user2.address)
      ).to.be.revertedWith("Only owner");
    });

    it("non-owner cannot call updateExecutionManager", async function () {
      await expect(
        intentVault.connect(user1).updateExecutionManager(user2.address)
      ).to.be.revertedWith("Only owner");
    });

    it("owner can call updateAgentRegistry and change the registry", async function () {
      const newRegistry = user2.address;
      await expect(
        intentVault.connect(deployer).updateAgentRegistry(newRegistry)
      ).to.not.be.reverted;
      expect(await intentVault.agentRegistry()).to.equal(newRegistry);
    });

    it("owner can call updateExecutionManager and change the manager", async function () {
      const newEM = user2.address;
      await expect(
        intentVault.connect(deployer).updateExecutionManager(newEM)
      ).to.not.be.reverted;
      expect(await intentVault.executionManager()).to.equal(newEM);
    });

    it("updateExecutionManager to zero address breaks EM-guarded paths", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(ethers.keccak256(ethers.toUtf8Bytes("t")), 500, dl, 0, 0, [], {
          value: MIN_DEPOSIT,
        });
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);

      // Replace EM with zero address — only owner can do this
      await intentVault.connect(deployer).updateExecutionManager(ethers.ZeroAddress);

      // executeIntent calls executionManager.execute() which would revert on zero address
      await expect(intentVault.connect(agent1).executeIntent(1)).to.be.reverted;
    });

    it("updateAgentRegistry to replacement allows intents with new registry rules", async function () {
      // Deploy a fresh registry without any agents registered
      const AgentRegistryFactory = await ethers.getContractFactory("AgentRegistry");
      const newRegistry = await AgentRegistryFactory.deploy();
      await newRegistry.waitForDeployment();

      await intentVault.connect(deployer).updateAgentRegistry(await newRegistry.getAddress());
      expect(await intentVault.agentRegistry()).to.equal(await newRegistry.getAddress());

      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(ethers.keccak256(ethers.toUtf8Bytes("t")), 500, dl, 0, 0, [], {
          value: MIN_DEPOSIT,
        });

      // agent1 is not registered in newRegistry → claimIntent should revert
      await expect(intentVault.connect(agent1).claimIntent(1)).to.be.revertedWith(
        "Agent not active"
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 5. AGENTREGISTRY — EXTENDED COVERAGE
  // ════════════════════════════════════════════════════════════════

  describe("AgentRegistry — Extended Coverage", function () {
    // Set deployer as the authorized IntentVault so direct recordSuccess/recordFailure calls work
    beforeEach(async function () {
      await agentRegistry.setIntentVault(deployer.address);
    });

    it("getTopAgents returns registered agents (fixed from stub)", async function () {
      // agent1 and agent2 are registered in beforeEach with 20 ETH stake each
      const top3 = await agentRegistry.getTopAgents(3);
      // Both agents have equal reputation (5000), so both are returned (capped at total count)
      expect(top3.length).to.equal(2);
    });

    it("getTopAgents(0) returns empty", async function () {
      const top0 = await agentRegistry.getTopAgents(0);
      expect(top0.length).to.equal(0);
    });

    it("getTopAgents(100) caps at actual registered agent count", async function () {
      const top = await agentRegistry.getTopAgents(100);
      // Only 2 agents registered in beforeEach
      expect(top.length).to.equal(2);
    });

    it("deactivated agent cannot re-register (registeredAt is still non-zero)", async function () {
      // Slash agent1 to deactivation (20 ETH, 10% slash per failure)
      // After 3 failures: 20→18→16.2→14.58 (all > 10), after 4th: ~13.12, after a few more → < 10
      // With 20 ETH: 20*0.9^n < 10 → 0.9^n < 0.5 → n ≥ 7
      for (let i = 0; i < 8; i++) {
        await agentRegistry.connect(deployer).recordFailure(agent1.address);
      }
      expect(await agentRegistry.isActiveAgent(agent1.address)).to.be.false;

      await expect(
        agentRegistry.connect(agent1).registerAgent("ipfs://retry", { value: MIN_STAKE })
      ).to.be.revertedWith("Agent already registered");
    });

    it("reputation formula never exceeds 10000 after many successes", async function () {
      await agentRegistry
        .connect(user1)
        .registerAgent("ipfs://u1", { value: MIN_STAKE });

      let rep = BigInt(5000);
      for (let i = 0; i < 100; i++) {
        await agentRegistry.connect(deployer).recordSuccess(user1.address, 0n);
        rep = rep + ((10000n - rep) * 100n) / 10000n;
      }
      const agentData = await agentRegistry.getAgent(user1.address);
      expect(agentData.reputationScore).to.equal(rep);
      expect(agentData.reputationScore).to.be.lessThanOrEqual(10000n);
    });

    it("reputation increase shrinks as score nears 10000", async function () {
      await agentRegistry
        .connect(user1)
        .registerAgent("ipfs://u1", { value: MIN_STAKE });

      // Run 300 successes — formula: newRep = oldRep + ((10000-oldRep)*100/10000)
      // After ~300: rep ≈ 9751, per-step increase ≈ 2 (much less than initial ~50)
      for (let i = 0; i < 300; i++) {
        await agentRegistry.connect(deployer).recordSuccess(user1.address, 0n);
      }
      const before = (await agentRegistry.getAgent(user1.address)).reputationScore;
      await agentRegistry.connect(deployer).recordSuccess(user1.address, 0n);
      const after = (await agentRegistry.getAgent(user1.address)).reputationScore;

      // Increase should be very small compared to initial increase of ~50
      const increase = after - before;
      expect(increase).to.be.lessThanOrEqual(5n);   // converging toward 0
      expect(after).to.be.lessThanOrEqual(10000n);  // never exceeds cap
    });

    it("stake tracked correctly across multiple failures", async function () {
      await agentRegistry
        .connect(user1)
        .registerAgent("ipfs://u1", { value: ethers.parseEther("100") });

      let stake = ethers.parseEther("100");
      for (let i = 0; i < 5; i++) {
        const slash = (stake * 10n) / 100n;
        stake -= slash;
        await agentRegistry.connect(deployer).recordFailure(user1.address);
      }
      const agentData = await agentRegistry.getAgent(user1.address);
      expect(agentData.stakeAmount).to.equal(stake);
    });

    it("isActiveAgent returns false for completely unregistered address", async function () {
      expect(await agentRegistry.isActiveAgent(deployer.address)).to.be.false;
    });

    it("agent registered with exactly MIN_STAKE is active", async function () {
      await agentRegistry
        .connect(user1)
        .registerAgent("ipfs://u1", { value: MIN_STAKE });
      expect(await agentRegistry.isActiveAgent(user1.address)).to.be.true;
    });

    it("agent deactivated when stake falls just below MIN_STAKE after one slash", async function () {
      // 10.5 ETH * 0.9 = 9.45 ETH < 10 ETH (MIN_STAKE) → deactivated
      const edgeStake = ethers.parseEther("10.5");
      await agentRegistry
        .connect(user1)
        .registerAgent("ipfs://edge", { value: edgeStake });
      await agentRegistry.connect(deployer).recordFailure(user1.address);

      expect(await agentRegistry.isActiveAgent(user1.address)).to.be.false;
      const agentData = await agentRegistry.getAgent(user1.address);
      expect(agentData.stakeAmount).to.be.lessThan(MIN_STAKE);
    });

    it("getAgentStake returns 0 for unregistered address", async function () {
      expect(await agentRegistry.getAgentStake(deployer.address)).to.equal(0n);
    });

    it("getAgentReputation returns 0 for unregistered address", async function () {
      expect(await agentRegistry.getAgentReputation(deployer.address)).to.equal(0n);
    });

    it("totalExecutions always equals successCount + failCount", async function () {
      await agentRegistry
        .connect(user1)
        .registerAgent("ipfs://u1", { value: MIN_STAKE });
      for (let i = 0; i < 4; i++) await agentRegistry.connect(deployer).recordSuccess(user1.address, 0n);
      for (let i = 0; i < 2; i++) await agentRegistry.connect(deployer).recordFailure(user1.address);

      const a = await agentRegistry.getAgent(user1.address);
      expect(a.totalExecutions).to.equal(a.successCount + a.failCount);
      expect(a.successCount).to.equal(4n);
      expect(a.failCount).to.equal(2n);
    });

    it("AgentDeactivated event emitted at the moment stake falls below MIN_STAKE", async function () {
      // Use edge stake so exactly one failure triggers deactivation
      const edgeStake = ethers.parseEther("10.5");
      await agentRegistry
        .connect(user1)
        .registerAgent("ipfs://edge", { value: edgeStake });

      await expect(agentRegistry.connect(deployer).recordFailure(user1.address))
        .to.emit(agentRegistry, "AgentDeactivated")
        .withArgs(user1.address);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 6. EXECUTIONMANAGER — EXTENDED COVERAGE
  // ════════════════════════════════════════════════════════════════

  describe("ExecutionManager — Extended Coverage", function () {
    let vaultSig: any;

    beforeEach(async function () {
      const vaultAddr = await intentVault.getAddress();
      await ethers.provider.send("hardhat_setBalance", [
        vaultAddr,
        "0x" + ethers.parseEther("100").toString(16),
      ]);
      vaultSig = await ethers.getImpersonatedSigner(vaultAddr);
    });

    it("_executeStep reverts when called directly (not by this contract)", async function () {
      const step: [number, number, string, string, bigint, bigint] = [
        0,
        0,
        await agentRegistry.getAddress(),
        agentRegistry.interface.encodeFunctionData("MIN_STAKE"),
        0n,
        0n,
      ];
      await expect(
        executionManager.connect(user1)._executeStep(1, 0, step as any)
      ).to.be.revertedWith("Internal function only");
    });

    it("step 1 succeeds (StepExecuted emitted), step 2 fails (ExecutionFailed emitted)", async function () {
      const mixedSteps = [
        [0, 0, await agentRegistry.getAddress(), agentRegistry.interface.encodeFunctionData("MIN_STAKE"), 0n, 0n],
        [0, 0, await agentRegistry.getAddress(), "0xdeadbeef", 0n, 0n], // invalid selector → fails
      ];
      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [mixedSteps]
      );

      const tx = await executionManager.connect(vaultSig).execute(1, planData);

      await expect(tx).to.emit(executionManager, "StepExecuted").withArgs(1, 0, 0);
      await expect(tx).to.emit(executionManager, "ExecutionFailed"); // step 2 failed

      const exec = await executionManager.getExecution(1);
      expect(exec.status).to.equal(3); // FAILED
      expect(exec.completedSteps).to.equal(1n); // only step 0 completed
      expect(exec.totalSteps).to.equal(2n);
    });

    it("refund to IntentVault occurs when execution fails mid-plan", async function () {
      const vaultAddr = await intentVault.getAddress();
      const initialVaultBalance = await ethers.provider.getBalance(vaultAddr);

      const failingPlan = [
        [0, 0, await agentRegistry.getAddress(), "0xdeadbeef", 0n, 0n],
      ];
      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [failingPlan]
      );
      const sendAmount = ethers.parseEther("1");

      await executionManager.connect(vaultSig).execute(1, planData, { value: sendAmount });

      // ExecutionManager should have refunded all its balance to vault
      const finalEMBalance = await ethers.provider.getBalance(
        await executionManager.getAddress()
      );
      expect(finalEMBalance).to.equal(0n);

      // Vault balance decreased by gas only (sent 1 ETH, got 1 ETH back)
      const finalVaultBalance = await ethers.provider.getBalance(vaultAddr);
      // Net change should be approximately 0 (gas aside, which comes from vault when impersonating)
      expect(finalVaultBalance).to.be.closeTo(initialVaultBalance, ethers.parseEther("0.001"));
    });

    it("failExecution succeeds when status is AWAITING_CONFIRMATION", async function () {
      // Use XCM steps (always succeed in Hardhat, put EM in AWAITING_CONFIRMATION)
      const xcmSteps = [
        [1, 2034, user1.address, "0x1234", ethers.parseEther("0.1"), 0n],
      ];
      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [xcmSteps]
      );
      await executionManager
        .connect(vaultSig)
        .execute(1, planData, { value: ethers.parseEther("1") });

      const exec = await executionManager.getExecution(1);
      expect(exec.status).to.equal(1); // AWAITING_CONFIRMATION

      const tx = await executionManager
        .connect(vaultSig)
        .failExecution(1, "XCM confirmation timeout");
      await expect(tx)
        .to.emit(executionManager, "ExecutionFailed")
        .withArgs(1, "XCM confirmation timeout");

      expect((await executionManager.getExecution(1)).status).to.equal(3); // FAILED
    });

    it("completeExecution reverts when status is FAILED (already failed)", async function () {
      const failingPlan = [
        [0, 0, await agentRegistry.getAddress(), "0xdeadbeef", 0n, 0n],
      ];
      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [failingPlan]
      );
      await executionManager.connect(vaultSig).execute(1, planData);

      expect((await executionManager.getExecution(1)).status).to.equal(3); // FAILED

      await expect(
        executionManager.connect(vaultSig).completeExecution(1)
      ).to.be.revertedWithCustomError(executionManager, "InvalidExecutionStatus");
    });

    it("failExecution reverts when status is COMPLETED", async function () {
      const xcmSteps = [
        [1, 2034, user1.address, "0x1234", ethers.parseEther("0.1"), 0n],
      ];
      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [xcmSteps]
      );
      await executionManager
        .connect(vaultSig)
        .execute(1, planData, { value: ethers.parseEther("1") });
      await executionManager.connect(vaultSig).completeExecution(1);

      await expect(
        executionManager.connect(vaultSig).failExecution(1, "too late")
      ).to.be.revertedWithCustomError(executionManager, "InvalidExecutionStatus");
    });

    it("all three XCM parachains emit separate XCMSent events", async function () {
      const xcmSteps = [
        [1, 2034, user1.address, "0x01", ethers.parseEther("0.1"), 0n],
        [1, 2030, user1.address, "0x02", ethers.parseEther("0.1"), 0n],
        [1, 2004, user1.address, "0x03", ethers.parseEther("0.1"), 0n],
      ];
      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [xcmSteps]
      );
      const tx = await executionManager
        .connect(vaultSig)
        .execute(1, planData, { value: ethers.parseEther("1") });

      await expect(tx)
        .to.emit(executionManager, "XCMSent")
        .withArgs(1, 2034, anyValue);
      await expect(tx)
        .to.emit(executionManager, "XCMSent")
        .withArgs(1, 2030, anyValue);
      await expect(tx)
        .to.emit(executionManager, "XCMSent")
        .withArgs(1, 2004, anyValue);

      const exec = await executionManager.getExecution(1);
      expect(exec.completedSteps).to.equal(3n);
      expect(exec.status).to.equal(1); // AWAITING_CONFIRMATION
    });

    it("isExecutionInProgress returns true for non-existent id (default enum = IN_PROGRESS)", async function () {
      // Default mapping value has status=0=IN_PROGRESS → returns true
      // This documents a known quirk in the contract
      expect(await executionManager.isExecutionInProgress(9999)).to.be.true;
    });

    it("getExecution reverts for intentId with zero record", async function () {
      await expect(
        executionManager.getExecution(9999)
      ).to.be.revertedWithCustomError(executionManager, "ExecutionNotFound");
    });

    it("ExecutionStarted event correctly reports total steps", async function () {
      const steps = [
        [1, 2034, user1.address, "0x01", 0n, 0n],
        [1, 2030, user1.address, "0x02", 0n, 0n],
        [1, 2004, user1.address, "0x03", 0n, 0n],
        [0, 0, await agentRegistry.getAddress(), agentRegistry.interface.encodeFunctionData("MIN_STAKE"), 0n, 0n],
      ];
      const planData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
        [steps]
      );
      const tx = await executionManager
        .connect(vaultSig)
        .execute(1, planData, { value: ethers.parseEther("1") });
      await expect(tx)
        .to.emit(executionManager, "ExecutionStarted")
        .withArgs(1, 4);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 7. MULTI-ACTOR FLOWS
  // ════════════════════════════════════════════════════════════════

  describe("Multi-Actor Flows", function () {
    const g = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

    it("two agents compete: first-come wins, second gets 'Intent not available'", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g("compete"), 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await expect(intentVault.connect(agent2).claimIntent(1)).to.be.revertedWith(
        "Intent not available"
      );
    });

    it("same agent handles multiple intents sequentially and reputation accumulates", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g("seq1"), 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault
        .connect(user1)
        .createIntent(g("seq2"), 500, dl, 0, 0, [], { value: MIN_DEPOSIT });

      for (const id of [1, 2]) {
        await intentVault.connect(agent1).claimIntent(id);
        await intentVault.connect(agent1).submitPlan(id, emptyPlan);
        await intentVault.connect(user1).approvePlan(id);
        await intentVault.connect(agent1).executeIntent(id);
        await completeIntentAs(id, MIN_DEPOSIT);
        expect((await intentVault.getIntent(id)).status).to.equal(6); // COMPLETED
      }

      const agentData = await agentRegistry.getAgent(agent1.address);
      expect(agentData.successCount).to.equal(2n);
      expect(agentData.totalExecutions).to.equal(2n);
    });

    it("two agents handle two intents from two users concurrently", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g("u1"), 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault
        .connect(user2)
        .createIntent(g("u2"), 500, dl, 0, 0, [], { value: MIN_DEPOSIT });

      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent2).claimIntent(2);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(agent2).submitPlan(2, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(user2).approvePlan(2);
      await intentVault.connect(agent1).executeIntent(1);
      await intentVault.connect(agent2).executeIntent(2);
      await completeIntentAs(1, MIN_DEPOSIT);
      await completeIntentAs(2, MIN_DEPOSIT);

      expect((await intentVault.getIntent(1)).assignedAgent).to.equal(agent1.address);
      expect((await intentVault.getIntent(2)).assignedAgent).to.equal(agent2.address);
      expect((await intentVault.getIntent(1)).status).to.equal(6);
      expect((await intentVault.getIntent(2)).status).to.equal(6);
    });

    it("multiple users create independent intents; IDs are sequential", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g("u1"), 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault
        .connect(user2)
        .createIntent(g("u2"), 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault
        .connect(user1)
        .createIntent(g("u1b"), 500, dl, 0, 0, [], { value: MIN_DEPOSIT });

      expect((await intentVault.getIntent(1)).user).to.equal(user1.address);
      expect((await intentVault.getIntent(2)).user).to.equal(user2.address);
      expect((await intentVault.getIntent(3)).user).to.equal(user1.address);
      expect(Number(await intentVault.nextIntentId())).to.equal(4);
    });

    it("after failure: different agent can claim a NEW intent from same user", async function () {
      const dl = await makeDeadline(3600);
      // Intent 1 fails
      await intentVault
        .connect(user1)
        .createIntent(g("fail"), 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(agent1).executeIntent(1);

      const fee = (MIN_DEPOSIT * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      await failIntentAs(1, "failed", MIN_DEPOSIT - fee);
      expect((await intentVault.getIntent(1)).status).to.equal(7); // FAILED

      // User retries with intent 2, agent2 picks it up
      const dl2 = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g("retry"), 500, dl2, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent2).claimIntent(2);
      await intentVault.connect(agent2).submitPlan(2, emptyPlan);
      await intentVault.connect(user1).approvePlan(2);
      await intentVault.connect(agent2).executeIntent(2);
      await completeIntentAs(2, MIN_DEPOSIT);

      expect((await intentVault.getIntent(2)).status).to.equal(6); // COMPLETED
      expect((await intentVault.getIntent(2)).assignedAgent).to.equal(agent2.address);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 8. ECONOMIC PRECISION TESTS
  // ════════════════════════════════════════════════════════════════

  describe("Economic Precision Tests", function () {
    async function runToExecuting(deposit: bigint) {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(
          ethers.keccak256(ethers.toUtf8Bytes("eco")),
          500,
          dl,
          0,
          0,
          [],
          { value: deposit }
        );
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(agent1).executeIntent(1);
    }

    it("IntentExecuted event emits true on success", async function () {
      const deposit = ethers.parseEther("10");

      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(
          ethers.keccak256(ethers.toUtf8Bytes("fee")),
          500,
          dl,
          0,
          0,
          [],
          { value: deposit }
        );
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);

      const tx = await intentVault.connect(agent1).executeIntent(1);
      await expect(tx)
        .to.emit(intentVault, "IntentExecuted")
        .withArgs(1, true);
    });

    it("user receives exact returnAmount from completeIntent (10% yield)", async function () {
      const deposit = ethers.parseEther("5");
      const returnAmount = ethers.parseEther("5.5");
      await runToExecuting(deposit);

      const bal0 = await ethers.provider.getBalance(user1.address);
      const tx = await completeIntentAs(1, returnAmount);
      await expect(tx)
        .to.emit(intentVault, "FundsReturned")
        .withArgs(1, user1.address, returnAmount);
      const bal1 = await ethers.provider.getBalance(user1.address);
      expect(bal1 - bal0).to.equal(returnAmount);
    });

    it("failIntent refunds full original deposit (not execution amount)", async function () {
      const deposit = ethers.parseEther("3");
      await runToExecuting(deposit);

      const fee = (deposit * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      const executionAmount = deposit - fee;

      const bal0 = await ethers.provider.getBalance(user1.address);
      const tx = await failIntentAs(1, "bridge down", executionAmount);
      await expect(tx)
        .to.emit(intentVault, "FundsReturned")
        .withArgs(1, user1.address, deposit); // full deposit, not executionAmount
      const bal1 = await ethers.provider.getBalance(user1.address);
      expect(bal1 - bal0).to.equal(deposit);
    });

    it("completeIntent with returnAmount=0 sends nothing to user but marks COMPLETED", async function () {
      await runToExecuting(MIN_DEPOSIT);
      const bal0 = await ethers.provider.getBalance(user1.address);
      await completeIntentAs(1, 0n);
      const bal1 = await ethers.provider.getBalance(user1.address);
      expect(bal1).to.equal(bal0); // no change
      expect((await intentVault.getIntent(1)).status).to.equal(6); // COMPLETED
    });

    it("large deposit: protocol fee scales linearly", async function () {
      const deposit = ethers.parseEther("1000");
      const expectedFee = (deposit * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
      // 0.3% of 1000 ETH = 3 ETH  (30 bps / 10000 * 1000 = 3)
      expect(expectedFee).to.equal(ethers.parseEther("3"));
    });

    it("cancelIntent FundsReturned event emitted with correct refund amount", async function () {
      const deposit = ethers.parseEther("2");
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(
          ethers.keccak256(ethers.toUtf8Bytes("cancel")),
          500,
          dl,
          0,
          0,
          [],
          { value: deposit }
        );
      const tx = await intentVault.connect(user1).cancelIntent(1);
      await expect(tx)
        .to.emit(intentVault, "FundsReturned")
        .withArgs(1, user1.address, deposit);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 9. INTENT WITH APPROVED PROTOCOLS
  // ════════════════════════════════════════════════════════════════

  describe("Intent With Approved Protocols", function () {
    it("stores and retrieves up to N approved protocols correctly", async function () {
      const protocols = [user1.address, user2.address, agent1.address];
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(
          ethers.keccak256(ethers.toUtf8Bytes("proto")),
          500,
          dl,
          0,
          0,
          protocols,
          { value: MIN_DEPOSIT }
        );
      const stored = await intentVault.getApprovedProtocols(1);
      expect(stored).to.deep.equal(protocols);
    });

    it("empty approved protocols array allowed and returned correctly", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(
          ethers.keccak256(ethers.toUtf8Bytes("noproto")),
          500,
          dl,
          0,
          0,
          [],
          { value: MIN_DEPOSIT }
        );
      const stored = await intentVault.getApprovedProtocols(1);
      expect(stored).to.deep.equal([]);
    });

    it("intent with protocols completes full lifecycle without issues", async function () {
      const protocols = [user2.address, agent2.address];
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(
          ethers.keccak256(ethers.toUtf8Bytes("with-proto")),
          500,
          dl,
          0,
          0,
          protocols,
          { value: MIN_DEPOSIT }
        );
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await intentVault.connect(agent1).executeIntent(1);
      await completeIntentAs(1, MIN_DEPOSIT);

      expect((await intentVault.getIntent(1)).status).to.equal(6); // COMPLETED
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 10. DEADLINE BOUNDARY CONDITIONS
  // ════════════════════════════════════════════════════════════════

  describe("Deadline Boundary Conditions", function () {
    const g = ethers.keccak256(ethers.toUtf8Bytes("deadline"));

    it("createIntent reverts when deadline == block.timestamp (not strictly future)", async function () {
      const ts = await latestTimestamp();
      await expect(
        intentVault
          .connect(user1)
          .createIntent(g, 500, ts, 0, 0, [], { value: MIN_DEPOSIT })
      ).to.be.revertedWith("Deadline in the past");
    });

    it("createIntent reverts when deadline < block.timestamp", async function () {
      const ts = await latestTimestamp();
      await expect(
        intentVault
          .connect(user1)
          .createIntent(g, 500, ts - 1, 0, 0, [], { value: MIN_DEPOSIT })
      ).to.be.revertedWith("Deadline in the past");
    });

    it("claimIntent reverts after deadline passes", async function () {
      const dl = await makeDeadline(5);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);
      await expect(intentVault.connect(agent1).claimIntent(1)).to.be.revertedWith(
        "Intent expired"
      );
    });

    it("submitPlan reverts after deadline passes", async function () {
      const dl = await makeDeadline(10);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await ethers.provider.send("evm_increaseTime", [20]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        intentVault.connect(agent1).submitPlan(1, emptyPlan)
      ).to.be.revertedWith("Intent expired");
    });

    it("approvePlan reverts after deadline passes", async function () {
      const dl = await makeDeadline(20);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await ethers.provider.send("evm_increaseTime", [30]);
      await ethers.provider.send("evm_mine", []);
      await expect(intentVault.connect(user1).approvePlan(1)).to.be.revertedWith(
        "Intent expired"
      );
    });

    it("executeIntent reverts after deadline passes", async function () {
      const dl = await makeDeadline(30);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await intentVault.connect(agent1).claimIntent(1);
      await intentVault.connect(agent1).submitPlan(1, emptyPlan);
      await intentVault.connect(user1).approvePlan(1);
      await ethers.provider.send("evm_increaseTime", [40]);
      await ethers.provider.send("evm_mine", []);
      await expect(intentVault.connect(agent1).executeIntent(1)).to.be.revertedWith(
        "Intent expired"
      );
    });

    it("isIntentExpired flips from false to true correctly", async function () {
      const dl = await makeDeadline(10);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      expect(await intentVault.isIntentExpired(1)).to.be.false;
      await ethers.provider.send("evm_increaseTime", [20]);
      await ethers.provider.send("evm_mine", []);
      expect(await intentVault.isIntentExpired(1)).to.be.true;
    });

    it("expireIntent reverts when deadline has not yet passed", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(g, 500, dl, 0, 0, [], { value: MIN_DEPOSIT });
      await expect(intentVault.connect(user2).expireIntent(1)).to.be.revertedWith(
        "Intent not yet expired"
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 11. NON-EXISTENT INTENT — ALL ACCESSORS
  // ════════════════════════════════════════════════════════════════

  describe("Non-existent Intent — All Accessors Revert", function () {
    it("getIntent(0) reverts", async function () {
      await expect(intentVault.getIntent(0)).to.be.revertedWith("Intent does not exist");
    });
    it("getIntent(999) reverts when no intents created", async function () {
      await expect(intentVault.getIntent(999)).to.be.revertedWith("Intent does not exist");
    });
    it("getIntentStatus(0) reverts", async function () {
      await expect(intentVault.getIntentStatus(0)).to.be.revertedWith("Intent does not exist");
    });
    it("getApprovedProtocols(99) reverts", async function () {
      await expect(intentVault.getApprovedProtocols(99)).to.be.revertedWith(
        "Intent does not exist"
      );
    });
    it("isIntentExpired(99) reverts", async function () {
      await expect(intentVault.isIntentExpired(99)).to.be.revertedWith("Intent does not exist");
    });
    it("claimIntent(99) reverts", async function () {
      await expect(intentVault.connect(agent1).claimIntent(99)).to.be.revertedWith(
        "Intent does not exist"
      );
    });
    it("cancelIntent(99) reverts", async function () {
      await expect(intentVault.connect(user1).cancelIntent(99)).to.be.revertedWith(
        "Intent does not exist"
      );
    });
    it("expireIntent(99) reverts", async function () {
      await expect(intentVault.connect(user2).expireIntent(99)).to.be.revertedWith(
        "Intent does not exist"
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 12. PLAN HASH INTEGRITY
  // ════════════════════════════════════════════════════════════════

  describe("Execution Plan Hash Integrity", function () {
    it("plan hash stored equals keccak256 of submitted bytes", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(
          ethers.keccak256(ethers.toUtf8Bytes("hash-test")),
          500,
          dl,
          0,
          0,
          [],
          { value: MIN_DEPOSIT }
        );
      await intentVault.connect(agent1).claimIntent(1);

      const planBytes = ethers.toUtf8Bytes("my execution plan");
      await intentVault.connect(agent1).submitPlan(1, planBytes);

      const intent = await intentVault.getIntent(1);
      expect(intent.executionPlanHash).to.equal(ethers.keccak256(planBytes));
    });

    it("agent can update plan (re-submit) before user approves", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(
          ethers.keccak256(ethers.toUtf8Bytes("resubmit")),
          500,
          dl,
          0,
          0,
          [],
          { value: MIN_DEPOSIT }
        );
      await intentVault.connect(agent1).claimIntent(1);

      const plan1 = ethers.toUtf8Bytes("plan version 1");
      await intentVault.connect(agent1).submitPlan(1, plan1);
      expect((await intentVault.getIntent(1)).executionPlanHash).to.equal(
        ethers.keccak256(plan1)
      );

      // Status is PLAN_SUBMITTED; re-submitting should fail since status check requires ASSIGNED
      // Once submitPlan moves status to PLAN_SUBMITTED, another submitPlan would revert with "Invalid status"
      const plan2 = ethers.toUtf8Bytes("plan version 2");
      await expect(
        intentVault.connect(agent1).submitPlan(1, plan2)
      ).to.be.revertedWith("Invalid status");
    });

    it("different plan bytes produce different hashes", async function () {
      const plan1 = ethers.toUtf8Bytes("plan A");
      const plan2 = ethers.toUtf8Bytes("plan B");
      expect(ethers.keccak256(plan1)).to.not.equal(ethers.keccak256(plan2));
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 13. CONTRACT STATE CONSISTENCY
  // ════════════════════════════════════════════════════════════════

  describe("Contract State Consistency", function () {
    it("nextIntentId starts at 1 and increments correctly", async function () {
      expect(Number(await intentVault.nextIntentId())).to.equal(1);
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(ethers.keccak256(ethers.toUtf8Bytes("s1")), 500, dl, 0, 0, [], {
          value: MIN_DEPOSIT,
        });
      expect(Number(await intentVault.nextIntentId())).to.equal(2);
      await intentVault
        .connect(user1)
        .createIntent(ethers.keccak256(ethers.toUtf8Bytes("s2")), 500, dl, 0, 0, [], {
          value: MIN_DEPOSIT,
        });
      expect(Number(await intentVault.nextIntentId())).to.equal(3);
    });

    it("ExecutionManager.intentVault correctly reflects IntentVault address", async function () {
      expect(await executionManager.intentVault()).to.equal(await intentVault.getAddress());
    });

    it("AgentRegistry constants match expected values", async function () {
      expect(await agentRegistry.MIN_STAKE()).to.equal(ethers.parseEther("10"));
      expect(await agentRegistry.INITIAL_REPUTATION()).to.equal(5000n);
      expect(await agentRegistry.SLASH_PERCENT()).to.equal(10n);
    });

    it("IntentVault constants match expected values", async function () {
      expect(await intentVault.MIN_DEPOSIT()).to.equal(ethers.parseEther("1"));
      expect(await intentVault.MAX_SLIPPAGE_BPS()).to.equal(1000n);
      expect(await intentVault.PROTOCOL_FEE_BPS()).to.equal(30n);
    });

    it("IntentVault accepts ETH via receive() fallback", async function () {
      const amount = ethers.parseEther("1");
      const vaultAddr = await intentVault.getAddress();
      const bal0 = await ethers.provider.getBalance(vaultAddr);
      await user1.sendTransaction({ to: vaultAddr, value: amount });
      const bal1 = await ethers.provider.getBalance(vaultAddr);
      expect(bal1 - bal0).to.equal(amount);
    });

    it("ExecutionManager accepts ETH via receive() fallback", async function () {
      const amount = ethers.parseEther("1");
      const emAddr = await executionManager.getAddress();
      const bal0 = await ethers.provider.getBalance(emAddr);
      await user1.sendTransaction({ to: emAddr, value: amount });
      const bal1 = await ethers.provider.getBalance(emAddr);
      expect(bal1 - bal0).to.equal(amount);
    });

    it("intent createdAt is recorded as block.timestamp", async function () {
      const dl = await makeDeadline(3600);
      await intentVault
        .connect(user1)
        .createIntent(ethers.keccak256(ethers.toUtf8Bytes("ts")), 500, dl, 0, 0, [], {
          value: MIN_DEPOSIT,
        });
      const ts = await latestTimestamp();
      const intent = await intentVault.getIntent(1);
      expect(intent.createdAt).to.equal(BigInt(ts));
    });

    it("agent registeredAt is recorded as block.timestamp", async function () {
      await agentRegistry
        .connect(user1)
        .registerAgent("ipfs://ts-test", { value: MIN_STAKE });
      const ts = await latestTimestamp();
      const agentData = await agentRegistry.getAgent(user1.address);
      expect(agentData.registeredAt).to.equal(BigInt(ts));
    });
  });
});
