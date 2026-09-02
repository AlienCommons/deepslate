import { describe, expect, it } from 'vitest'
import type { BlockState } from '../../src/core/index.js'
import { Structure } from '../../src/core/index.js'
import { LightEngine } from '../../src/render/LightEngine.js'
import type { LightProperties } from '../../src/render/LightEngine.js'

const getProperties = (state: BlockState): LightProperties => {
	if (state.is('stone')) return { opaque: true }
	if (state.is('water')) return { light_opacity: 1 }
	if (state.is('glowstone')) return { opaque: true }
	return {}
}

describe('baked light propagation', () => {
	it('keeps open columns at full sky light and attenuates water', () => {
		const structure = new Structure([2, 4, 1])
		structure.addBlock([1, 2, 0], 'minecraft:water')
		const light = new LightEngine(structure, getProperties)

		expect(light.getSkyLight([0, 0, 0])).toBe(15)
		expect(light.getSkyLight([1, 2, 0])).toBe(14)
		expect(light.getSkyLight([1, 1, 0])).toBe(14)
	})

	it('propagates sky light sideways below an opaque roof', () => {
		const structure = new Structure([3, 3, 3])
		structure.addBlock([1, 2, 1], 'minecraft:stone')
		const light = new LightEngine(structure, getProperties)

		expect(light.getSkyLight([1, 2, 1])).toBe(0)
		expect(light.getSkyLight([1, 1, 1])).toBe(14)
	})

	it('propagates block light with one level of falloff per cell', () => {
		const structure = new Structure([5, 3, 3])
		structure.addBlock([1, 1, 1], 'minecraft:glowstone')
		const light = new LightEngine(structure, getProperties)

		expect(light.getBlockLight([1, 1, 1])).toBe(15)
		expect(light.getEmission([1, 1, 1])).toBe(15)
		expect(light.getBlockLight([2, 1, 1])).toBe(14)
		expect(light.getBlockLight([3, 1, 1])).toBe(13)
	})

	it('lets resource flags override vanilla state emission', () => {
		const structure = new Structure([3, 1, 1])
		structure.addBlock([0, 0, 0], 'minecraft:glowstone')
		const light = new LightEngine(structure, () => ({ light_emission: 4 }))

		expect(light.getEmission([0, 0, 0])).toBe(4)
		expect(light.getBlockLight([1, 0, 0])).toBe(3)
	})

	it('uses a sparse fallback for oversized structure bounds', () => {
		const structure = new Structure([5, 3, 3])
		structure.addBlock([1, 1, 1], 'minecraft:glowstone')
		structure.addBlock([4, 2, 2], 'minecraft:stone')
		const light = new LightEngine(structure, getProperties, { maxDenseCells: 0 })

		expect(light.getBlockLight([2, 1, 1])).toBe(14)
		expect(light.getSkyLight([4, 1, 2])).toBe(0)
		expect(light.getSkyLight([0, 1, 0])).toBe(15)
	})
})
