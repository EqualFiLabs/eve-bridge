import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

import { BASE_ADAPTER_SALT, EVE, NETWORKS } from '../config/constants'

const deployAdapter: DeployFunction = async (hre) => {
    assert(hre.network.config.eid === NETWORKS.base.eid, 'EveOFTAdapter may only be deployed on Base')

    const { deployer } = await hre.getNamedAccounts()
    assert(deployer, 'Missing named deployer account')

    const endpoint = await hre.deployments.get('EndpointV2')
    assert(endpoint.address.toLowerCase() === NETWORKS.base.endpoint.toLowerCase(), 'Unexpected Base EndpointV2')

    const deployment = await hre.deployments.deploy('EveOFTAdapter', {
        from: deployer,
        args: [EVE.canonicalToken, endpoint.address, EVE.ownerAndDelegate],
        deterministicDeployment: BASE_ADAPTER_SALT,
        log: true,
        skipIfAlreadyDeployed: false,
    })

    console.log(`EveOFTAdapter deterministic address: ${deployment.address}`)
}

deployAdapter.tags = ['EveOFTAdapter']

export default deployAdapter
