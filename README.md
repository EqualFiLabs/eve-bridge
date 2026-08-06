# EVE Bridge

LayerZero V2 bridge infrastructure for canonical EVE on Base.

This repository is being built around one lock/unlock `OFTAdapter` on Base and mint/burn OFTs on Robinhood Chain and future LayerZero-supported networks. The canonical token remains:

```text
Base EVE: 0xe7d192e52fa418236d6eecf7d5eb38da9dd11ba3
```

## Current status

Repository foundation only. No EVE adapter or remote OFT has been deployed, wired, approved, or funded.

## Toolchain

- LayerZero V2 OFT contracts and developer tooling
- Solidity, Foundry, and Hardhat
- TypeScript and pnpm

Install and validate:

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Never commit RPC URLs containing credentials, private keys, mnemonics, Safe signatures, or scratch deployment output.

## License

Business Source License 1.1. See [LICENSE](LICENSE).
