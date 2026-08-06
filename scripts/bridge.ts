import 'dotenv/config'

import fs from 'fs'
import path from 'path'

import { BigNumber, Contract, Wallet, constants, providers, utils } from 'ethers'

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
type UnsignedTransaction = {
    order: number
    description: string
    chainId: number
    to: string
    data: string
    value: string
}

const ERC20_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function pool() view returns (address)',
    'function isPoolUnlocked() view returns (bool)',
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
]
const SAFE_ABI = [
    'function masterCopy() view returns (address)',
    'function getOwners() view returns (address[])',
    'function getThreshold() view returns (uint256)',
    'function getModulesPaginated(address,uint256) view returns (address[],address)',
]
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
    'function isDefaultSendLibrary(address,uint32) view returns (bool)',
    'function getReceiveLibrary(address,uint32) view returns (address,bool)',
    'function receiveLibraryTimeout(address,uint32) view returns (address,uint256)',
    'function getConfig(address,address,uint32,uint32) view returns (bytes)',
    'function delegates(address) view returns (address)',
]
const ENDPOINT_CONFIGURATION_INTERFACE = new utils.Interface([
    'function setSendLibrary(address,uint32,address)',
    'function setReceiveLibrary(address,uint32,address,uint256)',
    'function setConfig(address,address,(uint32 eid,uint32 configType,bytes config)[])',
])
const OAPP_CONFIGURATION_INTERFACE = new utils.Interface([
    'function setEnforcedOptions((uint32 eid,uint16 msgType,bytes options)[])',
    'function setPeer(uint32,bytes32)',
])
const MESSAGE_LIBRARY_ABI = [
    'function getAppUlnConfig(address,uint32) view returns (tuple(uint64 confirmations,uint8 requiredDVNCount,uint8 optionalDVNCount,uint8 optionalDVNThreshold,address[] requiredDVNs,address[] optionalDVNs))',
    'function executorConfigs(address,uint32) view returns (uint32 maxMessageSize,address executor)',
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
        const componentHashes: Record<string, string> = {}
        for (const [label, address] of Object.entries({
            sendLibrary: NETWORKS[chain].sendLibrary,
            receiveLibrary: NETWORKS[chain].receiveLibrary,
            executor: NETWORKS[chain].executor,
            requiredDvn0: NETWORKS[chain].requiredDvns[0],
            requiredDvn1: NETWORKS[chain].requiredDvns[1],
        })) {
            componentHashes[label] = utils.keccak256(await assertCode(chain, address, label))
        }
        const factoryCode = await assertCode(chain, CREATE2_FACTORY, 'CREATE2 factory')
        const factoryHash = utils.keccak256(factoryCode)
        if (factoryHash !== CREATE2_FACTORY_RUNTIME_HASH) {
            throw new Error(`${chain} CREATE2 factory runtime hash mismatch: ${factoryHash}`)
        }

        const safeCode = await assertCode(chain, EVE.ownerAndDelegate, 'owner/delegate Safe')
        const safe = new Contract(EVE.ownerAndDelegate, SAFE_ABI, chainProvider)
        const [singleton, owners, threshold, modulesResult] = await Promise.all([
            safe.masterCopy(),
            safe.getOwners(),
            safe.getThreshold(),
            safe.getModulesPaginated('0x0000000000000000000000000000000000000001', 50),
        ])
        const normalizedOwners = (owners as string[]).map((owner) => owner.toLowerCase()).sort()
        const expectedOwners = [...EVE.safeOwners].map((owner) => owner.toLowerCase()).sort()
        if (JSON.stringify(normalizedOwners) !== JSON.stringify(expectedOwners) || !threshold.eq(EVE.safeThreshold)) {
            throw new Error(`${chain} Safe ownership or threshold differs from the approved 2-of-2`)
        }
        if (singleton.toLowerCase() !== EVE.safeSingleton.toLowerCase()) {
            throw new Error(`${chain} Safe singleton differs from the approved implementation`)
        }
        if (modulesResult[0].length !== 0) throw new Error(`${chain} Safe has enabled modules`)
        const singletonCode = await assertCode(chain, singleton, 'Safe singleton')

        const predictedCode = await chainProvider.getCode(predicted[chain].predictedAddress)
        if (predictedCode !== '0x') {
            throw new Error(`${chain} predicted address is already occupied: ${predicted[chain].predictedAddress}`)
        }
        results[chain] = {
            chainId: network.chainId,
            endpoint: NETWORKS[chain].endpoint,
            componentRuntimeHashes: componentHashes,
            factoryRuntimeHash: factoryHash,
            safeRuntimeHash: utils.keccak256(safeCode),
            safeSingleton: singleton,
            safeSingletonRuntimeHash: utils.keccak256(singletonCode),
            safeModules: modulesResult[0],
            predictedAddress: predicted[chain].predictedAddress,
            predictedAddressHasCode: false,
        }
    }

    const tokenCode = await assertCode('base', EVE.canonicalToken, 'canonical EVE')
    const token = new Contract(EVE.canonicalToken, ERC20_ABI, provider('base'))
    const [name, symbol, decimals, pool, isPoolUnlocked] = await Promise.all([
        token.name(),
        token.symbol(),
        token.decimals(),
        token.pool(),
        token.isPoolUnlocked(),
    ])
    if (name !== EVE.name || symbol !== EVE.symbol || decimals !== 18) {
        throw new Error(`Canonical token metadata mismatch: ${name}/${symbol}/${decimals}`)
    }
    results.canonicalToken = {
        address: EVE.canonicalToken,
        name,
        symbol,
        decimals,
        runtimeHash: utils.keccak256(tokenCode),
        pool,
        isPoolUnlocked,
        adapterCanReceive: pool.toLowerCase() !== predicted.base.predictedAddress.toLowerCase() || isPoolUnlocked,
    }
    if (pool.toLowerCase() === predicted.base.predictedAddress.toLowerCase() && !isPoolUnlocked) {
        throw new Error('Canonical token pool lock would prevent transfers into the predicted adapter')
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

function configurationTransactions(
    chain: ChainName,
    localAddress: string,
    remoteAddress: string
): UnsignedTransaction[] {
    const local = NETWORKS[chain]
    const remote = chain === 'base' ? NETWORKS.robinhood : NETWORKS.base
    const executorConfig = utils.defaultAbiCoder.encode(
        ['tuple(uint32 maxMessageSize,address executor)'],
        [[10_000, local.executor]]
    )
    const ulnConfig = utils.defaultAbiCoder.encode(
        [
            'tuple(uint64 confirmations,uint8 requiredDVNCount,uint8 optionalDVNCount,uint8 optionalDVNThreshold,address[] requiredDVNs,address[] optionalDVNs)',
        ],
        [[PATHWAY.confirmations, local.requiredDvns.length, 255, 0, [...local.requiredDvns], []]]
    )
    const enforcedOptions = Options.newOptions()
        .addExecutorLzReceiveOption(PATHWAY.receiveGas, PATHWAY.receiveValue)
        .toHex()
    const transaction = (order: number, description: string, to: string, data: string): UnsignedTransaction => ({
        order,
        description,
        chainId: local.chainId,
        to,
        data,
        value: '0',
    })

    return [
        transaction(
            1,
            `Set ${chain} send library`,
            local.endpoint,
            ENDPOINT_CONFIGURATION_INTERFACE.encodeFunctionData('setSendLibrary', [
                localAddress,
                remote.eid,
                local.sendLibrary,
            ])
        ),
        transaction(
            2,
            `Set ${chain} receive library`,
            local.endpoint,
            ENDPOINT_CONFIGURATION_INTERFACE.encodeFunctionData('setReceiveLibrary', [
                localAddress,
                remote.eid,
                local.receiveLibrary,
                0,
            ])
        ),
        transaction(
            3,
            `Set ${chain} send executor and ULN`,
            local.endpoint,
            ENDPOINT_CONFIGURATION_INTERFACE.encodeFunctionData('setConfig', [
                localAddress,
                local.sendLibrary,
                [
                    [remote.eid, 1, executorConfig],
                    [remote.eid, 2, ulnConfig],
                ],
            ])
        ),
        transaction(
            4,
            `Set ${chain} receive ULN`,
            local.endpoint,
            ENDPOINT_CONFIGURATION_INTERFACE.encodeFunctionData('setConfig', [
                localAddress,
                local.receiveLibrary,
                [[remote.eid, 2, ulnConfig]],
            ])
        ),
        transaction(
            5,
            `Set ${chain} enforced receive options`,
            localAddress,
            OAPP_CONFIGURATION_INTERFACE.encodeFunctionData('setEnforcedOptions', [
                [
                    [remote.eid, 1, enforcedOptions],
                    [remote.eid, 2, enforcedOptions],
                ],
            ])
        ),
        transaction(
            6,
            `Set ${chain} peer last`,
            localAddress,
            OAPP_CONFIGURATION_INTERFACE.encodeFunctionData('setPeer', [remote.eid, asBytes32(remoteAddress)])
        ),
    ]
}

async function prepare(args: Arguments): Promise<void> {
    const predicted = plans()
    const manifest = {
        generatedAt: new Date().toISOString(),
        create2Factory: CREATE2_FACTORY,
        deployments: Object.values(predicted),
        pathwayTransactions: {
            base: configurationTransactions(
                'base',
                predicted.base.predictedAddress,
                predicted.robinhood.predictedAddress
            ),
            robinhood: configurationTransactions(
                'robinhood',
                predicted.robinhood.predictedAddress,
                predicted.base.predictedAddress
            ),
        },
        executionRule: 'Execute and verify steps 1-5 on both chains before either step 6 peer transaction.',
        warning:
            'Unsigned transactions. Verify hashes, chain IDs, target emptiness, and Safe simulation before execution.',
    }
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`
    const output = args.out
    if (typeof output === 'string') {
        const resolvedOutput = path.resolve(output)
        fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true })
        fs.writeFileSync(resolvedOutput, serialized, { flag: 'wx' })
        process.stdout.write(`Wrote unsigned manifest to ${resolvedOutput}\n`)
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
    if (recipient === constants.AddressZero) throw new Error('Recipient must not be the zero address')
    const amount = utils.parseUnits(requiredString(args, 'amount'), 18)
    const predicted = plans()
    const address = predicted[chain].predictedAddress
    await assertCode(chain, address, chain === 'base' ? 'EveOFTAdapter' : 'EveOFT')
    if (chain === 'robinhood') {
        const baseToken = new Contract(EVE.canonicalToken, ERC20_ABI, provider('base'))
        const [pool, isPoolUnlocked] = await Promise.all([baseToken.pool(), baseToken.isPoolUnlocked()])
        if (recipient.toLowerCase() === pool.toLowerCase() && !isPoolUnlocked) {
            throw new Error('Recipient is the canonical token locked pool and cannot receive returned EVE')
        }
    }
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
    const [
        owner,
        configuredEndpoint,
        configuredDelegate,
        peer,
        sendLibrary,
        isDefaultSendLibrary,
        receiveLibraryResult,
        receiveLibraryTimeoutResult,
        latestBlock,
        option1,
        option2,
    ] = await Promise.all([
        oapp.owner(),
        oapp.endpoint(),
        endpoint.delegates(localAddress),
        oapp.peers(remote.eid),
        endpoint.getSendLibrary(localAddress, remote.eid),
        endpoint.isDefaultSendLibrary(localAddress, remote.eid),
        endpoint.getReceiveLibrary(localAddress, remote.eid),
        endpoint.receiveLibraryTimeout(localAddress, remote.eid),
        chainProvider.getBlock('latest'),
        oapp.enforcedOptions(remote.eid, 1),
        oapp.enforcedOptions(remote.eid, 2),
    ])
    const receiveLibrary = receiveLibraryResult[0]
    const sendMessageLibrary = new Contract(sendLibrary, MESSAGE_LIBRARY_ABI, chainProvider)
    const receiveMessageLibrary = new Contract(receiveLibrary, MESSAGE_LIBRARY_ABI, chainProvider)
    const [executorBytes, sendUlnBytes, receiveUlnBytes, appExecutor, sendAppUln, receiveAppUln] = await Promise.all([
        endpoint.getConfig(localAddress, sendLibrary, remote.eid, 1),
        endpoint.getConfig(localAddress, sendLibrary, remote.eid, 2),
        endpoint.getConfig(localAddress, receiveLibrary, remote.eid, 2),
        sendMessageLibrary.executorConfigs(localAddress, remote.eid),
        sendMessageLibrary.getAppUlnConfig(localAddress, remote.eid),
        receiveMessageLibrary.getAppUlnConfig(localAddress, remote.eid),
    ])
    const executor = utils.defaultAbiCoder.decode(['uint32', 'address'], executorBytes)
    const ulnType = 'tuple(uint64,uint8,uint8,uint8,address[],address[])'
    const [sendUln] = utils.defaultAbiCoder.decode([ulnType], sendUlnBytes)
    const [receiveUln] = utils.defaultAbiCoder.decode([ulnType], receiveUlnBytes)
    const expectedDvns = [...local.requiredDvns].map((dvn) => dvn.toLowerCase()).sort()
    const dvnsMatch = (dvns: string[]) =>
        JSON.stringify(dvns.map((dvn) => dvn.toLowerCase()).sort()) === JSON.stringify(expectedDvns)
    const appUlnMatches = (appUln: {
        confirmations: BigNumber
        requiredDVNCount: number
        optionalDVNCount: number
        optionalDVNThreshold: number
        requiredDVNs: string[]
        optionalDVNs: string[]
    }) =>
        appUln.confirmations.eq(PATHWAY.confirmations) &&
        appUln.requiredDVNCount === local.requiredDvns.length &&
        appUln.optionalDVNCount === 255 &&
        appUln.optionalDVNThreshold === 0 &&
        dvnsMatch(appUln.requiredDVNs) &&
        appUln.optionalDVNs.length === 0
    const expectedOptions = Options.newOptions()
        .addExecutorLzReceiveOption(PATHWAY.receiveGas, PATHWAY.receiveValue)
        .toHex()
    const ownerMatches = owner.toLowerCase() === EVE.ownerAndDelegate.toLowerCase()
    const endpointMatches = configuredEndpoint.toLowerCase() === local.endpoint.toLowerCase()
    const delegateMatches = configuredDelegate.toLowerCase() === EVE.ownerAndDelegate.toLowerCase()
    const peerMatches = peer.toLowerCase() === asBytes32(remoteAddress).toLowerCase()
    const sendLibraryMatches = sendLibrary.toLowerCase() === local.sendLibrary.toLowerCase()
    const sendLibraryIsExplicit = !isDefaultSendLibrary
    const receiveLibraryMatches =
        receiveLibrary.toLowerCase() === local.receiveLibrary.toLowerCase() && !receiveLibraryResult[1]
    const receiveLibraryTimeoutInactive = !receiveLibraryTimeoutResult[1].gt(latestBlock.number)
    const executorMatches =
        executor[0] === 10_000 &&
        executor[1].toLowerCase() === local.executor.toLowerCase() &&
        appExecutor.maxMessageSize === 10_000 &&
        appExecutor.executor.toLowerCase() === local.executor.toLowerCase()
    const sendUlnMatches =
        sendUln[0].eq(PATHWAY.confirmations) &&
        sendUln[1] === local.requiredDvns.length &&
        sendUln[2] === 0 &&
        sendUln[3] === 0 &&
        dvnsMatch(sendUln[4]) &&
        sendUln[5].length === 0 &&
        appUlnMatches(sendAppUln)
    const receiveUlnMatches =
        receiveUln[0].eq(PATHWAY.confirmations) &&
        receiveUln[1] === local.requiredDvns.length &&
        receiveUln[2] === 0 &&
        receiveUln[3] === 0 &&
        dvnsMatch(receiveUln[4]) &&
        receiveUln[5].length === 0 &&
        appUlnMatches(receiveAppUln)
    const msgType1Matches = option1.toLowerCase() === expectedOptions.toLowerCase()
    const msgType2Matches = option2.toLowerCase() === expectedOptions.toLowerCase()
    const allChecksPass = [
        ownerMatches,
        endpointMatches,
        delegateMatches,
        peerMatches,
        sendLibraryMatches,
        sendLibraryIsExplicit,
        receiveLibraryMatches,
        receiveLibraryTimeoutInactive,
        executorMatches,
        sendUlnMatches,
        receiveUlnMatches,
        msgType1Matches,
        msgType2Matches,
    ].every(Boolean)

    return {
        chain,
        address: localAddress,
        owner,
        ownerMatches,
        endpoint: configuredEndpoint,
        endpointMatches,
        delegate: configuredDelegate,
        delegateMatches,
        peer,
        peerMatches,
        sendLibrary,
        sendLibraryMatches,
        sendLibraryIsExplicit,
        receiveLibrary,
        receiveLibraryMatches,
        receiveLibraryTimeout: {
            library: receiveLibraryTimeoutResult[0],
            expiry: receiveLibraryTimeoutResult[1].toString(),
            inactive: receiveLibraryTimeoutInactive,
        },
        executor: executor[1],
        appExecutor: appExecutor.executor,
        executorMatches,
        sendUln: {
            confirmations: sendUln[0].toString(),
            requiredDvns: sendUln[4],
            matches: sendUlnMatches,
            appOptionalDvnCount: sendAppUln.optionalDVNCount,
        },
        receiveUln: {
            confirmations: receiveUln[0].toString(),
            requiredDvns: receiveUln[4],
            matches: receiveUlnMatches,
            appOptionalDvnCount: receiveAppUln.optionalDVNCount,
        },
        enforcedOptions: {
            msgType1: option1,
            msgType1Matches,
            msgType2: option2,
            msgType2Matches,
        },
        allChecksPass,
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
    if (!result.every(({ allChecksPass }) => allChecksPass)) throw new Error('One or more pathway status checks failed')
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
