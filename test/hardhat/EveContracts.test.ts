import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, ContractFactory } from 'ethers'
import { deployments, ethers } from 'hardhat'

describe('EVE bridge contracts', function () {
    let endpointFactory: ContractFactory
    let endpointOwner: SignerWithAddress
    let delegate: SignerWithAddress
    let outsider: SignerWithAddress
    let endpoint: Contract

    before(async function () {
        ;[endpointOwner, delegate, outsider] = await ethers.getSigners()
        const artifact = await deployments.getArtifact('EndpointV2Mock')
        endpointFactory = new ContractFactory(artifact.abi, artifact.bytecode, endpointOwner)
    })

    beforeEach(async function () {
        endpoint = await endpointFactory.deploy(1)
    })

    it('deploys the immutable Base adapter with the configured token and delegate', async function () {
        const token = await (await ethers.getContractFactory('EveERC20Mock')).deploy()
        const adapter = await (
            await ethers.getContractFactory('EveOFTAdapter')
        ).deploy(token.address, endpoint.address, delegate.address)

        expect(await adapter.token()).to.equal(token.address)
        expect(await adapter.owner()).to.equal(delegate.address)
        expect(await adapter.sharedDecimals()).to.equal(6)
        let reverted = false
        try {
            await adapter.connect(outsider).setPeer(2, ethers.constants.HashZero)
        } catch {
            reverted = true
        }
        expect(reverted).to.equal(true)
    })

    it('deploys a zero-supply permit-enabled destination OFT', async function () {
        const oft = await (await ethers.getContractFactory('EveOFT')).deploy(endpoint.address, delegate.address)

        expect(await oft.name()).to.equal('0xAgentEVE')
        expect(await oft.symbol()).to.equal('EVE')
        expect(await oft.owner()).to.equal(delegate.address)
        expect((await oft.totalSupply()).isZero()).to.equal(true)
        expect(await oft.DOMAIN_SEPARATOR()).to.not.equal(ethers.constants.HashZero)
    })
})
