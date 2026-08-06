import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { TwoWayConfig, generateConnectionsConfig } from '@layerzerolabs/metadata-tools'
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

import { NETWORKS, PATHWAY } from './config/constants'

const baseAdapter: OmniPointHardhat = {
    eid: NETWORKS.base.eid,
    contractName: 'EveOFTAdapter',
}

const robinhoodOFT: OmniPointHardhat = {
    eid: NETWORKS.robinhood.eid,
    contractName: 'EveOFT',
}

const enforcedOptions: OAppEnforcedOption[] = [1, 2].map((msgType) => ({
    msgType,
    optionType: ExecutorOptionType.LZ_RECEIVE,
    gas: PATHWAY.receiveGas,
    value: PATHWAY.receiveValue,
}))

const pathways: TwoWayConfig[] = [
    [
        baseAdapter,
        robinhoodOFT,
        [[...PATHWAY.requiredDvnNames], []],
        [PATHWAY.confirmations, PATHWAY.confirmations],
        [enforcedOptions, enforcedOptions],
    ],
]

export default async function () {
    const connections = await generateConnectionsConfig(pathways)
    return {
        contracts: [{ contract: baseAdapter }, { contract: robinhoodOFT }],
        connections,
    }
}
