// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title XCMRouter
 * @dev Dedicated XCM routing contract for cross-chain transfers via Polkadot's XCM protocol.
 *      Separates XCM message building and routing from execution logic.
 *      Supports Hydration (2034), Bifrost (2030), and Moonbeam (2004) parachains.
 *
 *      Beneficiaries are passed as bytes32 (XCM AccountId32 / AccountKey20 compatible).
 *      EVM callers should use ethers.zeroPadValue(evmAddress, 32) to convert.
 */
contract XCMRouter {

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev XCM Precompile address on Polkadot Hub EVM
    address public constant XCM_PRECOMPILE = 0x0000000000000000000000000000000000000A00;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    uint32[] public supportedParachains;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event XCMDispatched(uint32 indexed paraId, bytes32 indexed beneficiary, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error UnsupportedParachain(uint32 paraId);
    error XCMExecutionFailed();
    error ZeroAmount();
    error ZeroBeneficiary();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Initializes the router with the three supported Polkadot parachains:
     *      2034 = Hydration (DeFi / liquidity pools)
     *      2030 = Bifrost   (liquid staking)
     *      2004 = Moonbeam  (EVM-compatible)
     */
    constructor() {
        supportedParachains.push(2034);
        supportedParachains.push(2030);
        supportedParachains.push(2004);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public interface
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Routes a native token transfer to a beneficiary on a target parachain via XCM.
     * @param paraId      Target parachain ID
     * @param beneficiary Recipient as bytes32 (XCM AccountId32 / AccountKey20 compatible)
     * @param amount      Amount of native tokens to transfer (should match msg.value)
     * @return success    True if XCM message was dispatched
     */
    function routeTransfer(
        uint32 paraId,
        bytes32 beneficiary,
        uint256 amount
    ) external payable returns (bool success) {
        if (!isSupportedParachain(paraId)) revert UnsupportedParachain(paraId);
        if (amount == 0) revert ZeroAmount();
        if (beneficiary == bytes32(0)) revert ZeroBeneficiary();

        bytes memory xcmMessage = buildTransferXCM(paraId, beneficiary, amount);
        uint64 weight = estimateWeight(xcmMessage);
        _executeXCM(xcmMessage, weight);

        emit XCMDispatched(paraId, beneficiary, amount);
        return true;
    }

    /**
     * @dev Builds an XCM V3 transfer message for a supported parachain.
     * @param paraId      Target parachain ID (2034=Hydration, 2030=Bifrost, 2004=Moonbeam)
     * @param beneficiary Recipient as bytes32
     * @param amount      Amount of native tokens to transfer
     * @return xcmMessage Encoded XCM V3 message bytes
     */
    function buildTransferXCM(
        uint32 paraId,
        bytes32 beneficiary,
        uint256 amount
    ) public pure returns (bytes memory xcmMessage) {
        if (!_isSupportedParachainPure(paraId)) revert UnsupportedParachain(paraId);

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
     * @dev Estimates execution weight for an XCM message by querying the precompile.
     *      Returns 1 billion weight units as fallback when precompile is unavailable.
     * @param xcmMessage The XCM message bytes to estimate
     * @return weight    Estimated execution weight
     */
    function estimateWeight(bytes memory xcmMessage) public view returns (uint64 weight) {
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
     * @dev Checks whether a parachain ID is supported.
     * @param paraId The parachain ID to check
     * @return True if the parachain is registered
     */
    function isSupportedParachain(uint32 paraId) public view returns (bool) {
        for (uint256 i = 0; i < supportedParachains.length; i++) {
            if (supportedParachains[i] == paraId) return true;
        }
        return false;
    }

    /**
     * @dev Returns the array of all supported parachain IDs.
     */
    function getSupportedParachains() external view returns (uint32[] memory) {
        return supportedParachains;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _executeXCM(bytes memory xcmMessage, uint64 weight) internal {
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

    /// @dev Pure parachain check, usable inside pure functions.
    function _isSupportedParachainPure(uint32 paraId) internal pure returns (bool) {
        return paraId == 2034 || paraId == 2030 || paraId == 2004;
    }

    /// @dev Encodes a fungible native asset for XCM.
    function _encodeMultiAsset(uint256 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint8(0), // Concrete asset
            uint8(0), // Here
            uint8(1), // Fungible
            amount
        );
    }

    /**
     * @dev Encodes an XCM MultiLocation for a parachain + AccountId32.
     * @param paraId  Target parachain ID
     * @param account 32-byte account identifier
     */
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
    // Receive
    // ─────────────────────────────────────────────────────────────────────────

    receive() external payable {}
}
