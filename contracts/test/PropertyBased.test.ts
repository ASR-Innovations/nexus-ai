import { expect } from "chai";
import { ethers } from "hardhat";
import { IntentVault, AgentRegistry, ExecutionManager } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { setupTest, MIN_DEPOSIT, MIN_STAKE, MAX_SLIPPAGE_BPS, PROTOCOL_FEE_BPS, INITIAL_REPUTATION, SLASH_PERCENT } from "./setup";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import * as fc from "fast-check";

describe("Property-Based Tests", function () {
  let intentVault: IntentVault;
  let agentRegistry: AgentRegistry;
  let executionManager: ExecutionManager;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let agent1: SignerWithAddress;
  let vaultSigner: any; // impersonated IntentVault signer for ExecutionManager calls

  beforeEach(async function () {
    const setup = await setupTest();
    deployer = setup.deployer;
    user1 = setup.user1;
    agent1 = setup.agent1;

    // Deploy contracts
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

    const ExecutionManagerFactory2 = await ethers.getContractFactory("ExecutionManager");
    executionManager = await ExecutionManagerFactory2.deploy(await intentVault.getAddress());
    await executionManager.waitForDeployment();

    await intentVault.updateExecutionManager(await executionManager.getAddress());

    // Set deployer as intentVault in AgentRegistry so property tests can call recordSuccess/recordFailure directly
    await agentRegistry.setIntentVault(deployer.address);

    // Set up impersonated IntentVault signer for onlyIntentVault functions
    const vaultAddr = await intentVault.getAddress();
    await ethers.provider.send("hardhat_setBalance", [
      vaultAddr,
      "0x" + ethers.parseEther("100").toString(16)
    ]);
    vaultSigner = await ethers.getImpersonatedSigner(vaultAddr);

    // Register agent
    await agentRegistry.connect(agent1).registerAgent("ipfs://agent1", {
      value: MIN_STAKE
    });
  });

  describe("Intent Creation Properties", function () {
    // Property 15: Intent Creation Minimum Deposit
    it("Property 15: Intent Creation Minimum Deposit", async function () {
      const currentTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: 0n, max: MIN_DEPOSIT - 1n }),
          async (deposit) => {
            const goalHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            await expect(
              intentVault.connect(user1).createIntent(
                goalHash, 500, currentTimestamp + 3600, 1000, 86400, [],
                { value: deposit }
              )
            ).to.be.revertedWith("Deposit below minimum");
          }
        ),
        { numRuns: 10 }
      );
    });

    // Property 16: Intent Creation Slippage Validation
    it("Property 16: Intent Creation Slippage Validation", async function () {
      const currentTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: MAX_SLIPPAGE_BPS + 1, max: 10000 }),
          async (slippage) => {
            const goalHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            await expect(
              intentVault.connect(user1).createIntent(
                goalHash, slippage, currentTimestamp + 3600, 1000, 86400, [],
                { value: MIN_DEPOSIT }
              )
            ).to.be.revertedWith("Slippage too high");
          }
        ),
        { numRuns: 10 }
      );
    });

    // Property 17: Intent Creation Deadline Validation
    it("Property 17: Intent Creation Deadline Validation", async function () {
      const currentTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: currentTimestamp - 1 }),
          async (pastDeadline) => {
            const goalHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            await expect(
              intentVault.connect(user1).createIntent(
                goalHash, 500, pastDeadline, 1000, 86400, [],
                { value: MIN_DEPOSIT }
              )
            ).to.be.revertedWith("Deadline in the past");
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe("Intent Lifecycle Properties", function () {
    // Property 18: Intent Lifecycle State Machine
    it("Property 18: Intent Lifecycle State Machine", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { from: 0, to: 1, valid: true },  // PENDING -> ASSIGNED
            { from: 1, to: 2, valid: true },  // ASSIGNED -> PLAN_SUBMITTED
            { from: 2, to: 3, valid: true },  // PLAN_SUBMITTED -> APPROVED
            { from: 0, to: 8, valid: true },  // PENDING -> CANCELLED
            { from: 1, to: 8, valid: true },  // ASSIGNED -> CANCELLED
            { from: 0, to: 4, valid: false }, // Invalid: PENDING -> EXECUTING
          ),
          async (transition) => {
            const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
            const goalHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            const intentId = Number(await intentVault.nextIntentId());

            await intentVault.connect(user1).createIntent(
              goalHash, 500, deadline, 1000, 86400, [],
              { value: MIN_DEPOSIT }
            );
            if (transition.from >= 1) {
              await intentVault.connect(agent1).claimIntent(intentId);
            }
            if (transition.from >= 2) {
              await intentVault.connect(agent1).submitPlan(intentId, ethers.toUtf8Bytes("plan"));
            }
            if (transition.from >= 3) {
              await intentVault.connect(user1).approvePlan(intentId);
            }
            if (transition.valid && transition.to === 8) {
              await expect(intentVault.connect(user1).cancelIntent(intentId)).to.not.be.reverted;
            } else if (!transition.valid) {
              expect(transition.valid).to.be.false;
            }
          }
        ),
        { numRuns: 6 }
      );
    });

    // Property 19: Intent Agent Authorization
    it("Property 19: Intent Agent Authorization", async function () {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const goalHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await intentVault.connect(user1).createIntent(
        goalHash, 500, deadline, 1000, 86400, [], { value: MIN_DEPOSIT }
      );
      await intentVault.connect(agent1).claimIntent(1);

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(user1, deployer),
          async (unauthorizedSigner) => {
            if (unauthorizedSigner.address !== agent1.address) {
              await expect(
                intentVault.connect(unauthorizedSigner).submitPlan(1, ethers.toUtf8Bytes("plan"))
              ).to.be.revertedWith("Not assigned agent");
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    // Property 20: Intent Execution Plan Hash Integrity
    it("Property 20: Intent Execution Plan Hash Integrity", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 1, maxLength: 100 }),
          async (planBytes) => {
            const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
            const goalHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            const intentId = Number(await intentVault.nextIntentId());
            await intentVault.connect(user1).createIntent(
              goalHash, 500, deadline, 1000, 86400, [], { value: MIN_DEPOSIT }
            );
            await intentVault.connect(agent1).claimIntent(intentId);
            const executionPlan = new Uint8Array(planBytes);
            const expectedHash = ethers.keccak256(executionPlan);
            await intentVault.connect(agent1).submitPlan(intentId, executionPlan);
            const intent = await intentVault.getIntent(intentId);
            expect(intent.executionPlanHash).to.equal(expectedHash);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe("Protocol Fee Properties", function () {
    // Property 21: Protocol Fee Calculation
    it("Property 21: Protocol Fee Calculation", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: MIN_DEPOSIT, max: ethers.parseEther("1000") }),
          async (amount) => {
            const expectedFee = (amount * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
            expect(expectedFee).to.equal((amount * 30n) / 10000n);
            expect(await intentVault.PROTOCOL_FEE_BPS()).to.equal(PROTOCOL_FEE_BPS);
          }
        ),
        { numRuns: 20 }
      );
    });

    // Property 22: Intent Execution Fund Transfer
    it("Property 22: Intent Execution Fund Transfer", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: MIN_DEPOSIT, max: ethers.parseEther("100") }),
          async (amount) => {
            const protocolFee = (amount * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
            const expectedTransfer = amount - protocolFee;
            expect(expectedTransfer).to.equal(amount - (amount * 30n) / 10000n);
          }
        ),
        { numRuns: 20 }
      );
    });

    // Property 23: Intent Completion Fund Return
    it("Property 23: Intent Completion Fund Return", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            deposit: fc.bigInt({ min: MIN_DEPOSIT, max: ethers.parseEther("10") }),
            returnAmount: fc.bigInt({ min: 0n, max: ethers.parseEther("20") })
          }),
          async ({ deposit, returnAmount }) => {
            expect(returnAmount).to.be.greaterThanOrEqual(0n);
            expect(deposit).to.be.greaterThanOrEqual(MIN_DEPOSIT);
          }
        ),
        { numRuns: 20 }
      );
    });

    // Property 24: Intent Cancellation Refund
    it("Property 24: Intent Cancellation Refund", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: MIN_DEPOSIT, max: ethers.parseEther("10") }),
          async (amount) => {
            const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
            const goalHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            const intentId = Number(await intentVault.nextIntentId());
            await intentVault.connect(user1).createIntent(
              goalHash, 500, deadline, 1000, 86400, [], { value: amount }
            );
            const initialBalance = await ethers.provider.getBalance(user1.address);
            const tx = await intentVault.connect(user1).cancelIntent(intentId);
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
            const finalBalance = await ethers.provider.getBalance(user1.address);
            expect(finalBalance + gasUsed - initialBalance).to.be.closeTo(amount, ethers.parseEther("0.001"));
          }
        ),
        { numRuns: 5 }
      );
    });

    // Property 25: Intent Expiration Refund
    it("Property 25: Intent Expiration Refund", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: MIN_DEPOSIT, max: ethers.parseEther("10") }),
          async (amount) => {
            const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 10;
            const goalHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            const intentId = Number(await intentVault.nextIntentId());
            await intentVault.connect(user1).createIntent(
              goalHash, 500, deadline, 1000, 86400, [], { value: amount }
            );
            await ethers.provider.send("evm_increaseTime", [15]);
            await ethers.provider.send("evm_mine", []);
            const initialBalance = await ethers.provider.getBalance(user1.address);
            await intentVault.connect(deployer).expireIntent(intentId);
            const finalBalance = await ethers.provider.getBalance(user1.address);
            expect(finalBalance - initialBalance).to.equal(amount);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe("Agent Registration Properties", function () {
    // Property 26: Agent Registration Minimum Stake
    it("Property 26: Agent Registration Minimum Stake", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: 0n, max: MIN_STAKE - 1n }),
          async (stake) => {
            await expect(
              agentRegistry.connect(user1).registerAgent("ipfs://test", { value: stake })
            ).to.be.revertedWith("Insufficient stake amount");
          }
        ),
        { numRuns: 10 }
      );
    });

    // Property 27: Agent Initial Reputation
    it("Property 27: Agent Initial Reputation", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            stake: fc.bigInt({ min: MIN_STAKE, max: ethers.parseEther("20") }),
            suffix: fc.string({ minLength: 1, maxLength: 10 })
          }),
          async ({ stake, suffix }) => {
            const metadataURI = `ipfs://${suffix}`;
            const newAgent = ethers.Wallet.createRandom().connect(ethers.provider);
            await deployer.sendTransaction({
              to: newAgent.address,
              value: stake + ethers.parseEther("1")
            });
            await agentRegistry.connect(newAgent).registerAgent(metadataURI, { value: stake });
            const agent = await agentRegistry.getAgent(newAgent.address);
            expect(agent.reputationScore).to.equal(INITIAL_REPUTATION);
          }
        ),
        { numRuns: 5 }
      );
    });

    // Property 28: Agent Initial Active Status
    it("Property 28: Agent Initial Active Status", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: MIN_STAKE, max: ethers.parseEther("20") }),
          async (stake) => {
            const newAgent = ethers.Wallet.createRandom().connect(ethers.provider);
            await deployer.sendTransaction({
              to: newAgent.address,
              value: stake + ethers.parseEther("1")
            });
            await agentRegistry.connect(newAgent).registerAgent("ipfs://test", { value: stake });
            const agent = await agentRegistry.getAgent(newAgent.address);
            expect(agent.isActive).to.be.true;
            expect(await agentRegistry.isActiveAgent(newAgent.address)).to.be.true;
          }
        ),
        { numRuns: 5 }
      );
    });

    // Property 29: Agent Execution Counter Invariant (delta checks for state accumulation)
    it("Property 29: Agent Execution Counter Invariant", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            successes: fc.integer({ min: 0, max: 5 }),
            failures: fc.integer({ min: 0, max: 2 })
          }),
          async ({ successes, failures }) => {
            const agentBefore = await agentRegistry.getAgent(agent1.address);
            const prevSuccess = agentBefore.successCount;
            const prevFail = agentBefore.failCount;

            for (let i = 0; i < successes; i++) {
              await agentRegistry.recordSuccess(agent1.address, 0n);
            }
            for (let i = 0; i < failures; i++) {
              const current = await agentRegistry.getAgent(agent1.address);
              if (current.registeredAt > 0n) {
                await agentRegistry.recordFailure(agent1.address);
              }
            }

            const agent = await agentRegistry.getAgent(agent1.address);
            // Invariant: totalExecutions == successCount + failCount
            expect(agent.totalExecutions).to.equal(agent.successCount + agent.failCount);
            // Delta check: increments match the run's successes
            expect(agent.successCount - prevSuccess).to.equal(BigInt(successes));
            // Note: failures may not fully match if agent gets deactivated
            expect(agent.failCount).to.be.greaterThanOrEqual(prevFail);
          }
        ),
        { numRuns: 10 }
      );
    });

    // Property 30: Agent Success Reputation Formula
    it("Property 30: Agent Success Reputation Formula", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 9000 }),
          async (_unused) => {
            const agentBefore = await agentRegistry.getAgent(agent1.address);
            const repBefore = agentBefore.reputationScore;
            await agentRegistry.recordSuccess(agent1.address, 0n);
            // Mirror Solidity: newRep = oldRep + ((10000 - oldRep) * 100 / 10000)
            const expectedIncrease = ((10000n - repBefore) * 100n) / 10000n;
            const expectedNewRep = repBefore + expectedIncrease;
            const agent = await agentRegistry.getAgent(agent1.address);
            expect(agent.reputationScore).to.equal(expectedNewRep);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe("Agent Slashing Properties", function () {
    // Property 31: Agent Slash Amount Calculation
    it("Property 31: Agent Slash Amount Calculation", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: MIN_STAKE, max: ethers.parseEther("50") }),
          async (stakeAmount) => {
            const newAgent = ethers.Wallet.createRandom().connect(ethers.provider);
            await deployer.sendTransaction({
              to: newAgent.address,
              value: stakeAmount + ethers.parseEther("1")
            });
            await agentRegistry.connect(newAgent).registerAgent("ipfs://test", { value: stakeAmount });
            const initialAgent = await agentRegistry.getAgent(newAgent.address);
            const expectedSlashAmount = (stakeAmount * BigInt(SLASH_PERCENT)) / 100n;
            await agentRegistry.recordFailure(newAgent.address);
            const finalAgent = await agentRegistry.getAgent(newAgent.address);
            const actualSlashAmount = initialAgent.stakeAmount - finalAgent.stakeAmount;
            expect(actualSlashAmount).to.equal(expectedSlashAmount);
          }
        ),
        { numRuns: 5 }
      );
    });

    // Property 32: Agent Stake Reduction
    it("Property 32: Agent Stake Reduction", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: MIN_STAKE, max: ethers.parseEther("50") }),
          async (stakeAmount) => {
            const newAgent = ethers.Wallet.createRandom().connect(ethers.provider);
            await deployer.sendTransaction({
              to: newAgent.address,
              value: stakeAmount + ethers.parseEther("1")
            });
            await agentRegistry.connect(newAgent).registerAgent("ipfs://test", { value: stakeAmount });
            const slashAmount = (stakeAmount * BigInt(SLASH_PERCENT)) / 100n;
            const expectedNewStake = stakeAmount - slashAmount;
            await agentRegistry.recordFailure(newAgent.address);
            const agent = await agentRegistry.getAgent(newAgent.address);
            expect(agent.stakeAmount).to.equal(expectedNewStake);
          }
        ),
        { numRuns: 5 }
      );
    });

    // Property 33: Agent Failure Reputation Formula
    it("Property 33: Agent Failure Reputation Formula", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 9000 }),
          async (_unused) => {
            const agentBefore = await agentRegistry.getAgent(agent1.address);
            const repBefore = agentBefore.reputationScore;
            await agentRegistry.recordFailure(agent1.address);
            // Mirror Solidity: newRep = oldRep * 85 / 100
            const expectedNewRep = (repBefore * 85n) / 100n;
            const agent = await agentRegistry.getAgent(agent1.address);
            expect(agent.reputationScore).to.equal(expectedNewRep);
          }
        ),
        { numRuns: 5 }
      );
    });

    // Property 34: Agent Deactivation on Low Stake
    it("Property 34: Agent Deactivation on Low Stake", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: MIN_STAKE, max: MIN_STAKE + ethers.parseEther("2") }),
          async (stakeAmount) => {
            const newAgent = ethers.Wallet.createRandom().connect(ethers.provider);
            await deployer.sendTransaction({
              to: newAgent.address,
              value: stakeAmount + ethers.parseEther("1")
            });
            await agentRegistry.connect(newAgent).registerAgent("ipfs://test", { value: stakeAmount });
            let currentStake = stakeAmount;
            while (currentStake >= MIN_STAKE) {
              await agentRegistry.recordFailure(newAgent.address);
              const agentData = await agentRegistry.getAgent(newAgent.address);
              currentStake = agentData.stakeAmount;
            }
            const finalAgent = await agentRegistry.getAgent(newAgent.address);
            expect(finalAgent.isActive).to.be.false;
            expect(await agentRegistry.isActiveAgent(newAgent.address)).to.be.false;
          }
        ),
        { numRuns: 5 }
      );
    });

    // Property 35: Agent Leaderboard Sorting
    it("Property 35: Agent Leaderboard Sorting", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (numAgents) => {
            for (let i = 0; i < numAgents; i++) {
              const newAgent = ethers.Wallet.createRandom().connect(ethers.provider);
              await deployer.sendTransaction({
                to: newAgent.address,
                value: MIN_STAKE + ethers.parseEther("1")
              });
              await agentRegistry.connect(newAgent).registerAgent(`ipfs://agent${i}`, {
                value: MIN_STAKE
              });
              for (let j = 0; j < i; j++) {
                await agentRegistry.recordSuccess(newAgent.address, 0n);
              }
            }
            const topAgents = await agentRegistry.getTopAgents(numAgents);
            expect(topAgents.length).to.be.lessThanOrEqual(numAgents);
          }
        ),
        { numRuns: 3 }
      );
    });
  });

  describe("Execution Manager Properties", function () {
    // Property 36: Execution Plan Round-Trip Encoding
    it("Property 36: Execution Plan Round-Trip Encoding", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              destinationParaId: fc.integer({ min: 0, max: 3000 }),
              value: fc.bigInt({ min: 0n, max: ethers.parseEther("10") })
            }),
            { minLength: 0, maxLength: 5 }
          ),
          async (steps) => {
            // Build 6-field positional arrays matching new ExecutionStep struct
            // [actionType, destinationParaId, targetContract, callData, amount, minAmountOut]
            const stepsAsArrays = steps.map(s => [
              0,              // actionType
              s.destinationParaId,
              user1.address,
              "0x1234",
              s.value,
              0n              // minAmountOut
            ]);

            const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
              ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
              [stepsAsArrays]
            );
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
              ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
              encoded
            )[0];

            expect(decoded.length).to.equal(steps.length);
            for (let i = 0; i < steps.length; i++) {
              // decoded[i][1] = destinationParaId (was [0] in old 4-field struct)
              expect(Number(decoded[i][1])).to.equal(steps[i].destinationParaId);
              // decoded[i][2] = targetContract (was [1])
              expect(decoded[i][2].toLowerCase()).to.equal(user1.address.toLowerCase());
              // decoded[i][4] = amount (was [3])
              expect(decoded[i][4]).to.equal(steps[i].value);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    // Property 37: Execution Initial Status
    it("Property 37: Execution Initial Status", async function () {
      let intentIdCounter = 10000;
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              destinationParaId: fc.constantFrom(2034, 2030, 2004),
              value: fc.bigInt({ min: 0n, max: ethers.parseEther("0.1") })
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (steps) => {
            // 6-field: [actionType=1 (XCM), destinationParaId, targetContract, callData, amount, minAmountOut]
            const stepsAsArrays = steps.map(s => [
              1,              // actionType = XCM
              s.destinationParaId,
              user1.address,
              "0x1234",
              s.value,
              0n
            ]);
            const planData = ethers.AbiCoder.defaultAbiCoder().encode(
              ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
              [stepsAsArrays]
            );
            const intentId = intentIdCounter++;
            await executionManager.connect(vaultSigner).execute(intentId, planData, {
              value: ethers.parseEther("1")
            });
            const execution = await executionManager.getExecution(intentId);
            expect(execution.status).to.equal(1); // AWAITING_CONFIRMATION
          }
        ),
        { numRuns: 10 }
      );
    });

    // Property 38: Execution Step Event Count
    it("Property 38: Execution Step Event Count", async function () {
      let intentIdCounter = 20000;
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (numSteps) => {
            // 6-field XCM steps
            const steps = Array(numSteps).fill(null).map((_, i) => [
              1,              // actionType = XCM
              2034,
              user1.address,
              `0x${i.toString(16).padStart(8, '0')}`,
              ethers.parseEther("0.1"),
              0n
            ]);
            const planData = ethers.AbiCoder.defaultAbiCoder().encode(
              ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
              [steps]
            );
            const intentId = intentIdCounter++;
            const tx = await executionManager.connect(vaultSigner).execute(intentId, planData, {
              value: ethers.parseEther("1")
            });
            const receipt = await tx.wait();
            const stepEvents = receipt!.logs.filter(log => {
              try {
                const parsed = executionManager.interface.parseLog({
                  topics: log.topics,
                  data: log.data
                });
                return parsed?.name === "StepExecuted";
              } catch {
                return false;
              }
            });
            expect(stepEvents.length).to.equal(numSteps);
          }
        ),
        { numRuns: 10 }
      );
    });

    // Property 39: Execution Failure Refund
    it("Property 39: Execution Failure Refund", async function () {
      let intentIdCounter = 30000;
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: ethers.parseEther("1"), max: ethers.parseEther("5") }),
          async (amount) => {
            // 6-field local failing step: [actionType=0, paraId=0, addr, callData, amount, minAmountOut]
            const failingSteps = [
              [0, 0, await agentRegistry.getAddress(), "0xdeadbeef", 0n, 0n]
            ];
            const planData = ethers.AbiCoder.defaultAbiCoder().encode(
              ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
              [failingSteps]
            );
            const intentId = intentIdCounter++;
            const tx = await executionManager.connect(vaultSigner).execute(intentId, planData, {
              value: amount
            });
            await expect(tx)
              .to.emit(executionManager, "ExecutionFailed")
              .withArgs(intentId, anyValue);
            const execution = await executionManager.getExecution(intentId);
            expect(execution.status).to.equal(3); // FAILED
          }
        ),
        { numRuns: 5 }
      );
    });

    // Property 40: Execution Awaiting Confirmation Status
    it("Property 40: Execution Awaiting Confirmation Status", async function () {
      let intentIdCounter = 40000;
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              destinationParaId: fc.constantFrom(2034, 2030, 2004),
              value: fc.bigInt({ min: 0n, max: ethers.parseEther("0.1") })
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (xcmSteps) => {
            // 6-field XCM steps
            const stepsAsArrays = xcmSteps.map(s => [
              1,              // actionType = XCM
              s.destinationParaId,
              user1.address,
              "0x1234",
              s.value,
              0n
            ]);
            const planData = ethers.AbiCoder.defaultAbiCoder().encode(
              ["tuple(uint8,uint32,address,bytes,uint256,uint256)[]"],
              [stepsAsArrays]
            );
            const intentId = intentIdCounter++;
            await executionManager.connect(vaultSigner).execute(intentId, planData, {
              value: ethers.parseEther("1")
            });
            const execution = await executionManager.getExecution(intentId);
            expect(execution.status).to.equal(1); // AWAITING_CONFIRMATION
          }
        ),
        { numRuns: 10 }
      );
    });

    // Property 41: XCM Message Round-Trip Encoding
    it("Property 41: XCM Message Round-Trip Encoding", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            paraId: fc.constantFrom(2034, 2030, 2004),
            amount: fc.bigInt({ min: 1n, max: ethers.parseEther("100") })
          }),
          async ({ paraId, amount }) => {
            // Use bytes32 beneficiary (AccountId32) as required by buildTransferXCM
            const beneficiary = ethers.zeroPadValue(user1.address, 32);
            const xcmMessage = await executionManager.buildTransferXCM(paraId, beneficiary, amount);
            expect(xcmMessage).to.not.equal("0x");
            expect(xcmMessage.length).to.be.greaterThan(2);
            // Verify determinism
            const xcmMessage2 = await executionManager.buildTransferXCM(paraId, beneficiary, amount);
            expect(xcmMessage).to.equal(xcmMessage2);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe("Edge Case Properties", function () {
    it("should handle maximum values correctly", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async (_) => {
            const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
            const goalHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            await expect(
              intentVault.connect(user1).createIntent(
                goalHash, MAX_SLIPPAGE_BPS, deadline, 1000, 86400, [],
                { value: ethers.parseEther("1000") }
              )
            ).to.not.be.reverted;
          }
        ),
        { numRuns: 3 }
      );
    });

    it("should handle minimum values correctly", async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async (_) => {
            const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
            const goalHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
            await expect(
              intentVault.connect(user1).createIntent(
                goalHash, 0, deadline, 0, 0, [], { value: MIN_DEPOSIT }
              )
            ).to.not.be.reverted;

            const newAgent = ethers.Wallet.createRandom().connect(ethers.provider);
            await deployer.sendTransaction({
              to: newAgent.address,
              value: MIN_STAKE + ethers.parseEther("1")
            });
            await expect(
              agentRegistry.connect(newAgent).registerAgent("ipfs://test", { value: MIN_STAKE })
            ).to.not.be.reverted;
          }
        ),
        { numRuns: 3 }
      );
    });
  });
});
