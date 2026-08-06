# Base-Robinhood mainnet deployment

Status: **active**

The Base-Robinhood EVE pathway was activated on 2026-08-06. The deployed artifact is the reviewed and merged commit `7c5a1783d91ce2e28380b999d95efd801e56fd7b`.

## Contracts

| Role            | Chain     | Chain ID / EID   | Address                                                                                                                                  | Runtime code hash                                                    |
| --------------- | --------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Canonical EVE   | Base      | `8453` / `30184` | [`0xe7d192e52fa418236d6eecf7d5eb38da9dd11ba3`](https://basescan.org/address/0xe7d192e52fa418236d6eecf7d5eb38da9dd11ba3)                  | External canonical token                                             |
| `EveOFTAdapter` | Base      | `8453` / `30184` | [`0x160407eFa8556D4CDbf53b543EB36d860ac5a171`](https://basescan.org/address/0x160407efa8556d4cdbf53b543eb36d860ac5a171)                  | `0x808280260c92d73d9b66aae0bdf3a828823633504e0404db5a1d440a7fe0cf8f` |
| `EveOFT`        | Robinhood | `4663` / `30416` | [`0x12Fa0ec31BE30677Fa38274b3AFBc2A0fCE7648F`](https://robinhoodchain.blockscout.com/address/0x12fa0ec31be30677fa38274b3afbc2a0fce7648f) | `0x07970b520fc8a7080870867582ad3a1943fd7bd69dc12b42b723255f2e5cca8a` |

Both bridge contracts use 18 local decimals and 6 shared decimals. The Base adapter is the only collateral adapter for canonical EVE. The Robinhood OFT began with zero supply and can mint only through authenticated LayerZero receives.

## Deterministic deployment inputs

The contracts were compiled with Solidity `0.8.26` and deployed through the canonical CREATE2 factory `0x4e59b44847b379578588920cA78FbF26c0B4956C`.

| Contract      | Salt label                    | Salt                                                                 | Init-code hash                                                       |
| ------------- | ----------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Base adapter  | `EVE_BRIDGE_BASE_ADAPTER_V1`  | `0xfaa129dd45acc5416eee70ebc00a9fa7aad9266de1a8e43dcf11f7cc1acae638` | `0x6c739520ebdcc909e38bcecd5b349d17790499037900fe0d1de7f91f98dd5fb4` |
| Robinhood OFT | `EVE_BRIDGE_ROBINHOOD_OFT_V1` | `0xb7049f4f33fd983c1c3407c9e541dd06829519de086e1f7fe8cde84dfe5569ac` | `0x749c23ce864f704d62c2055e1b33b81d3b6b0325c7713bb567050aa47df754f1` |

## Administration and active pathway

The owner and LayerZero endpoint delegate on both chains is the 2-of-2 Safe `0x603A8A2f22ac1d61E9c932A4F6Fa23170CEcb9Ff`.

| Setting                       | Base                                         | Robinhood                                    |
| ----------------------------- | -------------------------------------------- | -------------------------------------------- |
| Endpoint                      | `0x1a44076050125825900e736c501f859c50fE728c` | `0x6F475642a6e85809B1c36Fa62763669b1b48DD5B` |
| Explicit send library         | `0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2` | `0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7` |
| Receive library               | `0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf` | `0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043` |
| Executor                      | `0x2CCA08ae69E0C44b18a57Ab2A87644234dAebaE4` | `0x4208D6E27538189bB48E603D6123A94b8Abe0A0b` |
| Required DVN: LayerZero Labs  | `0x9e059a54699a285714207b43B055483E78FAac25` | `0x0Ffe02DF012299A370D5dd69298A5826EAcaFdF8` |
| Required DVN: Nethermind      | `0xcd37CA043f8479064e10635020c65FfC005d36f6` | `0xd01ae6905d48315f7bE10C7330aeCF8360Ef5b12` |
| Confirmations, send / receive | `20` / `20`                                  | `20` / `20`                                  |
| Optional DVNs                 | None                                         | None                                         |
| Peer                          | Robinhood OFT, left-padded bytes32           | Base adapter, left-padded bytes32            |

OFT message types 1 and 2 enforce 200,000 `lzReceive` gas and zero receive value. The receive-library timeout is inactive on both chains. `pnpm bridge status` reported every ownership, delegate, peer, library, executor, ULN, DVN, confirmation, timeout, and enforced-option check as passing after activation.

## Deployment and configuration transactions

| Step                         | Chain     |      Block | Transaction                                                                                                                                                                         |
| ---------------------------- | --------- | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy Base adapter          | Base      | `49632211` | [`0xd39541e5273fcf96b0a0c6c952f3d7d91a6d9fdfc0edcbe27d3bf66737002530`](https://basescan.org/tx/0xd39541e5273fcf96b0a0c6c952f3d7d91a6d9fdfc0edcbe27d3bf66737002530)                  |
| Deploy Robinhood OFT         | Robinhood | `29699205` | [`0x89f1b385527b88175af60bc33f3479eec217f3c94d16ac7977efbae18682d5e8`](https://robinhoodchain.blockscout.com/tx/0x89f1b385527b88175af60bc33f3479eec217f3c94d16ac7977efbae18682d5e8) |
| Configure Base security      | Base      | `49632781` | [`0x290b2e31f5472ccd4e0baed6a4fde30cba18f297bd52b1ec2ff10915e3f135b5`](https://basescan.org/tx/0x290b2e31f5472ccd4e0baed6a4fde30cba18f297bd52b1ec2ff10915e3f135b5)                  |
| Configure Robinhood security | Robinhood | `29706621` | [`0xa36e462ba931f80e92f1c2d39ac382678380937c5a43a2c6e18c89f3d63e744d`](https://robinhoodchain.blockscout.com/tx/0xa36e462ba931f80e92f1c2d39ac382678380937c5a43a2c6e18c89f3d63e744d) |
| Set Robinhood peer           | Robinhood | `29710578` | [`0xcf61e6bbceb6f2f82a5969cf404563d33137687ce30cf3e42648c26327f04dbd`](https://robinhoodchain.blockscout.com/tx/0xcf61e6bbceb6f2f82a5969cf404563d33137687ce30cf3e42648c26327f04dbd) |
| Set Base peer and activate   | Base      | `49633204` | [`0x56e9ef8c9072fad8669b181b754be7b9be5984d86bf05688bb337137b228213f`](https://basescan.org/tx/0x56e9ef8c9072fad8669b181b754be7b9be5984d86bf05688bb337137b228213f)                  |

Every Safe execution above was reconciled against the prepared manifest calldata and successful receipt before proceeding to the next phase. Security configuration was completed on both chains before either peer was set; the Base peer was set last.

## Live round-trip canary

The Safe bridged the minimum shared-decimal unit, `0.000001 EVE` (`1,000,000,000,000` local units), from Base to Robinhood and back.

| Leg               | Source transaction                                                                                                                                                                                              | LayerZero GUID                                                       | Destination transaction                                                                                                                                                                                         | Result                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Base to Robinhood | Base block `49633917`, [`0x9315716e8dadc4efa801de56cced6e74eab9a38261b29e0b4372274d290288a1`](https://basescan.org/tx/0x9315716e8dadc4efa801de56cced6e74eab9a38261b29e0b4372274d290288a1)                       | `0x23129bc52ff1afb5bc118ec4a024eceb722ab6000c23af37c7d7f2f53d796f14` | Robinhood block `29727430`, [`0x0679a3da2090f5a4c25906a534a596b8f549ee2e5f1c27b71dd5bf338bf08acd`](https://robinhoodchain.blockscout.com/tx/0x0679a3da2090f5a4c25906a534a596b8f549ee2e5f1c27b71dd5bf338bf08acd) | Adapter locked and OFT minted exactly `0.000001 EVE`   |
| Robinhood to Base | Robinhood block `29729813`, [`0xdde17a27c52c09e4d735ffe5da41907bdfc0dd15dd387f2ff0e1cb07f319dedd`](https://robinhoodchain.blockscout.com/tx/0xdde17a27c52c09e4d735ffe5da41907bdfc0dd15dd387f2ff0e1cb07f319dedd) | `0xd6631881476b24989adee5e53ab9b3a813c08b5717ee6d1e15fac17c53bbad76` | Base block `49634084`, [`0xd8004c64aaf214350944806c6b7c891f5e28f0039fed9960fee992a50bb3025a`](https://basescan.org/tx/0xd8004c64aaf214350944806c6b7c891f5e28f0039fed9960fee992a50bb3025a)                       | OFT burned and adapter released exactly `0.000001 EVE` |

After the return delivery, the Safe's Robinhood EVE balance and Base adapter allowance were both zero, and its Base EVE balance matched the pre-canary balance.

The bridge received unrelated live traffic during the canary. At Base block `49634177` and Robinhood block `29731965`, the adapter held `4,374,960.669272 EVE` and Robinhood OFT total supply was `4,374,960.669272 EVE`, with no collateral surplus at that snapshot. These are historical block-scoped observations, not fixed balances.

## Verification scope

- The merged artifact passed repository lint, formatting, type checking, Foundry and Hardhat compilation, 6 Foundry tests, and 5 Hardhat tests before deployment.
- Deployment, configuration, peer, canary-source, and canary-delivery receipts were checked live on their respective chains.
- Both deployed source contracts are explorer-verified through the contract links above.
- The independent `pnpm hardhat lz:oapp:wire --assert --ci` check remains blocked until the raw Safe deployments are reconciled into local `hardhat-deploy` records. Its attempted run made no chain writes; the live operator status check passes.
- The live round trip demonstrates the configured pathway at minimum value; it does not replace independent third-party security review or continuous solvency and LayerZero-configuration monitoring.
