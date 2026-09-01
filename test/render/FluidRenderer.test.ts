import { describe, expect, it } from 'vitest'
import { getFluidCornerHeights, getFluidFlow, getFluidMesh, getFluidOwnHeight } from '../../src/render/FluidRenderer.js'
import type { FluidCell, FluidRenderContext, FluidState } from '../../src/render/FluidRenderer.js'
import type { TextureAtlasProvider } from '../../src/render/TextureAtlas.js'

const atlas: TextureAtlasProvider = {
	getTextureAtlas: () => { throw new Error('Texture data is not required for mesh generation') },
	getTextureUV: id => id.path.endsWith('_still') ? [0, 0, 0.5, 0.5] : [0.5, 0.5, 1, 1],
}

function context(fluid: FluidState, cells: Record<string, FluidCell> = {}): FluidRenderContext {
	return {
		fluid,
		sample: (dx, dy, dz) => cells[`${dx},${dy},${dz}`] ?? (dx === 0 && dy === 0 && dz === 0 ? { fluid } : {}),
	}
}

describe('fluid surface geometry', () => {
	it('maps source, flowing, and falling levels to Minecraft fluid heights', () => {
		expect(getFluidOwnHeight(0)).toBeCloseTo(8 / 9)
		expect(getFluidOwnHeight(1)).toBeCloseTo(7 / 9)
		expect(getFluidOwnHeight(7)).toBeCloseTo(1 / 9)
		expect(getFluidOwnHeight(8)).toBeCloseTo(8 / 9)
	})

	it('raises every corner when the same fluid is above', () => {
		const fluid: FluidState = { type: 'water', level: 0 }
		const heights = getFluidCornerHeights(context(fluid, { '0,1,0': { fluid } }))
		expect(heights).toEqual({ northWest: 1, northEast: 1, southEast: 1, southWest: 1 })
	})

	it('weights source water more strongly than empty neighboring cells', () => {
		const heights = getFluidCornerHeights(context({ type: 'water', level: 0 }))
		for (const height of Object.values(heights)) {
			expect(height).toBeCloseTo((8 / 9 * 10) / 13)
		}
	})

	it('slopes and flows toward a lower eastern neighbor', () => {
		const fluid: FluidState = { type: 'water', level: 0 }
		const cells = {
			'-1,0,0': { fluid },
			'1,0,0': { fluid: { type: 'water', level: 7 } as FluidState },
		}
		const renderContext = context(fluid, cells)
		expect(getFluidFlow(renderContext)[0]).toBeGreaterThan(0.9)
		expect(getFluidCornerHeights(renderContext).northWest).toBeGreaterThan(getFluidCornerHeights(renderContext).northEast)
	})

	it('culls internal faces shared with matching fluid', () => {
		const fluid: FluidState = { type: 'water', level: 0 }
		const mesh = getFluidMesh(context(fluid, {
			'0,1,0': { fluid },
			'0,-1,0': { fluid },
			'0,0,-1': { fluid },
			'1,0,0': { fluid },
			'0,0,1': { fluid },
			'-1,0,0': { fluid },
		}), atlas)
		expect(mesh.quads).toHaveLength(0)
	})

	it('uses still UVs for level surfaces and flowing UVs for slopes', () => {
		const fluid: FluidState = { type: 'water', level: 0 }
		const levelTop = getFluidMesh(context(fluid, {
			'-1,0,0': { solid: true }, '1,0,0': { solid: true },
			'0,0,-1': { solid: true }, '0,0,1': { solid: true },
		}), atlas).quads[0]
		const flowingTop = getFluidMesh(context(fluid, {
			'-1,0,0': { fluid },
			'1,0,0': { fluid: { type: 'water', level: 7 } },
		}), atlas).quads[0]
		expect(levelTop.v1.textureLimit).toEqual([0, 0, 0.5, 0.5])
		expect(flowingTop.v1.textureLimit).toEqual([0.5, 0.5, 1, 1])
	})
})
