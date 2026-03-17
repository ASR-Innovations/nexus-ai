// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ExecutionManager
 * @dev Manages cross-chain execution of intent plans via XCM.
 *      Only IntentVault (set via setIntentVault) may call execute / completeExecution / failExecution.
 */
contract ExecutionManager is ReentrancyGuard, Pausable {

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev XCM Precompile address on Polkadot Hub EVM
    address public constant XCM_PRECOMPILE = 0x0000000000000000000000000000000000000A00;

    /// @dev Minimum XCM transfer amount (prevents dust attacks)
    uint256 public constant MIN_XCM_AMOUNT = 0.1 ether;

    /// @dev Maximum XCM transfer amount (prevents fat-finger errors)
    uint256 public constant MAX_XCM_AMOUNT = 1000 ether;

    // ─────────────────────────────────────────────────────────────────────────
    // State variables
    // ─────────────────────────────────────────────────────────────────────────

    address public owner;
    address public intentVault;

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev A single step in an agent-submitted execution plan.
     *      actionType 0 = local call, 1 = XCM transfer.
     */
    struct ExecutionStep {
        uint8   actionType;          // 0=local, 1=XCM
        uint32  destinationParaId;   // 0 for local; target paraId for XCM
        address targetContract;      // Local: contract to call; XCM: beneficiary address
        bytes   callData;            // ABI-encoded call (local); ignored for XCM
        uint256 amount;              // Native token amount to send / transfer
        uint256 minAmountOut;        // Minimum acceptable output (slippage guard)
    }

    /**
     * @dev Execution status tracking.
     */
    enum ExecutionStatus {
        IN_PROGRESS,
        AWAITING_CONFIRMATION,
        COMPLETED,
        FAILED
    }

    /**
     * @dev Per-intent execution record.
     */
    struct Execution {
        uint256 intentId;
        ExecutionStatus status;
        uint256 totalSteps;
        uint256 completedSteps;
        uint256 startedAt;
        uint256 totalAmount;         // Total native tokens managed by this execution
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    mapping(uint256 => Execution) public executions;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event IntentVaultSet(address indexed intentVault);
    event ExecutionStarted(uint256 indexed intentId, uint256 indexed totalSteps);
    event StepExecuted(uint256 indexed intentId, uint256 indexed stepIndex, uint32 indexed paraId);
    event XCMSent(uint256 indexed intentId, uint32 indexed paraId, bytes xcmMessage);
    event ExecutionDispatched(uint256 indexed intentId);
    event ExecutionCompleted(uint256 indexed intentId);
    event ExecutionFailed(uint256 indexed intentId, string reason);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error OnlyIntentVault();
    error OnlyOwner();
    error ExecutionNotFound();
    error InvalidExecutionStatus();
    error LocalExecutionFailed();
    error XCMExecutionFailed();

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyIntentVault() {
        if (msg.sender != intentVault) revert OnlyIntentVault();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _intentVault Initial IntentVault address (may be address(0) if set later).
     */
    constructor(address _intentVault) {
        owner = msg.sender;
        intentVault = _intentVault;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Update the IntentVault address. Only callable by owner.
     */
    function setIntentVault(address _intentVault) external onlyOwner {
        require(_intentVault != address(0), "Invalid IntentVault address");
        intentVault = _intentVault;
        emit IntentVaultSet(_intentVault);
    }

    /**
     * @dev Pause the contract. Only callable by owner.
     *      Blocks all critical state-changing functions.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract. Only callable by owner.
     *      Restores normal operations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core execution
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Executes an intent plan by processing all execution steps.
     *      Only callable by IntentVault.
     * @param intentId  The intent ID to execute
     * @param planData  ABI-encoded ExecutionStep[] array
     * @return success  True if execution was dispatched successfully
     */
    function execute(uint256 intentId, bytes calldata planData)
        external
        payable
        onlyIntentVault
        whenNotPaused
        nonReentrant
        returns (bool success)
    {
        ExecutionStep[] memory steps = abi.decode(planData, (ExecutionStep[]));

        // Sum total amount across all steps
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < steps.length; i++) {
            totalAmount += steps[i].amount;
        }

        executions[intentId] = Execution({
            intentId:       intentId,
            status:         ExecutionStatus.IN_PROGRESS,
            totalSteps:     steps.length,
            completedSteps: 0,
            startedAt:      block.timestamp,
            totalAmount:    totalAmount
        });

        emit ExecutionStarted(intentId, steps.length);

        _executeSteps(intentId, steps);

        return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal execution helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _executeSteps(uint256 intentId, ExecutionStep[] memory steps) internal {
        Execution storage execution = executions[intentId];

        for (uint256 i = 0; i < steps.length; i++) {
            ExecutionStep memory step = steps[i];

            try this._executeStep(intentId, i, step) {
                execution.completedSteps++;
                emit StepExecuted(intentId, i, step.destinationParaId);
            } catch Error(string memory reason) {
                execution.status = ExecutionStatus.FAILED;
                emit ExecutionFailed(intentId, reason);
                _refundToVault();
                return;
            } catch {
                execution.status = ExecutionStatus.FAILED;
                emit ExecutionFailed(intentId, "Unexpected execution error");
                _refundToVault();
                return;
            }
        }

        if (execution.completedSteps == execution.totalSteps) {
            execution.status = ExecutionStatus.AWAITING_CONFIRMATION;
            emit ExecutionDispatched(intentId);
        }
    }

    /**
     * @dev Dispatches a single step — local call or XCM transfer.
     *      External so it can be caught by try/catch in _executeSteps.
     */
    function _executeStep(uint256 intentId, uint256 stepIndex, ExecutionStep memory step) external {
        require(msg.sender == address(this), "Internal function only");

        if (step.actionType == 0 || step.destinationParaId == 0) {
            _executeLocal(step);
        } else {
            _executeXCM(intentId, step);
        }
    }

    function _executeLocal(ExecutionStep memory step) internal {
        (bool success, bytes memory returnData) = step.targetContract.call{value: step.amount}(step.callData);

        if (!success) {
            if (returnData.length > 0) {
                assembly {
                    let returnDataSize := mload(returnData)
                    revert(add(32, returnData), returnDataSize)
                }
            }
            revert LocalExecutionFailed();
        }
    }

    function _executeXCM(uint256 intentId, ExecutionStep memory step) internal {
        // Encode beneficiary as bytes32 (XCM-native format)
        bytes32 beneficiary = bytes32(uint256(uint160(step.targetContract)));

        // Defense-in-depth: validate XCM parameters
        require(beneficiary != bytes32(0), "Invalid beneficiary");
        require(step.amount >= MIN_XCM_AMOUNT, "Amount below minimum");
        require(step.amount <= MAX_XCM_AMOUNT, "Amount exceeds maximum");

        bytes memory xcmMessage = buildTransferXCM(
            step.destinationParaId,
            beneficiary,
            step.amount
        );

        uint64 weight = weighMessage(xcmMessage);
        _callXCMPrecompile(xcmMessage, weight);

        emit XCMSent(intentId, step.destinationParaId, xcmMessage);
    }

    function _refundToVault() internal {
        uint256 balance = address(this).balance;
        if (balance > 0 && intentVault != address(0)) {
            (bool ok, ) = payable(intentVault).call{value: balance}("");
            require(ok, "Refund failed");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // XCM message building
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Builds an XCM V3 transfer message for a supported parachain.
     * @param paraId      Target parachain ID (2034=Hydration, 2030=Bifrost, 2004=Moonbeam)
     * @param beneficiary Recipient as bytes32 (XCM AccountId32 / AccountKey20 compatible)
     * @param amount      Amount of native tokens to transfer
     * @return xcmMessage Encoded XCM V3 message bytes
     */
    function buildTransferXCM(
        uint32 paraId,
        bytes32 beneficiary,
        uint256 amount
    ) public pure returns (bytes memory xcmMessage) {
        require(beneficiary != bytes32(0), "Invalid beneficiary");
        require(amount >= MIN_XCM_AMOUNT, "Amount below minimum");
        require(amount <= MAX_XCM_AMOUNT, "Amount exceeds maximum");
        require(
            paraId == 2034 || paraId == 2030 || paraId == 2004,
            "Unsupported parachain"
        );

        xcmMessage = abi.encodePacked(
            uint8(3),   // XCM version 3
            uint8(4),   // Instruction count

            // WithdrawAsset
            uint8(0x04),
            _encodeMultiAsset(amount),

            // BuyExecution
            uint8(0x05),
            _encodeMultiAsset(amount / 10), // 10% fee
            uint64(1_000_000_000),          // Weight limit

            // DepositAsset
            uint8(0x06),
            uint8(1),   // Asset count
            uint8(0),   // Wild (All)
            _encodeMultiLocation(paraId, beneficiary),

            // RefundSurplus
            uint8(0x07)
        );
    }

    /**
     * @dev Estimates execution weight by querying the XCM precompile.
     *      Returns 1 billion weight units as fallback on local Hardhat.
     */
    function weighMessage(bytes memory xcmMessage) public view returns (uint64 weight) {
        (bool success, bytes memory result) = XCM_PRECOMPILE.staticcall(
            abi.encodeWithSignature("weighMessage(bytes)", xcmMessage)
        );

        if (success && result.length >= 32) {
            weight = abi.decode(result, (uint64));
        } else {
            weight = 1_000_000_000;
        }
    }

    /**
     * @dev Calls the XCM precompile to execute a message.
     */
    function _callXCMPrecompile(bytes memory xcmMessage, uint64 weight) internal {
        (bool success, bytes memory result) = XCM_PRECOMPILE.call(
            abi.encodeWithSignature("execute(bytes,uint64)", xcmMessage, weight)
        );

        if (!success) {
            if (result.length > 0) {
                assembly {
                    let resultSize := mload(result)
                    revert(add(32, result), resultSize)
                }
            }
            revert XCMExecutionFailed();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // XCM encoding helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _encodeMultiAsset(uint256 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint8(0), // Concrete asset
            uint8(0), // Here
            uint8(1), // Fungible
            amount
        );
    }

    function _encodeMultiLocation(uint32 paraId, bytes32 account) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint8(1),  // Parents: 1 (relay chain)
            uint8(2),  // Interior junctions: 2
            uint8(0),  // Parachain junction
            paraId,
            uint8(1),  // AccountId32 junction
            account    // 32-byte account
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle management (IntentVault-only)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Marks an execution as COMPLETED after XCM confirmation.
     */
    function completeExecution(uint256 intentId) external onlyIntentVault {
        Execution storage execution = executions[intentId];
        if (execution.status != ExecutionStatus.AWAITING_CONFIRMATION) revert InvalidExecutionStatus();
        execution.status = ExecutionStatus.COMPLETED;
        emit ExecutionCompleted(intentId);
    }

    /**
     * @dev Fails a stuck execution and refunds remaining balance to IntentVault.
     */
    function failExecution(uint256 intentId, string calldata reason) external onlyIntentVault {
        Execution storage execution = executions[intentId];
        if (execution.status == ExecutionStatus.COMPLETED || execution.status == ExecutionStatus.FAILED) {
            revert InvalidExecutionStatus();
        }
        execution.status = ExecutionStatus.FAILED;
        emit ExecutionFailed(intentId, reason);
        _refundToVault();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Returns full execution record for an intent.
     */
    function getExecution(uint256 intentId) external view returns (Execution memory) {
        Execution storage execution = executions[intentId];
        if (execution.intentId == 0) revert ExecutionNotFound();
        return execution;
    }

    /**
     * @dev Returns the number of completed steps for an execution.
     */
    function getCurrentStep(uint256 intentId) external view returns (uint8) {
        Execution storage execution = executions[intentId];
        if (execution.intentId == 0) revert ExecutionNotFound();
        return uint8(execution.completedSteps);
    }

    /**
     * @dev Returns true if the execution is still in progress or awaiting confirmation.
     */
    function isExecutionInProgress(uint256 intentId) external view returns (bool) {
        ExecutionStatus status = executions[intentId].status;
        return status == ExecutionStatus.IN_PROGRESS || status == ExecutionStatus.AWAITING_CONFIRMATION;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Receive
    // ─────────────────────────────────────────────────────────────────────────

    receive() external payable {}
}
