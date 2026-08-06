// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OFTAdapter } from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";

/// @title EVE OFT Adapter
/// @notice Locks canonical EVE on Base and releases it when EVE returns from another chain.
/// @dev Exactly one adapter may exist in the EVE OFT mesh. The canonical token must be lossless.
contract EveOFTAdapter is OFTAdapter {
    constructor(
        address token_,
        address endpoint_,
        address delegate_
    ) OFTAdapter(token_, endpoint_, delegate_) Ownable(delegate_) {}
}
