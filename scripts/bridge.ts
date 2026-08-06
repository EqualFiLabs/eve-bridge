import 'dotenv/config'

import fs from 'fs'
import path from 'path'

import { BigNumber, Contract, Wallet, providers, utils } from 'ethers'

import { Options } from '@layerzerolabs/lz-v2-utilities'

import {
    BASE_ADAPTER_SALT,
    BASE_ADAPTER_SALT_LABEL,
    CREATE2_FACTORY,
    CREATE2_FACTORY_RUNTIME_HASH,
    EVE,
    NETWORKS,
    PATHWAY,
    ROBINHOOD_OFT_SALT,
    ROBINHOOD_OFT_SALT_LABEL,
} from '../config/constants'

type ChainName = keyof typeof NETWORKS
type Arguments = Record<string, string | boolean>
type SendParamTuple = [number, string, BigNumber, BigNumber, string, string, string]

type DeploymentPlan = {
    chain: ChainName
    chainId: number
    contractName: 'EveOFTAdapter' | 'EveOFT'
    saltLabel: string
    salt: string
    initCode: string
    initCodeHash: string
    predictedAddress: string
    transaction: { to: string; data: string; value: string }
}

const ERC20_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
]
const SAFE_ABI = ['function getOwners() view returns (address[])', 'function getThreshold() view returns (uint256)']
const OAPP_ABI = [
    'function owner() view returns (address)',
    'function endpoint() view returns (address)',
    'function peers(uint32) view returns (bytes32)',
    'function enforcedOptions(uint32,uint16) view returns (bytes)',
    'function quoteSend((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),bool) view returns ((uint256,uint256))',
    'function send((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),(uint256,uint256),address) payable',
]
const ENDPOINT_ABI = [
    'function getSendLibrary(address,uint32) view returns (address)',
    'function getReceiveLibrary(address,uint32) view returns (address,bool)',
    'function getConfig(address,address,uint32,uint32) view returns (bytes)',
]

function parseArguments(values: string[]): { command: string; args: Arguments } {
    const [command = 'help', ...rest] = values
    const args: Arguments = {}
    for (let i = 0; i < rest.length; i += 1) {
        const value = rest[i]
        if (!value.startsWith('--')) throw new Error(`Unexpected argument: ${value}`)
        const key = value.slice(2)
        const following = rest[i + 1]
        if (following != null && !following.startsWith('--')) {
            args[key] = following
            i += 1
        } else {
            args[key] = true
        }
    }
    return { command, args }
}

