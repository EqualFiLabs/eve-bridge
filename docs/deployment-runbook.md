# Base to Robinhood deployment runbook

This repository does not deploy automatically. Every state-changing step requires a separate operator decision and Safe review.

## 1. Freeze and verify the artifact

Use a reviewed commit and a clean checkout:

```bash
pnpm install --frozen-lockfile
pnpm verify
set -a
source ../../.rpc
set +a
pnpm bridge preflight
pnpm bridge predict
```

`preflight` must report Base chain ID 8453, Robinhood chain ID 4663, matching canonical CREATE2 factory hashes, the approved 2-of-2 Safe, correct EVE metadata, and empty predicted addresses. Stop if any check differs.

Record the commit, compiler version, salts, init-code hashes, predicted addresses, RPC block numbers, and reviewers in the release record. A contract or compiler change changes init code and therefore may change the predicted address.

## 2. Generate unsigned transactions

```bash
pnpm bridge prepare --out generated/eve-base-robinhood.json
```

The manifest contains full CREATE2 deployment calldata and ordered pathway transactions. `generated/` is ignored because manifests may become stale and are not deployment records.

Decode and independently reproduce every transaction. Confirm:

- the CREATE2 target is `0x4e59b44847b379578588920cA78FbF26c0B4956C`;
- constructor token, endpoint, owner/delegate, salt, and predicted address match the reviewed release record;
- both predicted addresses still have no code;
- the Safe transaction simulation succeeds without delegates or unexpected calls.

Anyone may submit the CREATE2 calls, but use the reviewed Safe process unless the signers explicitly approve a separate deployment account. Contract ownership and endpoint delegation are assigned directly to the Safe in the constructors.

## 3. Deploy and reconcile records

Deploy `EveOFT` on Robinhood and `EveOFTAdapter` on Base. After each receipt, verify runtime code, constructor state, `owner()`, `endpoint()`, `token()`, zero Robinhood supply, and 6 shared decimals.

Re-run the deterministic Hardhat deployment task with an authorized account to reconcile local `deployments/` records if the raw Safe manifest was used:

```bash
pnpm hardhat deploy --network robinhood --tags EveOFT
pnpm hardhat deploy --network base --tags EveOFTAdapter
```

The tasks use deterministic deployment and should detect matching code. Abort if they propose a different address or transaction.

## 4. Configure security before peers

For each chain, execute manifest steps 1 through 5 in order:

1. set SendUln302;
2. set ReceiveUln302 with zero grace period for the initial setup;
3. set the explicit executor and send ULN requiring LayerZero Labs plus Nethermind with 20 confirmations;
4. set the receive ULN with the same required DVNs and confirmations;
5. enforce 200,000 `lzReceive` gas and zero value for OFT message types 1 and 2.

The committed `layerzero.config.ts` is an independent LayerZero-tooling representation. Generate its dry-run and compare it to the manifest, but do not submit its peer-first transaction order:

```bash
pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.ts --dry-run --ci --output-filename generated/lz-wire.json
```

After steps 1-5 are confirmed on both chains, inspect the active configs with LayerZero tooling and the operator status command. Peer mismatches are expected at this point; every other check must match.

## 5. Set peers last

Execute step 6 on both chains only after both security configurations are confirmed. Each peer must be the left-padded bytes32 form of the opposite reviewed deployment address.

```bash
pnpm bridge status
pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.ts --assert --ci
```

Both commands must report no mismatch or required transaction.

## 6. Canary and release record

Quote and bridge the smallest practical canary from Base to Robinhood, then return it:

```bash
pnpm bridge quote --from base --amount 0.000001 --to 0xRECIPIENT
pnpm bridge send --from base --amount 0.000001 --to 0xRECIPIENT --broadcast --yes
```

The `send` command requires a user key and is not a Safe administration path. Before broadcasting, verify the wallet, recipient, normalized amount, native fee, and balance. Confirm LayerZero delivery, Base collateral locked, Robinhood supply minted, return burn, and Base collateral released.

Commit a factual deployment record containing addresses, transaction hashes, blocks, code hashes, active pathway configuration, canary GUIDs, and verification links. Do not commit private RPC URLs, keys, signatures, or scratch manifests.
