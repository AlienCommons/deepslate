import { describe, expect, it } from 'vitest'
import { Structure } from '../../src/core/index.js'
import { NbtCompound } from '../../src/nbt/index.js'
import { EntityMeshBuilder } from '../../src/render/EntityMeshBuilder.js'
import { EntityModel } from '../../src/render/EntityModel.js'
import type { Resources } from '../../src/render/StructureRenderer.js'

const model = new EntityModel('minecraft:entity/test', {
	bones: {
		body: { cubes: [{ origin: [0, 0, 0], size: [2, 2, 2], uv: [0, 0] }] },
	},
})

function mockGl() {
	return {
		ARRAY_BUFFER: 0x8892,
		ELEMENT_ARRAY_BUFFER: 0x8893,
		DYNAMIC_DRAW: 0x88e8,
		UNSIGNED_SHORT: 0x1403,
		UNSIGNED_INT: 0x1405,
		createBuffer: () => ({}),
		deleteBuffer: () => undefined,
		bindBuffer: () => undefined,
		bufferData: () => undefined,
	} as unknown as WebGLRenderingContext
}

describe('EntityMeshBuilder', () => {
	it('applies sampled structure light to static entities', () => {
		const structure = new Structure([2, 2, 2])
			.addEntity([0.5, 0, 0.5], 'test', new NbtCompound())
		const resources = {
			getEntityModel: () => model,
			getTextureUV: () => [0, 0, 1, 1],
		} as unknown as Resources
		const builder = new EntityMeshBuilder(mockGl(), structure, resources, () => ({ sky: 6, block: 12 }))

		const lights = builder.getMeshes('cutout')[0].quads
			.flatMap(quad => quad.vertices().map(vertex => vertex.light))
		expect(lights.every(light => light?.[0] === 0.4 && light[1] === 0.8 && light[2] === 1)).toBe(true)
	})
})