function requiredString(args: Arguments, key: string): string {
    const value = args[key]
    if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing --${key}`)
    return value
}

function rpcUrl(chain: ChainName): string {
    const key = chain === 'base' ? 'BASE_MAINNET' : 'ROBINHOOD_MAINNET'
    const value = process.env[key]
    if (!value) throw new Error(`Missing ${key}. Source ../../.rpc or configure .env.`)
    return value
}

function provider(chain: ChainName): providers.JsonRpcProvider {
    return new providers.JsonRpcProvider(rpcUrl(chain), NETWORKS[chain].chainId)
}

function artifact(contractName: DeploymentPlan['contractName']): { bytecode: string } {
    const file = path.resolve(__dirname, '..', 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`)
    if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run pnpm compile:hardhat first.`)
    return JSON.parse(fs.readFileSync(file, 'utf8')) as { bytecode: string }
}

function deploymentPlan(
    chain: ChainName,
    contractName: DeploymentPlan['contractName'],
    saltLabel: string,
    salt: string,
    constructorTypes: string[],
    constructorArgs: string[]
): DeploymentPlan {
    const initCode = utils.hexConcat([
        artifact(contractName).bytecode,
        utils.defaultAbiCoder.encode(constructorTypes, constructorArgs),
    ])
    const initCodeHash = utils.keccak256(initCode)
    const predictedAddress = utils.getCreate2Address(CREATE2_FACTORY, salt, initCodeHash)
    return {
        chain,
        chainId: NETWORKS[chain].chainId,
        contractName,
        saltLabel,
        salt,
        initCode,
        initCodeHash,
        predictedAddress,
        transaction: { to: CREATE2_FACTORY, data: utils.hexConcat([salt, initCode]), value: '0' },
    }
}

function plans(): Record<ChainName, DeploymentPlan> {
    return {
        base: deploymentPlan(
            'base',
            'EveOFTAdapter',
            BASE_ADAPTER_SALT_LABEL,
            BASE_ADAPTER_SALT,
            ['address', 'address', 'address'],
            [EVE.canonicalToken, NETWORKS.base.endpoint, EVE.ownerAndDelegate]
        ),
        robinhood: deploymentPlan(
            'robinhood',
            'EveOFT',
            ROBINHOOD_OFT_SALT_LABEL,
            ROBINHOOD_OFT_SALT,
            ['address', 'address'],
            [NETWORKS.robinhood.endpoint, EVE.ownerAndDelegate]
        ),
    }
}

function printablePlan(plan: DeploymentPlan) {
    return { ...plan, initCode: undefined, transaction: { ...plan.transaction, data: undefined } }
}

async function assertCode(chain: ChainName, address: string, label: string): Promise<string> {
    const code = await provider(chain).getCode(address)
    if (code === '0x') throw new Error(`${label} has no code on ${chain}: ${address}`)
    return code
}

async function preflight(): Promise<void> {
    const predicted = plans()
    const results: Record<string, unknown> = {}

    for (const chain of ['base', 'robinhood'] as const) {
        const chainProvider = provider(chain)
        const network = await chainProvider.getNetwork()
        if (network.chainId !== NETWORKS[chain].chainId)
            throw new Error(`${chain} RPC returned chain ID ${network.chainId}`)

        await assertCode(chain, NETWORKS[chain].endpoint, 'LayerZero EndpointV2')
        const factoryCode = await assertCode(chain, CREATE2_FACTORY, 'CREATE2 factory')
        const factoryHash = utils.keccak256(factoryCode)
        if (factoryHash !== CREATE2_FACTORY_RUNTIME_HASH) {
            throw new Error(`${chain} CREATE2 factory runtime hash mismatch: ${factoryHash}`)
        }

        const safeCode = await assertCode(chain, EVE.ownerAndDelegate, 'owner/delegate Safe')
        const safe = new Contract(EVE.ownerAndDelegate, SAFE_ABI, chainProvider)
        const [owners, threshold] = await Promise.all([safe.getOwners(), safe.getThreshold()])
        const normalizedOwners = (owners as string[]).map((owner) => owner.toLowerCase()).sort()
        const expectedOwners = [...EVE.safeOwners].map((owner) => owner.toLowerCase()).sort()
        if (JSON.stringify(normalizedOwners) !== JSON.stringify(expectedOwners) || !threshold.eq(EVE.safeThreshold)) {
            throw new Error(`${chain} Safe ownership or threshold differs from the approved 2-of-2`)
        }

        results[chain] = {
            chainId: network.chainId,
            endpoint: NETWORKS[chain].endpoint,
            factoryRuntimeHash: factoryHash,
            safeRuntimeHash: utils.keccak256(safeCode),
            predictedAddress: predicted[chain].predictedAddress,
            predictedAddressHasCode: (await chainProvider.getCode(predicted[chain].predictedAddress)) !== '0x',
        }
    }

    const tokenCode = await assertCode('base', EVE.canonicalToken, 'canonical EVE')
    const token = new Contract(EVE.canonicalToken, ERC20_ABI, provider('base'))
    const [name, symbol, decimals] = await Promise.all([token.name(), token.symbol(), token.decimals()])
    if (name !== EVE.name || symbol !== EVE.symbol || decimals !== 18) {
        throw new Error(`Canonical token metadata mismatch: ${name}/${symbol}/${decimals}`)
    }
    results.canonicalToken = {
        address: EVE.canonicalToken,
        name,
        symbol,
        decimals,
        runtimeHash: utils.keccak256(tokenCode),
    }
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`)
}

