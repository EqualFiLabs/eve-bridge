import { execFileSync, spawnSync } from 'child_process'
import path from 'path'

import { expect } from 'chai'
import { utils } from 'ethers'

type ManifestTransaction = { order: number; description: string; data: string }
type Manifest = { pathwayTransactions: { base: ManifestTransaction[]; robinhood: ManifestTransaction[] } }

describe('operator manifest', function () {
    it('encodes explicit no-optional-DVN security before peers', function () {
        const script = path.resolve(__dirname, '..', '..', 'scripts', 'bridge.ts')
        const output = execFileSync(process.execPath, ['-r', 'ts-node/register', script, 'prepare'], {
            encoding: 'utf8',
        })
        const manifest = JSON.parse(output) as Manifest
        const endpoint = new utils.Interface([
            'function setConfig(address,address,(uint32 eid,uint32 configType,bytes config)[])',
        ])
        const ulnType =
            'tuple(uint64 confirmations,uint8 requiredDVNCount,uint8 optionalDVNCount,uint8 optionalDVNThreshold,address[] requiredDVNs,address[] optionalDVNs)'

        for (const transactions of [manifest.pathwayTransactions.base, manifest.pathwayTransactions.robinhood]) {
            expect(transactions.map(({ order }) => order)).to.deep.equal([1, 2, 3, 4, 5, 6])
            const setConfig = endpoint.decodeFunctionData('setConfig', transactions[2].data)
            const [uln] = utils.defaultAbiCoder.decode([ulnType], setConfig[2][1].config)

            expect(uln.confirmations.toNumber()).to.equal(20)
            expect(uln.requiredDVNCount).to.equal(2)
            expect(uln.optionalDVNCount).to.equal(255)
            expect(uln.optionalDVNThreshold).to.equal(0)
            expect(uln.requiredDVNs).to.have.length(2)
            expect(uln.optionalDVNs).to.have.length(0)
            expect(transactions[5].description).to.contain('peer last')
            expect(transactions[5].data.slice(0, 10)).to.equal(utils.id('setPeer(uint32,bytes32)').slice(0, 10))
        }
    })

    it('rejects a zero-address bridge recipient before RPC access', function () {
        const script = path.resolve(__dirname, '..', '..', 'scripts', 'bridge.ts')
        const result = spawnSync(
            process.execPath,
            [
                '-r',
                'ts-node/register',
                script,
                'quote',
                '--from',
                'base',
                '--amount',
                '1',
                '--to',
                '0x0000000000000000000000000000000000000000',
            ],
            { encoding: 'utf8' }
        )

        expect(result.status).to.equal(1)
        expect(result.stderr).to.contain('Recipient must not be the zero address')
    })
})
