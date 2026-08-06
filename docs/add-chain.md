# Add a LayerZero-supported chain

Adding a chain does not require changing or redeploying the Base adapter.

## Qualification

Confirm from current LayerZero production metadata that the chain has Endpoint V2, SendUln302, ReceiveUln302, an executor, and the selected required DVNs. Confirm the chain supports the compiler's emitted EVM target, the canonical CREATE2 factory has the expected runtime hash, and the approved Safe exists with the correct owners and threshold.

Decide whether the new chain needs only its mandatory Base pathway or optional direct pathways to Robinhood and other remote OFTs. More pathways improve routing but expand configuration surface and monitoring work.

## Repository changes

1. Add the chain ID, EID, endpoint, libraries, executor, sorted DVN addresses, and RPC environment key to `config/constants.ts` and `hardhat.config.ts`.
2. Deploy the unchanged `EveOFT` artifact. Its default salt label is `EVE_BRIDGE_<EID>_OFT_V1`; document any exception before deployment.
3. Extend `layerzero.config.ts` with a Base-to-new-chain pathway. Add remote-to-remote pathways only when explicitly approved.
4. Extend the operator CLI's network selection, preflight, prediction, unsigned manifests, quoting, and status checks.
5. Add a configuration-generation test and retain the existing three-chain supply-invariant test.
6. Run the full validation and security review again. A dependency or compiler change can alter bytecode even when Solidity source is unchanged.

## Deployment sequence

Run the same process as the initial deployment: verify external contracts and the empty predicted address, deploy the zero-supply OFT, configure both sides of each pathway, verify the active security settings, and set peers last.

Never deploy another `EveOFTAdapter`. Every new network receives `EveOFT`, and every remote token remains backed by EVE locked in the one Base adapter.
