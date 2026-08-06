// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

/// @dev Test-only endpoint surface that records OApp delegates.
contract EndpointDelegateMock {
    mapping(address oapp => address delegate) public delegates;

    function setDelegate(address delegate) external {
        delegates[msg.sender] = delegate;
    }
}
