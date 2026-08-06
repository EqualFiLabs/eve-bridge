import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

import { EVE, NETWORKS, oftSaltForEid } from '../config/constants'

const deployOFT: DeployFunction = async (hre) => {
    const eid = hre.network.config.eid
    assert(eid != null, 'The network must define a LayerZero endpoint ID')
    assert(eid !== NETWORKS.base.eid, 'Base uses EveOFTAdapter, not EveOFT')

    const { deployer } = await hre.getNamedAccounts()
    assert(deployer, 'Missing named deployer account')

    const endpoint = await hre.deployments.get('EndpointV2')
    if (eid === NETWORKS.robinhood.eid) {
        assert(
            endpoint.address.toLowerCase() === NETWORKS.robinhood.endpoint.toLowerCase(),
            'Unexpected Robinhood EndpointV2'
        )
    }

    const deployment = await hre.deployments.deploy('EveOFT', {
        from: deployer,
        args: [endpoint.address, EVE.ownerAndDelegate],
        deterministicDeployment: oftSaltForEid(eid),
        log: true,
        skipIfAlreadyDeployed: false,
    })

    console.log(`EveOFT deterministic address for EID ${eid}: ${deployment.address}`)
}

deployOFT.tags = ['EveOFT']

export default deployOFT
