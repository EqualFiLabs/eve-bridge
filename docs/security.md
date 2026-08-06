# Security model

## Trust assumptions

- Canonical EVE remains a lossless 18-decimal ERC-20. A future transfer fee, rebase, or other balance-changing behavior would invalidate the stock adapter accounting.
- The canonical token's pool lock must never target the adapter while locked; doing so would block new Base-to-remote transfers.
- Direct ERC-20 transfers to the adapter do not mint remote EVE and become stranded surplus; monitor solvency as collateral greater than or equal to aggregate remote supply.
- A return recipient on Base must not be the canonical token's currently locked pool. That transfer would revert after the remote burn and remain undeliverable; the operator CLI rejects the live locked-pool address.
- The 2-of-2 Safe owners verify every deployment and configuration transaction on the correct chain before signing.
- The approved Safe singleton remains installed and no module is enabled; modules can bypass the normal signature threshold.
- Both required DVNs, LayerZero Labs and Nethermind, must verify a message. Twenty source-chain confirmations are required in each direction.
- The configured LayerZero endpoints, message libraries, executors, and destination chains continue to operate as expected.
- Only the committed Base adapter is treated as canonical. Deploying another adapter can fragment or inflate the global representation.

## Privileged actions

The Safe can change peers, message libraries, DVNs, confirmations, executors, enforced options, endpoint delegate, and contract ownership. It cannot directly call an owner-only mint because none exists. A malicious peer or security configuration could nevertheless authorize unbacked remote supply or release locked Base collateral, so configuration authority is economically equivalent to bridge custody.

Ownership renunciation is disabled. A future Safe migration starts a two-step ownership transfer; when the new Safe accepts, the contract atomically makes it the LayerZero endpoint delegate. Verify both roles after acceptance.

The contracts deliberately omit upgrades, emergency pause, rescue, bridge fees, rate limits, and owner minting. This reduces privileged code paths but means incident response is configuration-based: remove or block pathways at LayerZero, never create a replacement adapter against the same collateral pool without a separately reviewed migration.

## Operational invariants

- Verify chain ID, endpoint code, CREATE2 factory runtime hash, Safe owners/threshold, token metadata, salt, init-code hash, and empty predicted address before deployment.
- Configure libraries, executor, ULN/DVNs, confirmations, and enforced receive options on both chains before setting either peer.
- Set peers last. Do not enable one-way traffic while the opposite receive path is incomplete.
- Compare unsigned manifests to `layerzero.config.ts`, simulate every Safe transaction, and run `pnpm bridge status` after execution.
- Start with a minimal round trip, verify locked collateral and remote supply, then raise operational limits outside the contracts only after observing delivery.
- Never expose a production private key through shell history, committed files, CI logs, or generated manifests.

## Validation boundaries

Local tests exercise production contract implementations against LayerZero endpoint mocks, including round trips, dust, permit, access control, and a third-chain extension. RPC preflight verifies current external addresses and Safe configuration. These checks are not a substitute for an independent audit, Safe transaction simulation, or a live minimal-value canary after deployment.
