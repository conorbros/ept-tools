import path from 'path'

import * as Bounds from './bounds'
import * as Key from './key'
import * as Laszip from './laszip'
import * as Pnts from './pnts'
import * as Schema from './schema'
import * as Srs from './srs'
import * as Tile from './tile'
import * as Util from './util'
import * as Zstandard from './zstandard'
import { scanColorOptionsResults } from './scanColorOptions'

export const dataExtensions = { binary: 'bin', laszip: 'laz', zstandard: 'zst' }

export async function translate(filename) {
    const dirname = Util.dirname(filename)
    if (!dirname.endsWith('ept-tileset')) {
        throw new Error('Invalid virtual tileset path:' + filename)
    }

    // Now strip off the virtual subpath `ept-tileset` to get the EPT root.
    const eptRoot = Util.protojoin(Util.dirname(filename), '..')
    const tilename = Util.basename(filename)
    const [root, extension] = tilename.split('.')

    const ept = await Util.getJson(Util.protojoin(eptRoot, 'ept.json'))
    const { bounds: eptBounds, schema, dataType, srs } = ept

    if (!Srs.codeString(srs)) {
        throw new Error('EPT SRS code is required for conversion')
    }

    const dataExtension = dataExtensions[dataType]

    if (!dataExtension) {
        throw new Error(`EPT data type ${dataType} is not supported`)
    }

    if (root === 'tileset') {
        if (extension !== 'json') {
            throw new Error('Invalid filename: ' + filename)
        }

        const key = Key.create()
        const hierarchy = await Util.getJson(
            Util.protojoin(
                eptRoot,
                'ept-hierarchy',
                Key.stringify(key) + '.json'
            )
        )
        return await Tile.translate({ key, ept, hierarchy })
    }

    const key = Key.create(...root.split('-').map(v => parseInt(v, 10)))

    if (extension === 'json') {
        const hierarchy = await Util.getJson(
            Util.protojoin(
                eptRoot,
                'ept-hierarchy',
                Key.stringify(key) + '.json'
            )
        )
        return await Tile.translate({ key, ept, hierarchy })
    }
    else if (extension === 'pnts') {
        let buffer = await Util.getBuffer(
            Util.protojoin(
                eptRoot,
                'ept-data',
                Key.stringify(key) + `.${dataExtension}`
            )
        )

        if (dataType === 'zstandard') {
            buffer = await Zstandard.decompress(buffer)
        }
        else if (dataType === 'laszip') {
            buffer = await Laszip.decompress(buffer, ept)
        }

        let color = Schema.has(schema, 'Red') ? 'color' : Schema.has(schema, 'Intensity') ? 'intensity' : null

        if(scanColorOptionsResults.scanned){
            if(scanColorOptionsResults.useRgb){
                color = 'color';
            }else if(scanColorOptionsResults.useIntensity){
                color = 'intensity';
            }
        }
        console.log(color);
        const options = { color }
        const points = buffer.length / Schema.pointSize(schema)
        const bounds = Bounds.stepTo(eptBounds, key)
        return Pnts.translate({ ept, options, bounds, points, buffer })
    }
}
