import * as b from 'benny'
import type { BlockState } from '../../src/core/index.js'
import { Structure } from '../../src/core/index.js'
import { LightEngine } from '../../src/render/LightEngine.js'
import type { LightProperties } from '../../src/render/LightEngine.js'

const size = 32
const structure = new Structure([size, size, size])
for (let x = 0; x < size; x += 1) {
	for (let z = 0; z < size; z += 1) {
		structure.addBlock([x, 0, z], 'minecraft:stone')
		structure.addBlock([x, size - 1, z], 'minecraft:stone')
	}
}
for (let x = 4; x < size; x += 8) {
	for (let z = 4; z < size; z += 8) structure.addBlock([x, 8, z], 'minecraft:glowstone')
}

const getProperties = (state: BlockState): LightProperties => {
	if (state.is('stone')) return { opaque: true }
	if (state.is('glowstone')) return { opaque: true, light_emission: 15 }
	return {}
}
const light = new LightEngine(structure, getProperties)

b.suite('LightPropagation',
	b.add('rebuild sky and block light for a 32³ structure', () => light.rebuild()),
	b.cycle(),
	b.complete(),
)
