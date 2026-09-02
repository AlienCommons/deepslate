import { describe, expect, it } from 'vitest'
import { BlockState } from '../../src/core/BlockState.js'
import { Cull } from '../../src/render/Cull.js'
import { getFluidCornerHeights, getFluidFlow, getFluidMesh, getFluidOwnHeight, getWaterloggedFluidVolumes } from '../../src/render/FluidRenderer.js'
import type { FluidCell, FluidRenderContext, FluidState } from '../../src/render/FluidRenderer.js'
import { SpecialRenderers } from '../../src/render/SpecialRenderer.js'
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
		expect(flowingTop.vertices().map(vertex => vertex.texture)).toEqual([
			[0.875, 0.625], [0.625, 0.625], [0.625, 0.875], [0.875, 0.875],
		])
	})

	it('maps flowing side textures from top to bottom like Minecraft', () => {
		const fluid: FluidState = { type: 'water', level: 0 }
		const mesh = getFluidMesh(context(fluid, {
			'0,1,0': { fluid },
			'0,-1,0': { fluid },
			'1,0,0': { solid: true },
			'0,0,1': { solid: true },
			'-1,0,0': { solid: true },
		}), atlas)

		expect(mesh.quads).toHaveLength(1)
		expect(mesh.quads[0].vertices().map(vertex => vertex.texture)).toEqual([
			[0.5, 0.75], [0.5, 0.5], [0.75, 0.5], [0.75, 0.75],
		])
	})

	it('keeps the underside still texture aligned with Minecraft', () => {
		const fluid: FluidState = { type: 'water', level: 0 }
		const mesh = getFluidMesh(context(fluid, {
			'0,1,0': { fluid },
			'0,0,-1': { fluid },
			'1,0,0': { fluid },
			'0,0,1': { fluid },
			'-1,0,0': { fluid },
		}), atlas)

		expect(mesh.quads).toHaveLength(1)
		expect(mesh.quads[0].vertices().map(vertex => vertex.texture)).toEqual([
			[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5],
		])
	})

	it('emits only the outside faces of a solid fluid section', () => {
		const size = 8
		const fluid: FluidState = { type: 'water', level: 0 }
		let quads = 0
		for (let x = 0; x < size; x += 1) {
			for (let y = 0; y < size; y += 1) {
				for (let z = 0; z < size; z += 1) {
					const renderContext: FluidRenderContext = {
						fluid,
						sample: (dx, dy, dz) => {
							const inside = x + dx >= 0 && x + dx < size
								&& y + dy >= 0 && y + dy < size
								&& z + dz >= 0 && z + dz < size
							return inside ? { fluid } : {}
						},
					}
					quads += getFluidMesh(renderContext, atlas).quads.length
				}
			}
		}
		expect(quads).toBe(6 * size * size)
	})
})

describe('waterlogged fluid volumes', () => {
	it('does not merge water into the solid block mesh', () => {
		const mesh = SpecialRenderers.getBlockMesh(
			new BlockState('oak_slab', { type: 'bottom', waterlogged: 'true' }),
			undefined,
			atlas,
			Cull.none(),
		)
		expect(mesh.isEmpty()).toBe(true)
	})

	it('keeps water above bottom slabs and below top slabs', () => {
		expect(getWaterloggedFluidVolumes(new BlockState('oak_slab', { type: 'bottom', waterlogged: 'true' }))).toEqual([{
			minX: 0, minY: 0.5, minZ: 0,
			maxX: 1, maxY: 1, maxZ: 1,
		}])
		expect(getWaterloggedFluidVolumes(new BlockState('oak_slab', { type: 'top', waterlogged: 'true' }))).toEqual([{
			minX: 0, minY: 0, minZ: 0,
			maxX: 1, maxY: 0.5, maxZ: 1,
			topVisible: false,
		}])
	})

	it('clips closed and open trapdoors away from their solid panel', () => {
		expect(getWaterloggedFluidVolumes(new BlockState('oak_trapdoor', {
			half: 'bottom', open: 'false', waterlogged: 'true',
		}))[0].minY).toBe(3 / 16)
		expect(getWaterloggedFluidVolumes(new BlockState('oak_trapdoor', {
			facing: 'north', open: 'true', waterlogged: 'true',
		}))[0].maxZ).toBe(13 / 16)
	})

	it('uses two quarter-cell volumes for a straight stair', () => {
		const volumes = getWaterloggedFluidVolumes(new BlockState('oak_stairs', {
			facing: 'north', half: 'bottom', shape: 'straight', waterlogged: 'true',
		}))
		expect(volumes).toHaveLength(2)
		expect(volumes.every(volume => volume.minY === 0.5 && volume.minZ === 0.5)).toBe(true)
	})

	it('matches inner and outer stair occupancy', () => {
		const state = (shape: string) => new BlockState('oak_stairs', {
			facing: 'north', half: 'bottom', shape, waterlogged: 'true',
		})
		expect(getWaterloggedFluidVolumes(state('inner_left'))).toHaveLength(1)
		expect(getWaterloggedFluidVolumes(state('outer_left'))).toHaveLength(3)
	})

	it('does not emit a coplanar surface beneath top slabs', () => {
		const fluid: FluidState = { type: 'water', level: 0 }
		const volumes = getWaterloggedFluidVolumes(new BlockState('oak_slab', { type: 'top', waterlogged: 'true' }))
		const mesh = getFluidMesh(context(fluid), atlas, volumes)
		const horizontalFacesAtSlab = mesh.quads.filter(quad => quad.vertices().every(vertex => vertex.pos.y === 0.5))
		expect(horizontalFacesAtSlab).toHaveLength(0)
	})
})
