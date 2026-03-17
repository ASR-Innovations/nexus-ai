// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// ─────────────────────────────────────────────────────────────────────────────
// External interfaces
// ─────────────────────────────────────────────────────────────────────────────

interface IAgentRegistry {
    function isActiveAgent(address agent) external view returns (bool);
    function recordSuccess(address agent, uint256 amount) external;
    function recordFailure(address agent) external;
    function getAgentReputation(address agent) external view returns (uint256);
}

interface IExecutionManager {
    function execute(uint256 intentId, bytes calldata planData) external returns (bool);
}

/**
 * @title IntentVault
 * @dev Holds user deposits, enforces execution guardrails, and manages the intent lifecycle.
 *
 * Key design decisions vs. earlier drafts:
 *  - Only the *assigned agent* may call executeIntent (spec §3.1, industry standard: agent triggers its own work)
 *  - updateAgentRegistry / updateExecutionManager are owner-only
 *  - IntentExecuted event carries `bool success` (always true when emitted)
 *  - completeIntent reports the full deposit amount to AgentRegistry for volume tracking
 */
contract IntentVault is ReentrancyGuard, Pausable {

    // ─────────────────────────────────────────────────────────────────────────
    // State variables
    // ─────────────────────────────────────────────────────────────────────────

    IAgentRegistry public agentRegistry;
    IExecutionManager public executionManager;

    address public owner;
    uint256 public nextIntentId = 1;

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant MIN_DEPOSIT       = 1 ether;
    uint256 public constant MAX_SLIPPAGE_BPS  = 1000; // 10%
    uint256 public constant PROTOCOL_FEE_BPS  = 30;   // 0.3%
    uint256 public constant EXECUTION_BUFFER  = 5 minutes; // Buffer time for cross-chain execution
    uint256 public constant MIN_REPUTATION_FOR_CLAIM = 3000; // 30% in basis points
    uint256 public constant MAX_ACTIVE_INTENTS_PER_AGENT = 10; // Maximum concurrent active intents per agent

    // ─────────────────────────────────────────────────────────────────────────
    // Enums & Structs
    // ─────────────────────────────────────────────────────────────────────────

    enum IntentStatus {
        PENDING,               // 0 — created, awaiting agent
        ASSIGNED,              // 1 — agent claimed it
        PLAN_SUBMITTED,        // 2 — agent submitted execution plan
        APPROVED,              // 3 — user approved the plan
        EXECUTING,             // 4 — execution in progress
        AWAITING_CONFIRMATION, // 5 — XCM dispatched, waiting for finality
        COMPLETED,             // 6 — execution confirmed successful
        FAILED,                // 7 — execution failed, user refunded
        CANCELLED,             // 8 — user cancelled before execution
        EXPIRED                // 9 — deadline passed, user refunded
    }

    struct Intent {
        address user;
        uint256 amount;
        bytes32 goalHash;
        uint256 maxSlippageBps;
        uint256 deadline;
        uint256 minYieldBps;
        uint256 maxLockDuration;
        address[] approvedProtocols;
        IntentStatus status;
        address assignedAgent;
        bytes executionPlan;
        bytes32 executionPlanHash;
        uint256 createdAt;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Mappings
    // ─────────────────────────────────────────────────────────────────────────

    mapping(uint256 => Intent) public intents;
    mapping(address => uint256[]) public userIntents;  // user → intent IDs
    mapping(address => uint256) public agentActiveIntents; // agent → count of active intents
    mapping(address => bool) public whitelistedProtocols; // approved protocol addresses
    uint256[] private allIntentIds;                    // for getPendingIntents enumeration

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event IntentCreated(uint256 indexed intentId, address indexed user, uint256 indexed amount, bytes32 goalHash);
    event IntentAssigned(uint256 indexed intentId, address indexed agent);
    event PlanSubmitted(uint256 indexed intentId, bytes32 indexed executionPlanHash);
    event PlanApproved(uint256 indexed intentId);
    event IntentExecuted(uint256 indexed intentId, bool indexed success);
    event ExecutionDispatched(uint256 indexed intentId);
    event ExecutionCompleted(uint256 indexed intentId, uint256 indexed returnAmount);
    event ExecutionFailed(uint256 indexed intentId, string reason);
    event FundsReturned(uint256 indexed intentId, address indexed user, uint256 indexed amount);
    event IntentCancelled(uint256 indexed intentId, address indexed user);
    event IntentExpired(uint256 indexed intentId, address indexed user);
    event ProtocolWhitelisted(address indexed protocol);
    event ProtocolRemoved(address indexed protocol);

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyIntentUser(uint256 intentId) {
        require(intents[intentId].user == msg.sender, "Not intent owner");
        _;
    }

    modifier onlyAssignedAgent(uint256 intentId) {
        require(intents[intentId].assignedAgent == msg.sender, "Not assigned agent");
        _;
    }

    modifier onlyExecutionManager() {
        require(msg.sender == address(executionManager), "Only ExecutionManager");
        _;
    }

    modifier intentExists(uint256 intentId) {
        require(intentId > 0 && intentId < nextIntentId, "Intent does not exist");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address _agentRegistry, address _executionManager) {
        agentRegistry  = IAgentRegistry(_agentRegistry);
        executionManager = IExecutionManager(_executionManager);
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin (owner-only)
    // ─────────────────────────────────────────────────────────────────────────

    function updateAgentRegistry(address _agentRegistry) external onlyOwner {
        agentRegistry = IAgentRegistry(_agentRegistry);
    }

    function updateExecutionManager(address _executionManager) external onlyOwner {
        executionManager = IExecutionManager(_executionManager);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Adds a protocol to the whitelist of approved protocols.
     * @param protocol Address of the protocol to whitelist
     */
    function addWhitelistedProtocol(address protocol) external onlyOwner {
        require(protocol != address(0), "Invalid protocol address");
        whitelistedProtocols[protocol] = true;
        emit ProtocolWhitelisted(protocol);
    }

    /**
     * @dev Removes a protocol from the whitelist.
     * @param protocol Address of the protocol to remove
     */
    function removeWhitelistedProtocol(address protocol) external onlyOwner {
        whitelistedProtocols[protocol] = false;
        emit ProtocolRemoved(protocol);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Intent creation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Creates a new intent with a native-token deposit and execution guardrails.
     * @param goalHash         keccak256 hash of the user's goal description
     * @param maxSlippageBps   Maximum acceptable slippage (basis points, ≤ MAX_SLIPPAGE_BPS)
     * @param deadline         Unix timestamp after which the intent expires
     * @param minYieldBps      Minimum yield requirement (basis points)
     * @param maxLockDuration  Maximum lock duration in seconds
     * @param approvedProtocols Array of approved protocol addresses the agent may interact with
     * @return intentId        Unique ID of the created intent
     */
    function createIntent(
        bytes32 goalHash,
        uint256 maxSlippageBps,
        uint256 deadline,
        uint256 minYieldBps,
        uint256 maxLockDuration,
        address[] calldata approvedProtocols
    ) external payable whenNotPaused returns (uint256 intentId) {
        require(msg.value >= MIN_DEPOSIT,          "Deposit below minimum");
        require(maxSlippageBps <= MAX_SLIPPAGE_BPS, "Slippage too high");
        require(deadline > block.timestamp,         "Deadline in the past");

        // Validate all approved protocols are whitelisted
        for (uint256 i = 0; i < approvedProtocols.length; i++) {
            require(whitelistedProtocols[approvedProtocols[i]], "Protocol not whitelisted");
        }

        intentId = nextIntentId++;

        intents[intentId] = Intent({
            user:              msg.sender,
            amount:            msg.value,
            goalHash:          goalHash,
            maxSlippageBps:    maxSlippageBps,
            deadline:          deadline,
            minYieldBps:       minYieldBps,
            maxLockDuration:   maxLockDuration,
            approvedProtocols: approvedProtocols,
            status:            IntentStatus.PENDING,
            assignedAgent:     address(0),
            executionPlan:     "",
            executionPlanHash: bytes32(0),
            createdAt:         block.timestamp
        });

        userIntents[msg.sender].push(intentId);
        allIntentIds.push(intentId);

        emit IntentCreated(intentId, msg.sender, msg.value, goalHash);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Intent lifecycle — agent actions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Active agent claims an unassigned PENDING intent.
     */
    function claimIntent(uint256 intentId) external intentExists(intentId) whenNotPaused {
        Intent storage intent = intents[intentId];

        require(agentRegistry.isActiveAgent(msg.sender), "Agent not active");
        uint256 reputation = agentRegistry.getAgentReputation(msg.sender);
        require(reputation >= MIN_REPUTATION_FOR_CLAIM, "Reputation too low");
        require(agentActiveIntents[msg.sender] < MAX_ACTIVE_INTENTS_PER_AGENT, "Too many active intents");
        require(intent.status == IntentStatus.PENDING,   "Intent not available");
        require(block.timestamp <= intent.deadline,      "Intent expired");

        intent.assignedAgent = msg.sender;
        intent.status        = IntentStatus.ASSIGNED;
        agentActiveIntents[msg.sender]++;

        emit IntentAssigned(intentId, msg.sender);
    }

    /**
     * @dev Assigned agent submits the execution plan for user review.
     */
    function submitPlan(uint256 intentId, bytes calldata executionPlan)
        external
        intentExists(intentId)
        onlyAssignedAgent(intentId)
    {
        Intent storage intent = intents[intentId];

        require(intent.status == IntentStatus.ASSIGNED, "Invalid status");
        require(block.timestamp <= intent.deadline,      "Intent expired");

        intent.executionPlan     = executionPlan;
        intent.executionPlanHash = keccak256(executionPlan);
        intent.status            = IntentStatus.PLAN_SUBMITTED;

        emit PlanSubmitted(intentId, intent.executionPlanHash);
    }

    /**
     * @dev Assigned agent triggers execution after user has approved the plan.
     *      Transfers the execution amount (deposit minus protocol fee) to ExecutionManager,
     *      then calls ExecutionManager.execute().
     */
    function executeIntent(uint256 intentId)
        external
        intentExists(intentId)
        onlyAssignedAgent(intentId)
        nonReentrant
        whenNotPaused
    {
        Intent storage intent = intents[intentId];

        require(intent.status == IntentStatus.APPROVED, "Plan not approved");
        require(block.timestamp + EXECUTION_BUFFER <= intent.deadline, "Insufficient time before deadline");

        // Protocol fee stays in the vault; execution amount goes to ExecutionManager
        uint256 protocolFee     = (intent.amount * PROTOCOL_FEE_BPS) / 10000;
        uint256 executionAmount = intent.amount - protocolFee;

        (bool sent, ) = address(executionManager).call{value: executionAmount}("");
        require(sent, "Transfer to ExecutionManager failed");

        bool ok = executionManager.execute(intentId, intent.executionPlan);
        require(ok, "Execution initiation failed");

        intent.status = IntentStatus.EXECUTING;

        emit IntentExecuted(intentId, true);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Intent lifecycle — user actions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev User approves the execution plan submitted by the agent.
     */
    function approvePlan(uint256 intentId)
        external
        intentExists(intentId)
        onlyIntentUser(intentId)
    {
        Intent storage intent = intents[intentId];

        require(intent.status == IntentStatus.PLAN_SUBMITTED, "No plan to approve");
        require(block.timestamp <= intent.deadline,            "Intent expired");

        intent.status = IntentStatus.APPROVED;

        emit PlanApproved(intentId);
    }

    /**
     * @dev User cancels an intent before execution starts and receives a full refund.
     */
    function cancelIntent(uint256 intentId)
        external
        intentExists(intentId)
        onlyIntentUser(intentId)
        nonReentrant
    {
        Intent storage intent = intents[intentId];

        require(
            intent.status == IntentStatus.PENDING       ||
            intent.status == IntentStatus.ASSIGNED      ||
            intent.status == IntentStatus.PLAN_SUBMITTED ||
            intent.status == IntentStatus.APPROVED,
            "Cannot cancel after execution started"
        );

        uint256 refundAmount = intent.amount;
        
        // Decrement active intents counter if intent was assigned
        if (intent.assignedAgent != address(0)) {
            agentActiveIntents[intent.assignedAgent]--;
        }
        
        intent.status = IntentStatus.CANCELLED;

        (bool ok, ) = intent.user.call{value: refundAmount}("");
        require(ok, "Refund transfer failed");

        emit IntentCancelled(intentId, intent.user);
        emit FundsReturned(intentId, intent.user, refundAmount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Intent lifecycle — ExecutionManager callbacks
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Called by ExecutionManager after successful execution.
     *      Returns funds to the user and records the success with AgentRegistry.
     */
    function completeIntent(uint256 intentId, uint256 returnAmount)
        external
        payable
        intentExists(intentId)
        onlyExecutionManager
        nonReentrant
    {
        Intent storage intent = intents[intentId];

        require(
            intent.status == IntentStatus.EXECUTING ||
            intent.status == IntentStatus.AWAITING_CONFIRMATION,
            "Invalid status for completion"
        );

        // Slippage protection validation
        uint256 protocolFee = (intent.amount * PROTOCOL_FEE_BPS) / 10000;
        uint256 executionAmount = intent.amount - protocolFee;
        uint256 minAcceptable = executionAmount - (executionAmount * intent.maxSlippageBps / 10000);
        require(returnAmount >= minAcceptable, "Slippage exceeded");

        if (returnAmount > 0) {
            (bool ok, ) = intent.user.call{value: returnAmount}("");
            require(ok, "Return transfer failed");
        }

        // Record success — passes full deposit amount for volume tracking
        agentRegistry.recordSuccess(intent.assignedAgent, intent.amount);

        // Decrement active intents counter
        agentActiveIntents[intent.assignedAgent]--;

        intent.status = IntentStatus.COMPLETED;

        emit ExecutionCompleted(intentId, returnAmount);
        emit FundsReturned(intentId, intent.user, returnAmount);
    }

    /**
     * @dev Called by ExecutionManager when execution fails.
     *      Refunds the full original deposit to the user and slashes the agent.
     */
    function failIntent(uint256 intentId, string calldata reason)
        external
        payable
        intentExists(intentId)
        onlyExecutionManager
        nonReentrant
    {
        Intent storage intent = intents[intentId];

        require(
            intent.status == IntentStatus.EXECUTING ||
            intent.status == IntentStatus.AWAITING_CONFIRMATION,
            "Invalid status for failure"
        );

        // Return the full original deposit (fee + execution amount)
        (bool ok, ) = intent.user.call{value: intent.amount}("");
        require(ok, "Refund transfer failed");

        agentRegistry.recordFailure(intent.assignedAgent);

        // Decrement active intents counter
        agentActiveIntents[intent.assignedAgent]--;

        intent.status = IntentStatus.FAILED;

        emit ExecutionFailed(intentId, reason);
        emit FundsReturned(intentId, intent.user, intent.amount);
    }

    /**
     * @dev Called by ExecutionManager to signal XCM dispatch (status → AWAITING_CONFIRMATION).
     */
    function setAwaitingConfirmation(uint256 intentId)
        external
        intentExists(intentId)
        onlyExecutionManager
    {
        Intent storage intent = intents[intentId];
        require(intent.status == IntentStatus.EXECUTING, "Invalid status");

        intent.status = IntentStatus.AWAITING_CONFIRMATION;
        emit ExecutionDispatched(intentId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Expiration (permissionless after deadline)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Anyone may expire an intent after its deadline passes, refunding the user.
     */
    function expireIntent(uint256 intentId)
        external
        intentExists(intentId)
        nonReentrant
    {
        Intent storage intent = intents[intentId];

        require(block.timestamp > intent.deadline, "Intent not yet expired");
        require(
            intent.status != IntentStatus.EXECUTING               &&
            intent.status != IntentStatus.AWAITING_CONFIRMATION   &&
            intent.status != IntentStatus.COMPLETED               &&
            intent.status != IntentStatus.FAILED                  &&
            intent.status != IntentStatus.CANCELLED               &&
            intent.status != IntentStatus.EXPIRED,
            "Intent cannot be expired"
        );

        uint256 refundAmount = intent.amount;
        intent.status = IntentStatus.EXPIRED;

        (bool ok, ) = intent.user.call{value: refundAmount}("");
        require(ok, "Refund transfer failed");

        emit IntentExpired(intentId, intent.user);
        emit FundsReturned(intentId, intent.user, refundAmount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    function getIntent(uint256 intentId) external view intentExists(intentId) returns (Intent memory) {
        return intents[intentId];
    }

    function getIntentStatus(uint256 intentId) external view intentExists(intentId) returns (IntentStatus) {
        return intents[intentId].status;
    }

    function getApprovedProtocols(uint256 intentId) external view intentExists(intentId) returns (address[] memory) {
        return intents[intentId].approvedProtocols;
    }

    function isIntentExpired(uint256 intentId) external view intentExists(intentId) returns (bool) {
        return block.timestamp > intents[intentId].deadline;
    }

    function getUserIntents(address user) external view returns (uint256[] memory) {
        return userIntents[user];
    }

    function getPendingIntents() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < allIntentIds.length; i++) {
            if (intents[allIntentIds[i]].status == IntentStatus.PENDING) count++;
        }
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allIntentIds.length; i++) {
            if (intents[allIntentIds[i]].status == IntentStatus.PENDING) result[idx++] = allIntentIds[i];
        }
        return result;
    }

    function isIntentValid(uint256 intentId) external view intentExists(intentId) returns (bool) {
        Intent storage intent = intents[intentId];
        return block.timestamp <= intent.deadline &&
               intent.status != IntentStatus.EXPIRED    &&
               intent.status != IntentStatus.CANCELLED  &&
               intent.status != IntentStatus.COMPLETED  &&
               intent.status != IntentStatus.FAILED;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Receive ETH (needed for completeIntent / failIntent callbacks)
    // ─────────────────────────────────────────────────────────────────────────

    receive() external payable {}
}
