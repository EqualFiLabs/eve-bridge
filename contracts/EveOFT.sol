// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";

/// @title EVE Omnichain Fungible Token
/// @notice Burn-and-mint representation of canonical Base EVE on LayerZero-supported chains.
/// @dev Supply can only be created by authenticated LayerZero receives and is burned when sent.
contract EveOFT is OFT, ERC20Permit {
    string public constant TOKEN_NAME = "0xAgentEVE";
    string public constant TOKEN_SYMBOL = "EVE";

    constructor(
        address endpoint_,
        address delegate_
    ) OFT(TOKEN_NAME, TOKEN_SYMBOL, endpoint_, delegate_) ERC20Permit(TOKEN_NAME) Ownable(delegate_) {}
}
