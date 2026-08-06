# Architecture

## Supply topology

```text
canonical EVE on Base
        |
        | lock / unlock
        v
one EveOFTAdapter on Base <------ LayerZero V2 ------> EveOFT on Robinhood
        ^                                                   |
        |                                                   | optional direct routes
        +---------------- LayerZero V2 ---------------------+------> future EveOFTs
```

Base is the only collateral origin. Sending from Base transfers canonical EVE into the adapter and mints the same normalized amount on the destination. Sending back burns destination EVE and releases the locked Base token. Transfers between destination OFTs burn on the source and mint on the destination; they do not touch Base collateral.

The accessible-supply invariant is:

```text
canonical EVE outside the adapter + total supply of every remote OFT
= canonical Base supply
```

This assumes the canonical token remains lossless and every peer/security configuration is correct. There must never be a second adapter for canonical EVE.

## Contracts

`EveOFTAdapter` is a thin stock LayerZero V2 adapter. Its token, endpoint, and initial owner/delegate are constructor immutables or constructor-defined ownership. It has no upgrade path and no token rescue function.

`EveOFT` is a stock LayerZero V2 OFT with ERC-2612 permit. It begins with zero supply and exposes no public or owner mint function. Authenticated LayerZero receives are the only mint path, and cross-chain sends burn.

The remote representation intentionally does not reproduce canonical-token governance votes, vesting, pool-lock rules, inflation controls, the special Permit2 allowance, or `tokenURI`. The canonical `tokenURI` is an owner-updatable metadata pointer on the Base token; it is not required for ERC-20 or OFT bridging and remains authoritative only on Base.

## Mesh growth

Every new OFT must connect to Base. Direct remote-to-remote pathways are optional and can be added when they improve routing. The Base adapter never changes when a new chain joins; only LayerZero configuration and a new remote OFT are added.

The shared-decimal value is 6, LayerZero's standard OFT default. EVE has 18 local decimals, producing a `10^12` decimal conversion rate. The contracts remove sub-conversion-rate dust before debit.

## Administration

The owner and LayerZero delegate are the same 2-of-2 Safe on every chain. Ownership controls peers and enforced options; endpoint delegation controls message libraries, executors, DVNs, and confirmation settings. Those permissions collectively protect the bridge supply invariant and must be treated as critical custody roles.
