// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test-only lossless ERC-20 with the same metadata and decimals as canonical EVE.
contract EveERC20Mock is ERC20 {
    constructor() ERC20("0xAgentEVE", "EVE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