async function predict(): Promise<void> {
    const predicted = plans()
    const output: Record<string, unknown> = {}
    for (const chain of ['base', 'robinhood'] as const) {
        output[chain] = {
            ...printablePlan(predicted[chain]),
            addressHasCode: (await provider(chain).getCode(predicted[chain].predictedAddress)) !== '0x',
        }
    }
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

async function prepare(args: Arguments): Promise<void> {
    const manifest = {
        generatedAt: new Date().toISOString(),
        create2Factory: CREATE2_FACTORY,
        deployments: Object.values(plans()),
        warning:
            'Unsigned transactions. Verify hashes, chain IDs, target emptiness, and Safe simulation before execution.',
    }
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`
    const output = args.out
    if (typeof output === 'string') {
        fs.writeFileSync(path.resolve(output), serialized, { flag: 'wx' })
        process.stdout.write(`Wrote unsigned manifest to ${path.resolve(output)}\n`)
    } else {
        process.stdout.write(serialized)
    }
}

function asBytes32(address: string): string {
    return utils.hexZeroPad(utils.getAddress(address), 32)
}

function sendParam(destinationEid: number, recipient: string, amount: BigNumber): SendParamTuple {
    const conversionRate = BigNumber.from(10).pow(12)
    const normalizedAmount = amount.div(conversionRate).mul(conversionRate)
    if (normalizedAmount.isZero()) throw new Error('Amount is below one shared-decimal unit (0.000001 EVE)')
    const options = Options.newOptions().addExecutorLzReceiveOption(PATHWAY.receiveGas, PATHWAY.receiveValue).toHex()
    return [destinationEid, asBytes32(recipient), normalizedAmount, normalizedAmount, options, '0x', '0x']
}

async function quote(
    args: Arguments
): Promise<{ chain: ChainName; address: string; amount: BigNumber; fee: BigNumber }> {
    const chain = requiredString(args, 'from') as ChainName
    if (chain !== 'base' && chain !== 'robinhood') throw new Error('--from must be base or robinhood')
    const recipient = utils.getAddress(requiredString(args, 'to'))
    const amount = utils.parseUnits(requiredString(args, 'amount'), 18)
    const predicted = plans()
    const address = predicted[chain].predictedAddress
    await assertCode(chain, address, chain === 'base' ? 'EveOFTAdapter' : 'EveOFT')
    const destination = chain === 'base' ? NETWORKS.robinhood : NETWORKS.base
    const contract = new Contract(address, OAPP_ABI, provider(chain))
    const param = sendParam(destination.eid, recipient, amount)
    const fee = await contract.quoteSend(param, false)
    process.stdout.write(
        `${JSON.stringify(
            {
                from: chain,
                contract: address,
                destinationEid: destination.eid,
                recipient,
                amountLD: param[2].toString(),
                nativeFeeWei: fee.nativeFee.toString(),
                lzTokenFee: fee.lzTokenFee.toString(),
            },
            null,
            2
        )}\n`
    )
    return { chain, address, amount: param[2], fee: fee.nativeFee }
}

async function send(args: Arguments): Promise<void> {
    if (args.broadcast !== true || args.yes !== true) {
        throw new Error(
            'Refusing to broadcast. Supply both --broadcast and --yes after reviewing the quote and recipient.'
        )
    }
    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) throw new Error('Missing PRIVATE_KEY')
    const details = await quote(args)
    const wallet = new Wallet(privateKey, provider(details.chain))
    const destination = details.chain === 'base' ? NETWORKS.robinhood : NETWORKS.base
    const recipient = utils.getAddress(requiredString(args, 'to'))
    const param = sendParam(destination.eid, recipient, details.amount)
    const oapp = new Contract(details.address, OAPP_ABI, wallet)

    if (details.chain === 'base') {
        const token = new Contract(EVE.canonicalToken, ERC20_ABI, wallet)
        const allowance: BigNumber = await token.allowance(wallet.address, details.address)
        if (allowance.lt(details.amount)) {
            const approval = await token.approve(details.address, details.amount)
            process.stdout.write(`Approval submitted: ${approval.hash}\n`)
            await approval.wait()
        }
    }

    const transaction = await oapp.send(param, [details.fee, 0], wallet.address, { value: details.fee })
    process.stdout.write(`Bridge send submitted: ${transaction.hash}\n`)
    const receipt = await transaction.wait()
    process.stdout.write(`Bridge send confirmed in block ${receipt.blockNumber}\n`)
}

async function pathwayStatus(chain: ChainName, localAddress: string, remoteAddress: string) {
    const local = NETWORKS[chain]
    const remote = chain === 'base' ? NETWORKS.robinhood : NETWORKS.base
    const chainProvider = provider(chain)
    const oapp = new Contract(localAddress, OAPP_ABI, chainProvider)
    const endpoint = new Contract(local.endpoint, ENDPOINT_ABI, chainProvider)
    const [owner, configuredEndpoint, peer, sendLibrary, receiveLibraryResult, option1, option2] = await Promise.all([
        oapp.owner(),
        oapp.endpoint(),
        oapp.peers(remote.eid),
        endpoint.getSendLibrary(localAddress, remote.eid),
        endpoint.getReceiveLibrary(localAddress, remote.eid),
        oapp.enforcedOptions(remote.eid, 1),
        oapp.enforcedOptions(remote.eid, 2),
    ])
    const receiveLibrary = receiveLibraryResult[0]
    const [executorBytes, sendUlnBytes, receiveUlnBytes] = await Promise.all([
        endpoint.getConfig(localAddress, sendLibrary, remote.eid, 1),
        endpoint.getConfig(localAddress, sendLibrary, remote.eid, 2),
        endpoint.getConfig(localAddress, receiveLibrary, remote.eid, 2),
    ])
    const executor = utils.defaultAbiCoder.decode(['uint32', 'address'], executorBytes)
    const ulnType = 'tuple(uint64,uint8,uint8,uint8,address[],address[])'
    const [sendUln] = utils.defaultAbiCoder.decode([ulnType], sendUlnBytes)
    const [receiveUln] = utils.defaultAbiCoder.decode([ulnType], receiveUlnBytes)
    const expectedDvns = [...local.requiredDvns].map((dvn) => dvn.toLowerCase()).sort()
    const dvnsMatch = (dvns: string[]) =>
        JSON.stringify(dvns.map((dvn) => dvn.toLowerCase()).sort()) === JSON.stringify(expectedDvns)
    const expectedOptions = Options.newOptions()
        .addExecutorLzReceiveOption(PATHWAY.receiveGas, PATHWAY.receiveValue)
        .toHex()

    return {
        chain,
        address: localAddress,
        owner,
        ownerMatches: owner.toLowerCase() === EVE.ownerAndDelegate.toLowerCase(),
        endpoint: configuredEndpoint,
        endpointMatches: configuredEndpoint.toLowerCase() === local.endpoint.toLowerCase(),
        peer,
        peerMatches: peer.toLowerCase() === asBytes32(remoteAddress).toLowerCase(),
        sendLibrary,
        sendLibraryMatches: sendLibrary.toLowerCase() === local.sendLibrary.toLowerCase(),
        receiveLibrary,
        receiveLibraryMatches: receiveLibrary.toLowerCase() === local.receiveLibrary.toLowerCase(),
        executor: executor[1],
        executorMatches: executor[1].toLowerCase() === local.executor.toLowerCase(),
        sendUln: {
            confirmations: sendUln[0].toString(),
            requiredDvns: sendUln[4],
            matches: sendUln[0].eq(PATHWAY.confirmations) && dvnsMatch(sendUln[4]),
        },
        receiveUln: {
            confirmations: receiveUln[0].toString(),
            requiredDvns: receiveUln[4],
            matches: receiveUln[0].eq(PATHWAY.confirmations) && dvnsMatch(receiveUln[4]),
        },
        enforcedOptions: {
            msgType1: option1,
            msgType1Matches: option1.toLowerCase() === expectedOptions.toLowerCase(),
            msgType2: option2,
            msgType2Matches: option2.toLowerCase() === expectedOptions.toLowerCase(),
        },
    }
}

async function status(): Promise<void> {
    const predicted = plans()
    const baseAddress = predicted.base.predictedAddress
    const robinhoodAddress = predicted.robinhood.predictedAddress
    await Promise.all([
        assertCode('base', baseAddress, 'EveOFTAdapter'),
        assertCode('robinhood', robinhoodAddress, 'EveOFT'),
    ])
    const result = await Promise.all([
        pathwayStatus('base', baseAddress, robinhoodAddress),
        pathwayStatus('robinhood', robinhoodAddress, baseAddress),
    ])
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

function help(): void {
    process.stdout.write(`EVE bridge operator CLI\n\n`)
    process.stdout.write(`  pnpm bridge preflight\n`)
    process.stdout.write(`  pnpm bridge predict\n`)
    process.stdout.write(`  pnpm bridge prepare [--out generated/manifest.json]\n`)
    process.stdout.write(`  pnpm bridge status\n`)
    process.stdout.write(`  pnpm bridge quote --from base|robinhood --amount 1.0 --to 0x...\n`)
    process.stdout.write(`  pnpm bridge send --from base|robinhood --amount 1.0 --to 0x... --broadcast --yes\n`)
}

async function main(): Promise<void> {
    const { command, args } = parseArguments(process.argv.slice(2))
    if (command === 'preflight') return preflight()
    if (command === 'predict') return predict()
    if (command === 'prepare') return prepare(args)
    if (command === 'status') return status()
    if (command === 'quote') {
        await quote(args)
        return
    }
    if (command === 'send') return send(args)
    help()
    if (command !== 'help') process.exitCode = 1
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Error: ${message}\n`)
    process.exitCode = 1
})
