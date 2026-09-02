import { describe, expect, it } from 'vitest'
import { EntityModel } from '../../src/render/EntityModel.js'

const textureProvider = {
	getTextureUV: () => [0.25, 0.25, 0.75, 0.75] as [number, number, number, number],
	getTextureAtlas: () => new ImageData(1, 1),
}

describe('EntityModel', () => {
	it('builds a textured six-sided cube in block units', () => {
		const model = new EntityModel('minecraft:entity/test', {
			texture_size: [64, 32],
			bones: {
				body: {
					pivot: [0, 24, 0],
					cubes: [{ origin: [-8, -16, -8], size: [16, 16, 16], uv: [0, 0] }],
				},
			},
		})
		const mesh = model.getMesh(textureProvider)

		expect(mesh.quads).toHaveLength(6)
		const points = mesh.quads.flatMap(quad => quad.vertices().map(vertex => vertex.pos.components()))
		expect(Math.min(...points.map(point => point[0]))).toBeCloseTo(-0.5)
		expect(Math.max(...points.map(point => point[0]))).toBeCloseTo(0.5)
		expect(Math.min(...points.map(point => point[1]))).toBeCloseTo(0)
		expect(Math.max(...points.map(point => point[1]))).toBeCloseTo(1)
		expect(mesh.quads.every(quad => quad.vertices().every(vertex => vertex.textureLimit?.[0] === 0.25))).toBe(true)
	})

	it('applies parent bone transforms to child cubes', () => {
		const model = new EntityModel('minecraft:entity/test', {
			bones: {
				root: { pivot: [8, 0, 0] },
				child: {
					parent: 'root',
					pivot: [8, 0, 0],
					cubes: [{ origin: [0, 0, 0], size: [4, 4, 4], uv: [0, 0] }],
				},
			},
		})
		const mesh = model.getMesh(textureProvider)
		const xs = mesh.quads.flatMap(quad => quad.vertices().map(vertex => vertex.pos.x))

		expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.25)
	})

	it('rejects cyclic bone hierarchies', () => {
		const model = new EntityModel('minecraft:entity/test', {
			bones: {
				a: { parent: 'b', cubes: [{ origin: [0, 0, 0], size: [1, 1, 1], uv: [0, 0] }] },
				b: { parent: 'a' },
			},
		})

		expect(() => model.getMesh(textureProvider)).toThrow(/bone cycle/)
	})
})
