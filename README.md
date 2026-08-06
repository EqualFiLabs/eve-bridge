# EVE Bridge

Production-oriented LayerZero V2 OFT infrastructure for canonical EVE on Base.

The bridge keeps EVE canonical on Base. A single immutable `EveOFTAdapter` locks and unlocks the existing token; `EveOFT` contracts burn and mint the cross-chain representation on Robinhood Chain and future LayerZero-supported networks.

```text
Base EVE: 0xe7d192e52fa418236d6eecf7d5eb38da9dd11ba3
Owner/delegate Safe: 0x603A8A2f22ac1d61E9c932A4F6Fa23170CEcb9Ff
```

The Base-Robinhood mainnet pathway is deployed, fully configured, and live. See the
[deployment record](docs/deployments/base-robinhood-mainnet.md) for verified addresses, configuration, and round-trip canary evidence.

## Design

- Base uses exactly one stock, immutable LayerZero V2 `OFTAdapter`.
- Robinhood and future chains use zero-initial-supply mint/burn OFTs.
- Destination OFTs add ERC-2612 permit but no owner mint, votes, fees, pause, rate limit, URI, vesting, inflation, or special Permit2 allowance.
- Shared decimals are 6; local decimals are 18. Amounts below `0.000001 EVE` granularity remain on the source chain as dust.
- The 2-of-2 Safe is both contract owner and LayerZero endpoint delegate.
- The initial pathway requires LayerZero Labs and Nethermind DVNs, 20 confirmations each way, explicit executors, and 200,000 enforced receive gas.
- Deployment uses the canonical CREATE2 factory with committed, domain-separated salts.

See [architecture](docs/architecture.md), [security model](docs/security.md), [deployment runbook](docs/deployment-runbook.md), [mainnet deployment record](docs/deployments/base-robinhood-mainnet.md), and [new-chain runbook](docs/add-chain.md).

## Development

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Load RPC variables without copying credentials into the repository:

```bash
set -a
source ../../.rpc
set +a
pnpm bridge preflight
pnpm bridge predict
```

The operator CLI is read-only or unsigned by default:

```bash
pnpm bridge help
pnpm bridge prepare --out generated/manifest.json
pnpm bridge status
pnpm bridge quote --from base --amount 1 --to 0x...
```

`send` refuses to broadcast unless both `--broadcast` and `--yes` are supplied. Never commit RPC URLs containing credentials, private keys, mnemonics, Safe signatures, or generated transaction manifests.

## License

Business Source License 1.1. See [LICENSE](LICENSE).
