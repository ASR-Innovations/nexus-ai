// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AgentRegistry
 * @dev Manages agent registration, staking, reputation, and slashing for the NexusAI Protocol.
 *      Only IntentVault (set via setIntentVault) may call recordSuccess / recordFailure.
 */
contract AgentRegistry is ReentrancyGuard, Pausable {

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct Agent {
        uint256 stakeAmount;        // Amount of native tokens staked
        uint256 reputationScore;    // Reputation in basis points (0–10000)
        uint256 successCount;       // Successful executions
        uint256 failCount;          // Failed executions
        uint256 totalExecutions;    // successCount + failCount
        uint256 totalVolumeHandled; // Total wei of user capital processed
        bool isActive;              // Eligible to claim new intents
        string metadataURI;         // IPFS URI for agent metadata
        uint256 registeredAt;       // Timestamp of initial registration
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State variables
    // ─────────────────────────────────────────────────────────────────────────

    mapping(address => Agent) public agents;
    address[] public agentList;       // Enumerable list of all registered agents

    address public owner;             // Contract administrator
    address public intentVault;       // The only address allowed to call recordSuccess/recordFailure
    address public treasury;          // Address to receive slashed funds
    
    // Timelock mechanism for intentVault changes
    address public proposedIntentVault;           // Proposed new IntentVault address
    uint256 public intentVaultChangeTimestamp;    // Timestamp when change can be executed

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant MIN_STAKE          = 10 ether;
    uint256 public constant INITIAL_REPUTATION = 5000;    // 50% in basis points
    uint256 public constant MAX_REPUTATION     = 10000;   // Maximum reputation score (100% in basis points)
    uint256 public constant SLASH_PERCENT      = 10;      // 10% of stake slashed on failure
    uint256 public constant TIMELOCK_DURATION  = 2 days;  // Timelock period for intentVault changes
    uint256 public constant MAX_TOP_AGENTS     = 100;     // Maximum agents to return from getTopAgents
    uint256 public constant MAX_REGISTRY_SIZE_FOR_SORTING = 1000; // Maximum registry size for on-chain sorting

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event AgentRegistered(address indexed agent, uint256 indexed stake, string metadataURI);
    event AgentDeactivated(address indexed agent);
    event AgentSlashed(address indexed agent, uint256 indexed slashAmount);
    event ReputationUpdated(address indexed agent, uint256 indexed newScore);
    event StakeAdded(address indexed agent, uint256 indexed amount);
    event StakeWithdrawn(address indexed agent, uint256 indexed amount);
    event IntentVaultSet(address indexed intentVault);
    event IntentVaultProposed(address indexed proposedVault, uint256 executeAfter);
    event TreasurySet(address indexed treasury);
    event AgentStatsUpdated(address indexed agent, uint256 reputationScore, uint256 successCount, uint256 failCount, uint256 stakeAmount);

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyIntentVault() {
        require(msg.sender == intentVault, "Only IntentVault");
        _;
    }

    modifier onlyRegisteredAgent() {
        require(agents[msg.sender].registeredAt > 0, "Agent not registered");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Sets the IntentVault address for initial setup only.
     *      Can only be called once when intentVault is not yet set.
     *      For subsequent changes, use proposeIntentVault() and executeIntentVaultChange().
     */
    function setIntentVault(address _intentVault) external onlyOwner {
        require(intentVault == address(0), "IntentVault already set, use timelock");
        require(_intentVault != address(0), "Invalid IntentVault address");
        intentVault = _intentVault;
        emit IntentVaultSet(_intentVault);
    }

    /**
     * @dev Proposes a new IntentVault address with a 2-day timelock.
     *      Must be called by the owner before executeIntentVaultChange().
     */
    function proposeIntentVault(address _intentVault) external onlyOwner {
        require(_intentVault != address(0), "Invalid IntentVault address");
        proposedIntentVault = _intentVault;
        intentVaultChangeTimestamp = block.timestamp + TIMELOCK_DURATION;
        emit IntentVaultProposed(_intentVault, intentVaultChangeTimestamp);
    }

    /**
     * @dev Executes the proposed IntentVault change after the timelock expires.
     *      Must be called by the owner after the timelock period has passed.
     */
    function executeIntentVaultChange() external onlyOwner {
        require(proposedIntentVault != address(0), "No proposed IntentVault");
        require(block.timestamp >= intentVaultChangeTimestamp, "Timelock not expired");
        
        intentVault = proposedIntentVault;
        emit IntentVaultSet(proposedIntentVault);
        
        // Reset proposal state
        proposedIntentVault = address(0);
        intentVaultChangeTimestamp = 0;
    }

    /**
     * @dev Sets the treasury address to receive slashed funds.
     *      Can be called by the owner at any time.
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    /**
     * @dev Pauses all critical state-changing functions in the contract.
     *      Only callable by the owner. Used for emergency response.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract, restoring normal operations.
     *      Only callable by the owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Agent lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Register as an agent with a stake and IPFS metadata URI.
     */
    function registerAgent(string calldata metadataURI) external payable nonReentrant whenNotPaused {
        require(msg.value >= MIN_STAKE, "Insufficient stake amount");
        require(agents[msg.sender].registeredAt == 0, "Agent already registered");
        require(bytes(metadataURI).length > 0, "Metadata URI required");

        agents[msg.sender] = Agent({
            stakeAmount:        msg.value,
            reputationScore:    INITIAL_REPUTATION,
            successCount:       0,
            failCount:          0,
            totalExecutions:    0,
            totalVolumeHandled: 0,
            isActive:           true,
            metadataURI:        metadataURI,
            registeredAt:       block.timestamp
        });

        agentList.push(msg.sender);
        emit AgentRegistered(msg.sender, msg.value, metadataURI);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IntentVault-only reputation / slash functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Record a successful execution.
     *      Increases successCount, totalExecutions, totalVolumeHandled, and reputation.
     *      Only callable by the IntentVault contract.
     * @param agent  Address of the agent to reward
     * @param amount Amount of user capital (wei) processed in this intent
     */
    function recordSuccess(address agent, uint256 amount) external onlyIntentVault {
        require(agents[agent].registeredAt > 0, "Agent not registered");

        Agent storage a = agents[agent];
        a.successCount++;
        a.totalExecutions++;
        a.totalVolumeHandled += amount;

        // Reputation: newRep = oldRep + ((10000 - oldRep) * 100 / 10000)
        uint256 oldRep = a.reputationScore;
        uint256 increase = ((10000 - oldRep) * 100) / 10000;
        
        // Fix for reputation overflow: ensure minimum increase of 1 when calculation results in 0
        if (increase == 0 && oldRep < MAX_REPUTATION) {
            increase = 1;
        }
        
        // Cap reputation at MAX_REPUTATION
        if (oldRep + increase > MAX_REPUTATION) {
            a.reputationScore = MAX_REPUTATION;
        } else {
            a.reputationScore = oldRep + increase;
        }

        emit ReputationUpdated(agent, a.reputationScore);
        emit AgentStatsUpdated(agent, a.reputationScore, a.successCount, a.failCount, a.stakeAmount);
    }

    /**
     * @dev Record a failed execution.
     *      Slashes 10% of stake and decreases reputation by 15%.
     *      Deactivates agent if remaining stake < MIN_STAKE.
     *      Only callable by the IntentVault contract.
     * @param agent Address of the agent to penalize
     */
    function recordFailure(address agent) external onlyIntentVault {
        require(agents[agent].registeredAt > 0, "Agent not registered");

        Agent storage a = agents[agent];
        a.failCount++;
        a.totalExecutions++;

        // Slash 10% of current stake
        uint256 slashAmount = (a.stakeAmount * SLASH_PERCENT) / 100;
        a.stakeAmount -= slashAmount;

        // Transfer slashed funds to treasury if set
        if (treasury != address(0)) {
            (bool success, ) = treasury.call{value: slashAmount}("");
            require(success, "Treasury transfer failed");
        }

        // Reputation: newRep = oldRep * 85 / 100
        a.reputationScore = (a.reputationScore * 85) / 100;

        // Deactivate if stake drops below minimum
        if (a.stakeAmount < MIN_STAKE) {
            a.isActive = false;
            emit AgentDeactivated(agent);
        }

        emit AgentSlashed(agent, slashAmount);
        emit ReputationUpdated(agent, a.reputationScore);
        emit AgentStatsUpdated(agent, a.reputationScore, a.successCount, a.failCount, a.stakeAmount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Self-service stake management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Add more stake to increase the agent's trust signal.
     */
    function addStake() external payable onlyRegisteredAgent {
        require(msg.value > 0, "Must send ETH");
        agents[msg.sender].stakeAmount += msg.value;
        emit StakeAdded(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw part of the stake.
     *      Auto-deactivates the agent if remaining stake falls below MIN_STAKE.
     */
    function withdrawStake(uint256 amount) external nonReentrant onlyRegisteredAgent {
        require(amount > 0, "Amount must be positive");
        require(amount <= agents[msg.sender].stakeAmount, "Insufficient stake");

        agents[msg.sender].stakeAmount -= amount;

        if (agents[msg.sender].stakeAmount < MIN_STAKE) {
            agents[msg.sender].isActive = false;
            emit AgentDeactivated(msg.sender);
        }

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit StakeWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Voluntarily deactivate — stop receiving new intent assignments.
     */
    function deactivate() external onlyRegisteredAgent {
        require(agents[msg.sender].isActive, "Already inactive");
        agents[msg.sender].isActive = false;
        emit AgentDeactivated(msg.sender);
    }

    /**
     * @dev Reactivate after voluntary deactivation. Requires stake >= MIN_STAKE.
     */
    function reactivate() external onlyRegisteredAgent {
        require(!agents[msg.sender].isActive, "Already active");
        require(agents[msg.sender].stakeAmount >= MIN_STAKE, "Stake below minimum");
        agents[msg.sender].isActive = true;
        emit ReputationUpdated(msg.sender, agents[msg.sender].reputationScore);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Total number of registered agents.
     */
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    /**
     * @dev All agents that are currently active and meet the minimum stake.
     */
    function getActiveAgents() external view returns (address[] memory addresses) {
        uint256 count = 0;
        for (uint256 i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].isActive && agents[agentList[i]].stakeAmount >= MIN_STAKE) {
                count++;
            }
        }
        addresses = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].isActive && agents[agentList[i]].stakeAmount >= MIN_STAKE) {
                addresses[idx++] = agentList[i];
            }
        }
    }

    /**
     * @dev Whether an agent is active and meets the minimum stake threshold.
     */
    function isActiveAgent(address agent) external view returns (bool) {
        return agents[agent].isActive && agents[agent].stakeAmount >= MIN_STAKE;
    }

    /**
     * @dev Top N agents ranked by reputation score (descending), via selection sort.
     *      Suitable for small sets; sort off-chain for large registries.
     */
    function getTopAgents(uint256 n) external view returns (address[] memory addresses) {
        uint256 total = agentList.length;
        
        // DoS prevention: revert for large registries
        require(total <= MAX_REGISTRY_SIZE_FOR_SORTING, "Use off-chain sorting for large registries");
        
        // Cap n at MAX_TOP_AGENTS
        if (n > MAX_TOP_AGENTS) n = MAX_TOP_AGENTS;
        
        if (n > total) n = total;

        address[] memory candidates = new address[](total);
        for (uint256 i = 0; i < total; i++) {
            candidates[i] = agentList[i];
        }

        addresses = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            uint256 bestIdx = i;
            uint256 bestRep = agents[candidates[i]].reputationScore;
            for (uint256 j = i + 1; j < total; j++) {
                uint256 rep = agents[candidates[j]].reputationScore;
                if (rep > bestRep) {
                    bestRep = rep;
                    bestIdx = j;
                }
            }
            address tmp = candidates[i];
            candidates[i] = candidates[bestIdx];
            candidates[bestIdx] = tmp;
            addresses[i] = candidates[i];
        }
    }

    /**
     * @dev Full agent profile (all fields including totalVolumeHandled).
     */
    function getAgent(address agent) external view returns (Agent memory) {
        return agents[agent];
    }

    /**
     * @dev Spec-compatible alias for getAgent.
     */
    function getAgentProfile(address agent) external view returns (Agent memory) {
        return agents[agent];
    }

    /**
     * @dev Agent reputation score in basis points (0–10000).
     */
    function getAgentReputation(address agent) external view returns (uint256) {
        return agents[agent].reputationScore;
    }

    /**
     * @dev Spec-compatible alias for getAgentReputation.
     */
    function getReputation(address agent) external view returns (uint256) {
        return agents[agent].reputationScore;
    }

    /**
     * @dev Agent current stake amount.
     */
    function getAgentStake(address agent) external view returns (uint256) {
        return agents[agent].stakeAmount;
    }
}
