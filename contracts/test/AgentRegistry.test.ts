import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { setupTest, MIN_STAKE, INITIAL_REPUTATION, SLASH_PERCENT } from "./setup";
describe("AgentRegistry", function () {
  let agentRegistry: AgentRegistry;
  let deployer: SignerWithAddress;
  let agent1: SignerWithAddress;
  let agent2: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async function () {
    const setup = await setupTest();
    deployer = setup.deployer;
    agent1 = setup.agent1;
    agent2 = setup.agent2;
    user1 = setup.user1;

    // Deploy AgentRegistry
    const AgentRegistryFactory = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistryFactory.deploy();
    await agentRegistry.waitForDeployment();

    // Set deployer as the intentVault so reputation management tests can call recordSuccess/recordFailure
    await agentRegistry.setIntentVault(deployer.address);
  });

  describe("Agent Registration", function () {
    it("should register agent with valid stake and metadata", async function () {
      const metadataURI = "ipfs://QmTest123";
      const stakeAmount = MIN_STAKE;

      const tx = await agentRegistry.connect(agent1).registerAgent(metadataURI, {
        value: stakeAmount
      });

      await expect(tx)
        .to.emit(agentRegistry, "AgentRegistered")
        .withArgs(agent1.address, stakeAmount, metadataURI);

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.stakeAmount).to.equal(stakeAmount);
      expect(agent.reputationScore).to.equal(INITIAL_REPUTATION);
      expect(agent.successCount).to.equal(0);
      expect(agent.failCount).to.equal(0);
      expect(agent.totalExecutions).to.equal(0);
      expect(agent.isActive).to.be.true;
      expect(agent.metadataURI).to.equal(metadataURI);
      expect(agent.registeredAt).to.be.greaterThan(0);
    });

    it("should revert with insufficient stake", async function () {
      const metadataURI = "ipfs://QmTest123";
      const insufficientStake = ethers.parseEther("5"); // Less than MIN_STAKE

      await expect(
        agentRegistry.connect(agent1).registerAgent(metadataURI, {
          value: insufficientStake
        })
      ).to.be.revertedWith("Insufficient stake amount");
    });

    it("should revert with empty metadata URI", async function () {
      await expect(
        agentRegistry.connect(agent1).registerAgent("", {
          value: MIN_STAKE
        })
      ).to.be.revertedWith("Metadata URI required");
    });

    it("should revert if agent already registered", async function () {
      const metadataURI = "ipfs://QmTest123";

      await agentRegistry.connect(agent1).registerAgent(metadataURI, {
        value: MIN_STAKE
      });

      await expect(
        agentRegistry.connect(agent1).registerAgent(metadataURI, {
          value: MIN_STAKE
        })
      ).to.be.revertedWith("Agent already registered");
    });

    it("should allow registration with stake above minimum", async function () {
      const metadataURI = "ipfs://QmTest123";
      const largeStake = ethers.parseEther("50");

      await expect(
        agentRegistry.connect(agent1).registerAgent(metadataURI, {
          value: largeStake
        })
      ).to.not.be.reverted;

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.stakeAmount).to.equal(largeStake);
    });
  });

  describe("Reputation Management", function () {
    beforeEach(async function () {
      // Register agents
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", {
        value: ethers.parseEther("20") // Use higher stake so agent stays active after one slash
      });
      await agentRegistry.connect(agent2).registerAgent("ipfs://agent2", {
        value: ethers.parseEther("20")
      });
    });

    it("should increase reputation on success", async function () {
      const initialReputation = INITIAL_REPUTATION;

      // Calculate expected reputation increase
      const expectedIncrease = ((10000 - initialReputation) * 100) / 10000;
      const expectedNewReputation = initialReputation + expectedIncrease;

      const tx = await agentRegistry.recordSuccess(agent1.address, 0n);

      await expect(tx)
        .to.emit(agentRegistry, "ReputationUpdated")
        .withArgs(agent1.address, expectedNewReputation);

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.reputationScore).to.equal(expectedNewReputation);
      expect(agent.successCount).to.equal(1);
      expect(agent.totalExecutions).to.equal(1);
    });

    it("should decrease reputation and slash stake on failure", async function () {
      const initialStake = ethers.parseEther("20"); // Matches updated beforeEach registration
      const initialReputation = BigInt(INITIAL_REPUTATION);

      // Calculate expected values using BigInt arithmetic (mirrors Solidity integer division)
      const expectedSlashAmount = (initialStake * BigInt(SLASH_PERCENT)) / 100n;
      const expectedNewStake = initialStake - expectedSlashAmount;
      const expectedNewReputation = (initialReputation * 85n) / 100n;

      await expect(agentRegistry.recordFailure(agent1.address))
        .to.emit(agentRegistry, "AgentSlashed")
        .withArgs(agent1.address, expectedSlashAmount)
        .and.to.emit(agentRegistry, "ReputationUpdated")
        .withArgs(agent1.address, expectedNewReputation);

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.stakeAmount).to.equal(expectedNewStake);
      expect(agent.reputationScore).to.equal(expectedNewReputation);
      expect(agent.failCount).to.equal(1);
      expect(agent.totalExecutions).to.equal(1);
      expect(agent.isActive).to.be.true; // Still above minimum stake
    });

    it("should deactivate agent when stake falls below minimum", async function () {
      // Register agent with stake just above minimum
      const lowStake = ethers.parseEther("10.5");
      await agentRegistry.connect(user1).registerAgent("ipfs://lowstake", {
        value: lowStake
      });

      // Record failure to slash stake
      const tx = await agentRegistry.recordFailure(user1.address);

      await expect(tx)
        .to.emit(agentRegistry, "AgentDeactivated")
        .withArgs(user1.address);

      const agent = await agentRegistry.getAgent(user1.address);
      expect(agent.isActive).to.be.false;
      expect(agent.stakeAmount).to.be.lessThan(MIN_STAKE);
    });

    it("should maintain execution counter invariant", async function () {
      // Record multiple successes and failures
      await agentRegistry.recordSuccess(agent1.address, 0n);
      await agentRegistry.recordSuccess(agent1.address, 0n);
      await agentRegistry.recordFailure(agent1.address);
      await agentRegistry.recordSuccess(agent1.address, 0n);

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.totalExecutions).to.equal(agent.successCount + agent.failCount);
      expect(agent.successCount).to.equal(3);
      expect(agent.failCount).to.equal(1);
      expect(agent.totalExecutions).to.equal(4);
    });

    it("should handle multiple reputation updates correctly", async function () {
      let currentReputation = BigInt(INITIAL_REPUTATION);

      // Record success — mirrors Solidity: newRep = oldRep + ((10000 - oldRep) * 100 / 10000)
      await agentRegistry.recordSuccess(agent1.address, 0n);
      currentReputation = currentReputation + ((10000n - currentReputation) * 100n) / 10000n;

      // Record failure — mirrors Solidity: newRep = oldRep * 85 / 100
      await agentRegistry.recordFailure(agent1.address);
      currentReputation = (currentReputation * 85n) / 100n;

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.reputationScore).to.equal(currentReputation);
    });
  });

  describe("Agent Status and Queries", function () {
    beforeEach(async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", {
        value: MIN_STAKE
      });
      await agentRegistry.connect(agent2).registerAgent("ipfs://agent2", {
        value: ethers.parseEther("20")
      });
    });

    it("should correctly identify active agents", async function () {
      expect(await agentRegistry.isActiveAgent(agent1.address)).to.be.true;
      expect(await agentRegistry.isActiveAgent(agent2.address)).to.be.true;
      expect(await agentRegistry.isActiveAgent(user1.address)).to.be.false; // Not registered
    });

    it("should correctly identify inactive agents", async function () {
      // Slash agent1 multiple times to deactivate
      await agentRegistry.recordFailure(agent1.address);
      await agentRegistry.recordFailure(agent1.address);
      await agentRegistry.recordFailure(agent1.address);

      expect(await agentRegistry.isActiveAgent(agent1.address)).to.be.false;
    });

    it("should return correct agent information", async function () {
      const agent = await agentRegistry.getAgent(agent1.address);

      expect(agent.stakeAmount).to.equal(MIN_STAKE);
      expect(agent.reputationScore).to.equal(INITIAL_REPUTATION);
      expect(agent.isActive).to.be.true;
      expect(agent.metadataURI).to.equal("ipfs://agent1");
    });

    it("should return correct reputation score", async function () {
      expect(await agentRegistry.getAgentReputation(agent1.address)).to.equal(INITIAL_REPUTATION);
    });

    it("should return correct stake amount", async function () {
      expect(await agentRegistry.getAgentStake(agent1.address)).to.equal(MIN_STAKE);
      expect(await agentRegistry.getAgentStake(agent2.address)).to.equal(ethers.parseEther("20"));
    });
  });

  describe("Access Control", function () {
    beforeEach(async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", {
        value: MIN_STAKE
      });
    });

    it("should allow IntentVault (deployer) to record success", async function () {
      // deployer IS the intentVault (set in outer beforeEach)
      await expect(
        agentRegistry.recordSuccess(agent1.address, 0n)
      ).to.not.be.reverted;
    });

    it("should revert when non-IntentVault tries to record success", async function () {
      await expect(
        agentRegistry.connect(user1).recordSuccess(agent1.address, 0n)
      ).to.be.revertedWith("Only IntentVault");
    });

    it("should allow IntentVault (deployer) to record failure", async function () {
      // deployer IS the intentVault (set in outer beforeEach)
      await expect(
        agentRegistry.recordFailure(agent1.address)
      ).to.not.be.reverted;
    });

    it("should revert when non-IntentVault tries to record failure", async function () {
      await expect(
        agentRegistry.connect(user1).recordFailure(agent1.address)
      ).to.be.revertedWith("Only IntentVault");
    });

    it("should revert when recording success for unregistered agent", async function () {
      await expect(
        agentRegistry.recordSuccess(user1.address, 0n)
      ).to.be.revertedWith("Agent not registered");
    });

    it("should revert when recording failure for unregistered agent", async function () {
      await expect(
        agentRegistry.recordFailure(user1.address)
      ).to.be.revertedWith("Agent not registered");
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero reputation correctly", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", {
        value: MIN_STAKE
      });

      // Slash reputation to very low value
      for (let i = 0; i < 10; i++) {
        await agentRegistry.recordFailure(agent1.address);
      }

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.reputationScore).to.be.greaterThanOrEqual(0);
    });

    it("should handle maximum reputation correctly", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", {
        value: MIN_STAKE
      });

      // Increase reputation multiple times
      for (let i = 0; i < 20; i++) {
        await agentRegistry.recordSuccess(agent1.address, 0n);
      }

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.reputationScore).to.be.lessThanOrEqual(10000);
    });

    it("should handle large stake amounts", async function () {
      const largeStake = ethers.parseEther("1000");

      await expect(
        agentRegistry.connect(agent1).registerAgent("ipfs://agent1", {
          value: largeStake
        })
      ).to.not.be.reverted;

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.stakeAmount).to.equal(largeStake);
    });

    it("should handle long metadata URIs", async function () {
      const longURI = "ipfs://" + "a".repeat(1000);

      await expect(
        agentRegistry.connect(agent1).registerAgent(longURI, {
          value: MIN_STAKE
        })
      ).to.not.be.reverted;

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.metadataURI).to.equal(longURI);
    });
  });

  describe("Gas Optimization", function () {
    it("should not exceed reasonable gas limits for registration", async function () {
      const tx = await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", {
        value: MIN_STAKE
      });

      const receipt = await tx.wait();
      expect(receipt!.gasUsed).to.be.lessThan(200000); // Reasonable gas limit
    });

    it("should not exceed reasonable gas limits for reputation updates", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", {
        value: MIN_STAKE
      });

      const tx = await agentRegistry.recordSuccess(agent1.address, 0n);
      const receipt = await tx.wait();
      expect(receipt!.gasUsed).to.be.lessThan(100000); // Reasonable gas limit
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // agentList enumeration
  // ─────────────────────────────────────────────────────────────────────────────
  describe("agentList enumeration", function () {
    it("agentList is empty before any registration", async function () {
      const count = await agentRegistry.getAgentCount();
      expect(count).to.equal(0n);
    });

    it("agentList grows when agents register", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
      expect(await agentRegistry.getAgentCount()).to.equal(1n);

      await agentRegistry.connect(agent2).registerAgent("ipfs://agent2", { value: MIN_STAKE });
      expect(await agentRegistry.getAgentCount()).to.equal(2n);
    });

    it("agentList[0] equals the first registered agent address", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
      const addr = await agentRegistry.agentList(0);
      expect(addr).to.equal(agent1.address);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // addStake
  // ─────────────────────────────────────────────────────────────────────────────
  describe("addStake", function () {
    beforeEach(async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
    });

    it("increases stakeAmount by msg.value", async function () {
      const extra = ethers.parseEther("5");
      await agentRegistry.connect(agent1).addStake({ value: extra });
      const info = await agentRegistry.getAgent(agent1.address);
      expect(info.stakeAmount).to.equal(MIN_STAKE + extra);
    });

    it("emits StakeAdded with correct args", async function () {
      const extra = ethers.parseEther("5");
      await expect(agentRegistry.connect(agent1).addStake({ value: extra }))
        .to.emit(agentRegistry, "StakeAdded")
        .withArgs(agent1.address, extra);
    });

    it("reverts if agent is not registered", async function () {
      await expect(
        agentRegistry.connect(user1).addStake({ value: ethers.parseEther("5") })
      ).to.be.revertedWith("Agent not registered");
    });

    it("reverts if sending 0 ETH", async function () {
      await expect(
        agentRegistry.connect(agent1).addStake({ value: 0n })
      ).to.be.revertedWith("Must send ETH");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // withdrawStake
  // ─────────────────────────────────────────────────────────────────────────────
  describe("withdrawStake", function () {
    const registrationStake = ethers.parseEther("20"); // above MIN_STAKE

    beforeEach(async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: registrationStake });
    });

    it("decreases stakeAmount by the withdrawn amount", async function () {
      const withdraw = ethers.parseEther("5");
      await agentRegistry.connect(agent1).withdrawStake(withdraw);
      const info = await agentRegistry.getAgent(agent1.address);
      expect(info.stakeAmount).to.equal(registrationStake - withdraw);
    });

    it("emits StakeWithdrawn with correct args", async function () {
      const withdraw = ethers.parseEther("5");
      await expect(agentRegistry.connect(agent1).withdrawStake(withdraw))
        .to.emit(agentRegistry, "StakeWithdrawn")
        .withArgs(agent1.address, withdraw);
    });

    it("sends ETH to agent", async function () {
      const withdraw = ethers.parseEther("5");
      const balanceBefore = await ethers.provider.getBalance(agent1.address);
      const tx = await agentRegistry.connect(agent1).withdrawStake(withdraw);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(agent1.address);
      expect(balanceAfter).to.equal(balanceBefore + withdraw - gasCost);
    });

    it("auto-deactivates agent when remaining stake falls below MIN_STAKE", async function () {
      // Withdraw enough to leave < MIN_STAKE
      const withdraw = registrationStake - MIN_STAKE + ethers.parseEther("1");
      await expect(agentRegistry.connect(agent1).withdrawStake(withdraw))
        .to.emit(agentRegistry, "AgentDeactivated")
        .withArgs(agent1.address);

      const info = await agentRegistry.getAgent(agent1.address);
      expect(info.isActive).to.be.false;
    });

    it("does NOT deactivate when remaining stake is exactly MIN_STAKE", async function () {
      const withdraw = registrationStake - MIN_STAKE;
      await agentRegistry.connect(agent1).withdrawStake(withdraw);
      const info = await agentRegistry.getAgent(agent1.address);
      expect(info.isActive).to.be.true;
    });

    it("reverts when withdrawing more than stake", async function () {
      await expect(
        agentRegistry.connect(agent1).withdrawStake(registrationStake + 1n)
      ).to.be.revertedWith("Insufficient stake");
    });

    it("reverts if agent is not registered", async function () {
      await expect(
        agentRegistry.connect(user1).withdrawStake(ethers.parseEther("1"))
      ).to.be.revertedWith("Agent not registered");
    });

    it("reverts when withdrawing 0 amount", async function () {
      await expect(
        agentRegistry.connect(agent1).withdrawStake(0n)
      ).to.be.revertedWith("Amount must be positive");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // deactivate
  // ─────────────────────────────────────────────────────────────────────────────
  describe("deactivate", function () {
    beforeEach(async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
    });

    it("sets isActive to false", async function () {
      await agentRegistry.connect(agent1).deactivate();
      const info = await agentRegistry.getAgent(agent1.address);
      expect(info.isActive).to.be.false;
    });

    it("emits AgentDeactivated", async function () {
      await expect(agentRegistry.connect(agent1).deactivate())
        .to.emit(agentRegistry, "AgentDeactivated")
        .withArgs(agent1.address);
    });

    it("isActiveAgent returns false after deactivation", async function () {
      await agentRegistry.connect(agent1).deactivate();
      expect(await agentRegistry.isActiveAgent(agent1.address)).to.be.false;
    });

    it("reverts if agent is not registered", async function () {
      await expect(agentRegistry.connect(user1).deactivate())
        .to.be.revertedWith("Agent not registered");
    });

    it("reverts if already inactive", async function () {
      await agentRegistry.connect(agent1).deactivate();
      await expect(agentRegistry.connect(agent1).deactivate())
        .to.be.revertedWith("Already inactive");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // reactivate
  // ─────────────────────────────────────────────────────────────────────────────
  describe("reactivate", function () {
    beforeEach(async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
      await agentRegistry.connect(agent1).deactivate();
    });

    it("sets isActive to true", async function () {
      await agentRegistry.connect(agent1).reactivate();
      const info = await agentRegistry.getAgent(agent1.address);
      expect(info.isActive).to.be.true;
    });

    it("isActiveAgent returns true after reactivation", async function () {
      await agentRegistry.connect(agent1).reactivate();
      expect(await agentRegistry.isActiveAgent(agent1.address)).to.be.true;
    });

    it("emits ReputationUpdated on reactivation", async function () {
      await expect(agentRegistry.connect(agent1).reactivate())
        .to.emit(agentRegistry, "ReputationUpdated");
    });

    it("reverts if agent is not registered", async function () {
      await expect(agentRegistry.connect(user1).reactivate())
        .to.be.revertedWith("Agent not registered");
    });

    it("reverts if already active", async function () {
      await agentRegistry.connect(agent1).reactivate(); // reactivate first
      await expect(agentRegistry.connect(agent1).reactivate())
        .to.be.revertedWith("Already active");
    });

    it("reverts if stake is below MIN_STAKE after withdrawal", async function () {
      // Re-register with stake just at MIN_STAKE, withdraw slightly, try to reactivate
      await agentRegistry.connect(agent2).registerAgent("ipfs://agent2", { value: MIN_STAKE });
      await agentRegistry.connect(agent2).deactivate();
      // Withdraw 1 wei to drop below MIN_STAKE
      await agentRegistry.connect(agent2).withdrawStake(1n);
      await expect(agentRegistry.connect(agent2).reactivate())
        .to.be.revertedWith("Stake below minimum");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getAgentCount
  // ─────────────────────────────────────────────────────────────────────────────
  describe("getAgentCount", function () {
    it("returns 0 with no registered agents", async function () {
      expect(await agentRegistry.getAgentCount()).to.equal(0n);
    });

    it("returns 1 after one registration", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
      expect(await agentRegistry.getAgentCount()).to.equal(1n);
    });

    it("returns 2 after two registrations", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
      await agentRegistry.connect(agent2).registerAgent("ipfs://agent2", { value: MIN_STAKE });
      expect(await agentRegistry.getAgentCount()).to.equal(2n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getActiveAgents
  // ─────────────────────────────────────────────────────────────────────────────
  describe("getActiveAgents", function () {
    it("returns empty array when no agents are registered", async function () {
      const active = await agentRegistry.getActiveAgents();
      expect(active.length).to.equal(0);
    });

    it("returns both agents when both are active", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
      await agentRegistry.connect(agent2).registerAgent("ipfs://agent2", { value: MIN_STAKE });
      const active = await agentRegistry.getActiveAgents();
      expect(active.length).to.equal(2);
      expect(active).to.include(agent1.address);
      expect(active).to.include(agent2.address);
    });

    it("excludes deactivated agent", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
      await agentRegistry.connect(agent2).registerAgent("ipfs://agent2", { value: MIN_STAKE });
      await agentRegistry.connect(agent1).deactivate();

      const active = await agentRegistry.getActiveAgents();
      expect(active.length).to.equal(1);
      expect(active).to.include(agent2.address);
      expect(active).to.not.include(agent1.address);
    });

    it("excludes agent with stake below MIN_STAKE after withdrawal", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: ethers.parseEther("20") });
      // Withdraw enough to go below MIN_STAKE (auto-deactivates)
      await agentRegistry.connect(agent1).withdrawStake(ethers.parseEther("15"));
      const active = await agentRegistry.getActiveAgents();
      expect(active.length).to.equal(0);
    });

    it("returns agent again after reactivation", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
      await agentRegistry.connect(agent1).deactivate();
      expect((await agentRegistry.getActiveAgents()).length).to.equal(0);

      await agentRegistry.connect(agent1).reactivate();
      const active = await agentRegistry.getActiveAgents();
      expect(active.length).to.equal(1);
      expect(active[0]).to.equal(agent1.address);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getTopAgents (fixed from stub)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("getTopAgents (fixed)", function () {
    it("returns empty array when no agents registered", async function () {
      const top = await agentRegistry.getTopAgents(3);
      expect(top.length).to.equal(0);
    });

    it("returns single agent when n=1 and 1 agent registered", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
      const top = await agentRegistry.getTopAgents(1);
      expect(top.length).to.equal(1);
      expect(top[0]).to.equal(agent1.address);
    });

    it("returns agent with higher reputation first", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
      await agentRegistry.connect(agent2).registerAgent("ipfs://agent2", { value: MIN_STAKE });
      // Give agent1 a success (higher rep)
      await agentRegistry.recordSuccess(agent1.address, 0n);

      const top = await agentRegistry.getTopAgents(2);
      expect(top[0]).to.equal(agent1.address); // agent1 has higher rep
      expect(top[1]).to.equal(agent2.address);
    });

    it("caps at actual agent count when n > registered count", async function () {
      await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", { value: MIN_STAKE });
      const top = await agentRegistry.getTopAgents(10);
      expect(top.length).to.equal(1);
    });
  });
});
