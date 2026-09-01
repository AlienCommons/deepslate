import { describe, expect, it } from 'vitest'
import { Cull } from '../../src/render/Cull.js'
import { getLegacyFluidMesh } from '../../src/render/FluidRenderer.js'
import type { TextureAtlasProvider } from '../../src/render/TextureAtlas.js'

const atlas: TextureAtlasProvider = {
	getTextureAtlas: () => { throw new Error('Texture data is not required for mesh generation') },
	getTextureUV: () => [0, 0, 1, 1],
}

const horizontalHeights = (level: number) => getLegacyFluidMesh('water', level, atlas, Cull.none())
	.quads
	.filter(quad => {
		const heights = quad.vertices().map(vertex => vertex.pos.y)
		return heights.every(height => height === heights[0])
	})
	.map(quad => quad.v1.pos.y)
	.sort((a, b) => a - b)

describe('fluid rendering baseline', () => {
	it('uses one flat height for every liquid surface', () => {
		expect(horizontalHeights(0)[1]).toBeCloseTo(14.2)
		expect(horizontalHeights(7)[1]).toBeCloseTo(1.9)
		expect(horizontalHeights(8)[1]).toBeCloseTo(16)
	})

	it('honors whole-face culling flags', () => {
		const mesh = getLegacyFluidMesh(
			'water',
			0,
			atlas,
			{ up: true, north: true },
		)

		expect(mesh.quads).toHaveLength(4)
	})
})
