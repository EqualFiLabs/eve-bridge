import { utils } from 'ethers'

import { EndpointId } from '@layerzerolabs/lz-definitions'

export const EVE = {
    name: '0xAgentEVE',
    symbol: 'EVE',
    canonicalToken: '0xe7d192e52fa418236d6eecf7d5eb38da9dd11ba3',
    ownerAndDelegate: '0x603A8A2f22ac1d61E9c932A4F6Fa23170CEcb9Ff',
    safeSingleton: '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762',
    safeThreshold: 2,
    safeOwners: ['0x4CF8e4D37F561815F208565a5b6Ca8a85b143205', '0x81709E16Bf99936891Cc720689f269103fabeD91'],
    sharedDecimals: 6,
} as const

export const CREATE2_FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C'
export const CREATE2_FACTORY_RUNTIME_HASH = '0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989'

export const BASE_ADAPTER_SALT_LABEL = 'EVE_BRIDGE_BASE_ADAPTER_V1'
export const ROBINHOOD_OFT_SALT_LABEL = 'EVE_BRIDGE_ROBINHOOD_OFT_V1'

export const BASE_ADAPTER_SALT = utils.id(BASE_ADAPTER_SALT_LABEL)
export const ROBINHOOD_OFT_SALT = utils.id(ROBINHOOD_OFT_SALT_LABEL)

export const oftSaltLabelForEid = (eid: number): string =>
    eid === EndpointId.ROBINHOOD_V2_MAINNET ? ROBINHOOD_OFT_SALT_LABEL : `EVE_BRIDGE_${eid}_OFT_V1`

export const oftSaltForEid = (eid: number): string => utils.id(oftSaltLabelForEid(eid))

export const NETWORKS = {
    base: {
        chainId: 8453,
        eid: EndpointId.BASE_V2_MAINNET,
        endpoint: '0x1a44076050125825900e736c501f859c50fE728c',
        sendLibrary: '0xb5320b0b3a13cc860893e2bd79fcd7e13484dda2',
        receiveLibrary: '0xc70ab6f32772f59fbfc23889caf4ba3376c84baf',
        executor: '0x2cca08ae69e0c44b18a57ab2a87644234daebae4',
        requiredDvns: ['0x9e059a54699a285714207b43B055483E78FAac25', '0xcd37CA043f8479064e10635020c65FfC005d36f6'],
    },
    robinhood: {
        chainId: 4663,
        eid: EndpointId.ROBINHOOD_V2_MAINNET,
        endpoint: '0x6f475642a6e85809b1c36fa62763669b1b48dd5b',
        sendLibrary: '0xc39161c743d0307eb9bcc9fef03eeb9dc4802de7',
        receiveLibrary: '0xe1844c5d63a9543023008d332bd3d2e6f1fe1043',
        executor: '0x4208d6e27538189bb48e603d6123a94b8abe0a0b',
        requiredDvns: ['0x0ffe02df012299a370d5dd69298a5826eacafdf8', '0xd01ae6905d48315f7be10c7330aecf8360ef5b12'],
    },
} as const

export const PATHWAY = {
    confirmations: 20,
    receiveGas: 200_000,
    receiveValue: 0,
    requiredDvnNames: ['LayerZero Labs', 'Nethermind'],
} as const
