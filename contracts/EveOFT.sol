// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";

/// @title EVE Omnichain Fungible Token
/// @notice Burn-and-mint representation of canonical Base EVE on LayerZero-supported chains.
/// @dev Supply can only be created by authenticated LayerZero receives and is burned when sent.
contract EveOFT is OFT, ERC20Permit {
    error OwnershipRenunciationDisabled();

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    string public constant TOKEN_NAME = "0xAgentEVE";
    string public constant TOKEN_SYMBOL = "EVE";

    address public pendingOwner;

    constructor(
        address endpoint_,
        address delegate_
    ) OFT(TOKEN_NAME, TOKEN_SYMBOL, endpoint_, delegate_) ERC20Permit(TOKEN_NAME) Ownable(delegate_) {}

    function transferOwnership(address newOwner) public override onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner(), newOwner);
    }

    function acceptOwnership() public {
        address sender = _msgSender();
        if (pendingOwner != sender) revert OwnableUnauthorizedAccount(sender);

        pendingOwner = address(0);
        _transferOwnership(sender);
        endpoint.setDelegate(sender);
    }

    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }
}
