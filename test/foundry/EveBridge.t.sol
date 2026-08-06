// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import { MessagingFee } from "@layerzerolabs/oft-evm/contracts/OFTCore.sol";
import { SendParam } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { TestHelperOz5 } from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

import { EveOFT } from "../../contracts/EveOFT.sol";
import { EveOFTAdapter } from "../../contracts/EveOFTAdapter.sol";
import { ERC20Mock } from "../mocks/ERC20Mock.sol";

contract EveBridgeTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 private constant BASE_EID = 1;
    uint32 private constant ROBINHOOD_EID = 2;
    uint32 private constant THIRD_CHAIN_EID = 3;
    uint256 private constant INITIAL_BALANCE = 100 ether;
    uint256 private constant USER_KEY = 0xA11CE;
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    ERC20Mock private baseToken;
    EveOFTAdapter private baseAdapter;
    EveOFT private robinhoodOft;
    EveOFT private thirdChainOft;
    address private user;
    address private recipient = address(0xBEEF);

    function setUp() public override {
        super.setUp();
        setUpEndpoints(3, LibraryType.UltraLightNode);

        user = vm.addr(USER_KEY);
        vm.deal(user, 100 ether);

        baseToken = ERC20Mock(_deployOApp(type(ERC20Mock).creationCode, abi.encode("0xAgentEVE", "EVE")));
        baseAdapter = EveOFTAdapter(
            _deployOApp(
                type(EveOFTAdapter).creationCode,
                abi.encode(address(baseToken), address(endpoints[BASE_EID]), address(this))
            )
        );
        robinhoodOft = EveOFT(
            _deployOApp(type(EveOFT).creationCode, abi.encode(address(endpoints[ROBINHOOD_EID]), address(this)))
        );
        thirdChainOft = EveOFT(
            _deployOApp(type(EveOFT).creationCode, abi.encode(address(endpoints[THIRD_CHAIN_EID]), address(this)))
        );

        address[] memory oapps = new address[](3);
        oapps[0] = address(baseAdapter);
        oapps[1] = address(robinhoodOft);
        oapps[2] = address(thirdChainOft);
        this.wireOApps(oapps);

        baseToken.mint(user, INITIAL_BALANCE);
    }

    function testConfigurationAndSupplyStartSafe() public view {
        assertEq(baseAdapter.owner(), address(this));
        assertEq(robinhoodOft.owner(), address(this));
        assertEq(baseAdapter.token(), address(baseToken));
        assertEq(robinhoodOft.token(), address(robinhoodOft));
        assertEq(baseAdapter.sharedDecimals(), 6);
        assertEq(robinhoodOft.sharedDecimals(), 6);
        assertEq(robinhoodOft.name(), "0xAgentEVE");
        assertEq(robinhoodOft.symbol(), "EVE");
        assertEq(robinhoodOft.totalSupply(), 0);
    }

    function testOnlyOwnerCanConfigurePeer() public {
        vm.prank(user);
        vm.expectRevert();
        baseAdapter.setPeer(99, bytes32(uint256(uint160(recipient))));
    }

    function testBaseToRobinhoodAndBackPreservesAccessibleSupply() public {
        uint256 amount = 4 ether;
        _sendFromBase(ROBINHOOD_EID, address(robinhoodOft), user, amount, amount);

        assertEq(baseToken.balanceOf(address(baseAdapter)), amount);
        assertEq(robinhoodOft.balanceOf(user), amount);
        assertEq(baseToken.balanceOf(user) + robinhoodOft.totalSupply(), INITIAL_BALANCE);

        _sendFromOft(robinhoodOft, BASE_EID, address(baseAdapter), user, amount);

        assertEq(baseToken.balanceOf(address(baseAdapter)), 0);
        assertEq(robinhoodOft.totalSupply(), 0);
        assertEq(baseToken.balanceOf(user), INITIAL_BALANCE);
    }

    function testDustRemainsOnBaseAndNormalizedAmountBridges() public {
        uint256 dust = 123;
        uint256 requested = 1 ether + dust;
        uint256 normalized = 1 ether;

        _sendFromBase(ROBINHOOD_EID, address(robinhoodOft), user, requested, normalized);

        assertEq(baseToken.balanceOf(user), INITIAL_BALANCE - normalized);
        assertEq(baseToken.balanceOf(address(baseAdapter)), normalized);
        assertEq(robinhoodOft.balanceOf(user), normalized);
    }

    function testDestinationTokenSupportsPermit() public {
        uint256 amount = 2 ether;
        uint256 allowance = 1 ether;
        uint256 deadline = block.timestamp + 1 days;
        _sendFromBase(ROBINHOOD_EID, address(robinhoodOft), user, amount, amount);

        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, user, recipient, allowance, robinhoodOft.nonces(user), deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", robinhoodOft.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(USER_KEY, digest);

        robinhoodOft.permit(user, recipient, allowance, deadline, v, r, s);

        assertEq(robinhoodOft.allowance(user, recipient), allowance);
        assertEq(robinhoodOft.nonces(user), 1);
    }

    function testNewOFTCanJoinWithoutChangingBaseAdapter() public {
        uint256 amount = 3 ether;
        _sendFromBase(ROBINHOOD_EID, address(robinhoodOft), user, amount, amount);
        _sendFromOft(robinhoodOft, THIRD_CHAIN_EID, address(thirdChainOft), user, amount);

        assertEq(robinhoodOft.totalSupply(), 0);
        assertEq(thirdChainOft.balanceOf(user), amount);
        assertEq(baseToken.balanceOf(address(baseAdapter)), amount);
        assertEq(baseToken.balanceOf(user) + thirdChainOft.totalSupply(), INITIAL_BALANCE);
    }

    function _sendFromBase(
        uint32 destinationEid,
        address destinationOft,
        address receiver,
        uint256 amount,
        uint256 minimumAmount
    ) private {
        SendParam memory sendParam = _sendParam(destinationEid, receiver, amount, minimumAmount);
        MessagingFee memory fee = baseAdapter.quoteSend(sendParam, false);

        vm.startPrank(user);
        baseToken.approve(address(baseAdapter), amount);
        baseAdapter.send{ value: fee.nativeFee }(sendParam, fee, payable(user));
        vm.stopPrank();

        verifyPackets(destinationEid, addressToBytes32(destinationOft));
    }

    function _sendFromOft(
        EveOFT source,
        uint32 destinationEid,
        address destinationOft,
        address receiver,
        uint256 amount
    ) private {
        SendParam memory sendParam = _sendParam(destinationEid, receiver, amount, amount);
        MessagingFee memory fee = source.quoteSend(sendParam, false);

        vm.prank(user);
        source.send{ value: fee.nativeFee }(sendParam, fee, payable(user));

        verifyPackets(destinationEid, addressToBytes32(destinationOft));
    }

    function _sendParam(
        uint32 destinationEid,
        address receiver,
        uint256 amount,
        uint256 minimumAmount
    ) private pure returns (SendParam memory) {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200_000, 0);
        return
            SendParam({
                dstEid: destinationEid,
                to: addressToBytes32(receiver),
                amountLD: amount,
                minAmountLD: minimumAmount,
                extraOptions: options,
                composeMsg: "",
                oftCmd: ""
            });
    }
}
