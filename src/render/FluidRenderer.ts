import { Direction } from '../core/Direction.js'
import { Identifier } from '../core/Identifier.js'
import type { BlockState } from '../core/BlockState.js'
import { Vector } from '../math/Vector.js'
import { BlockColors } from './BlockColors.js'
import { BlockModel } from './BlockModel.js'
import type { Cull } from './Cull.js'
import { Mesh } from './Mesh.js'
import { Quad } from './Quad.js'
import type { TextureAtlasProvider } from './TextureAtlas.js'
import type { UV } from './TextureAtlas.js'

export type FluidType = 'water' | 'lava'

export type FluidState = {
	type: FluidType,
	level: number,
}

export type FluidCell = {
	fluid?: FluidState,
	solid?: boolean,
	occludes?: boolean,
}

export type FluidRenderContext = {
	fluid: FluidState,
	sample(dx: number, dy: number, dz: number): FluidCell,
}

export type FluidCornerHeights = {
	northWest: number,
	northEast: number,
	southEast: number,
	southWest: number,
}

export type FluidVolume = {
	minX: number,
	minY: number,
	minZ: number,
	maxX: number,
	maxY: number,
	maxZ: number,
	topVisible?: boolean,
}

const STILL_SURFACE_HEIGHT = 8 / 9

export function getFluidOwnHeight(level: number): number {
	if (level <= 0 || level >= 8) return STILL_SURFACE_HEIGHT
	return (8 - level) / 9
}

function isSameFluid(cell: FluidCell, type: FluidType) {
	return cell.fluid?.type === type
}

function getSampleHeight(context: FluidRenderContext, dx: number, dz: number) {
	const { type } = context.fluid
	if (isSameFluid(context.sample(dx, 1, dz), type)) return 1

	const cell = context.sample(dx, 0, dz)
	if (cell.fluid?.type === type) return getFluidOwnHeight(cell.fluid.level)
	return cell.solid ? -1 : 0
}

function averageCornerHeight(
	context: FluidRenderContext,
	sideA: [number, number],
	sideB: [number, number],
	diagonal: [number, number],
) {
	const sideAHeight = getSampleHeight(context, ...sideA)
	const sideBHeight = getSampleHeight(context, ...sideB)
	if (sideAHeight >= 1 || sideBHeight >= 1) return 1

	const heights = [getSampleHeight(context, 0, 0), sideAHeight, sideBHeight]
	if (sideAHeight > 0 || sideBHeight > 0) {
		heights.push(getSampleHeight(context, ...diagonal))
	}

	let total = 0
	let weight = 0
	for (const height of heights) {
		if (height < 0) continue
		const sampleWeight = height >= 0.8 ? 10 : 1
		total += height * sampleWeight
		weight += sampleWeight
	}
	return weight === 0 ? 0 : total / weight
}

export function getFluidCornerHeights(context: FluidRenderContext): FluidCornerHeights {
	if (getSampleHeight(context, 0, 0) >= 1) {
		return { northWest: 1, northEast: 1, southEast: 1, southWest: 1 }
	}
	return {
		northWest: averageCornerHeight(context, [-1, 0], [0, -1], [-1, -1]),
		northEast: averageCornerHeight(context, [1, 0], [0, -1], [1, -1]),
		southEast: averageCornerHeight(context, [1, 0], [0, 1], [1, 1]),
		southWest: averageCornerHeight(context, [-1, 0], [0, 1], [-1, 1]),
	}
}

export function getFluidFlow(context: FluidRenderContext): [number, number] {
	const center = getSampleHeight(context, 0, 0)
	const heightOrCenter = (dx: number, dz: number) => {
		const height = getSampleHeight(context, dx, dz)
		return height < 0 ? center : height
	}
	const x = heightOrCenter(-1, 0) - heightOrCenter(1, 0)
	const z = heightOrCenter(0, -1) - heightOrCenter(0, 1)
	const length = Math.hypot(x, z)
	return length < 1e-6 ? [0, 0] : [x / length, z / length]
}

function textureCoords(uv: UV) {
	const [u0, v0, u1, v1] = uv
	return [u0, v0, u0, v1, u1, v1, u1, v0]
}

function flowingSurfaceTextureCoords(uv: UV, flow: [number, number]) {
	const [u0, v0, u1, v1] = uv
	const mapU = (value: number) => u0 + (u1 - u0) * value
	const mapV = (value: number) => v0 + (v1 - v0) * value
	const angle = Math.atan2(flow[1], flow[0]) - Math.PI / 2
	const sin = Math.sin(angle) * 0.25
	const cos = Math.cos(angle) * 0.25
	return [
		mapU(0.5 - cos - sin), mapV(0.5 - cos + sin),
		mapU(0.5 - cos + sin), mapV(0.5 + cos + sin),
		mapU(0.5 + cos + sin), mapV(0.5 + cos - sin),
		mapU(0.5 + cos - sin), mapV(0.5 - cos - sin),
	]
}

function sideTextureCoords(uv: UV, bottom: number, leftHeight: number, rightHeight: number) {
	const [u0, v0, u1, v1] = uv
	const mapU = (value: number) => u0 + (u1 - u0) * value
	const mapV = (height: number) => v0 + (v1 - v0) * (1 - height) * 0.5
	return [
		mapU(0), mapV(bottom),
		mapU(0), mapV(leftHeight),
		mapU(0.5), mapV(rightHeight),
		mapU(0.5), mapV(bottom),
	]
}

function fluidQuad(points: [number, number, number][], uv: UV, color: [number, number, number], texture?: number[]) {
	const quad = Quad.fromPoints(
		new Vector(...points[0]),
		new Vector(...points[1]),
		new Vector(...points[2]),
		new Vector(...points[3]),
	)
	quad.setColor(color)
	quad.setTexture(texture ?? textureCoords(uv), uv)
	return quad
}

function interpolateHeight(heights: FluidCornerHeights, x: number, z: number) {
	const north = heights.northWest * (1 - x) + heights.northEast * x
	const south = heights.southWest * (1 - x) + heights.southEast * x
	return north * (1 - z) + south * z
}

function appendFluidVolume(
	mesh: Mesh,
	context: FluidRenderContext,
	volume: FluidVolume,
	heights: FluidCornerHeights,
	stillUv: UV,
	flowUv: UV,
	color: [number, number, number],
	flow: [number, number],
) {
	const { type } = context.fluid
	const { minX, minY, minZ, maxX, maxY, maxZ } = volume
	const northWest = Math.min(maxY, interpolateHeight(heights, minX, minZ))
	const northEast = Math.min(maxY, interpolateHeight(heights, maxX, minZ))
	const southEast = Math.min(maxY, interpolateHeight(heights, maxX, maxZ))
	const southWest = Math.min(maxY, interpolateHeight(heights, minX, maxZ))
	if (Math.max(northWest, northEast, southEast, southWest) <= minY) return

	const flowing = flow[0] !== 0 || flow[1] !== 0
	if (volume.topVisible !== false && !isSameFluid(context.sample(0, 1, 0), type)) {
		mesh.quads.push(fluidQuad([
			[minX, northWest, minZ],
			[minX, southWest, maxZ],
			[maxX, southEast, maxZ],
			[maxX, northEast, minZ],
		], flowing ? flowUv : stillUv, color, flowing ? flowingSurfaceTextureCoords(flowUv, flow) : textureCoords(stillUv)))
	}

	if (minY === 0) {
		const below = context.sample(0, -1, 0)
		if (!below.solid && !isSameFluid(below, type)) {
			mesh.quads.push(fluidQuad([
				[minX, minY, minZ], [maxX, minY, minZ],
				[maxX, minY, maxZ], [minX, minY, maxZ],
			], stillUv, color, [
				stillUv[0], stillUv[1], stillUv[2], stillUv[1],
				stillUv[2], stillUv[3], stillUv[0], stillUv[3],
			]))
		}
	}

	const sides = [
		{
			dx: 0, dz: -1, outer: minZ === 0,
			leftHeight: northWest, rightHeight: northEast,
			points: [[minX, minY, minZ], [minX, northWest, minZ], [maxX, northEast, minZ], [maxX, minY, minZ]],
		},
		{
			dx: 1, dz: 0, outer: maxX === 1,
			leftHeight: northEast, rightHeight: southEast,
			points: [[maxX, minY, minZ], [maxX, northEast, minZ], [maxX, southEast, maxZ], [maxX, minY, maxZ]],
		},
		{
			dx: 0, dz: 1, outer: maxZ === 1,
			leftHeight: southEast, rightHeight: southWest,
			points: [[maxX, minY, maxZ], [maxX, southEast, maxZ], [minX, southWest, maxZ], [minX, minY, maxZ]],
		},
		{
			dx: -1, dz: 0, outer: minX === 0,
			leftHeight: southWest, rightHeight: northWest,
			points: [[minX, minY, maxZ], [minX, southWest, maxZ], [minX, northWest, minZ], [minX, minY, minZ]],
		},
	] as const
	for (const side of sides) {
		if (!side.outer) continue
		const neighbor = context.sample(side.dx, 0, side.dz)
		const occludes = neighbor.occludes ?? neighbor.solid ?? false
		if (!occludes && !isSameFluid(neighbor, type)) {
			mesh.quads.push(fluidQuad(
				side.points.map(point => [...point]) as [number, number, number][],
				flowUv,
				color,
				sideTextureCoords(flowUv, minY, side.leftHeight, side.rightHeight),
			))
		}
	}
}

const FULL_FLUID_VOLUME: FluidVolume = {
	minX: 0, minY: 0, minZ: 0,
	maxX: 1, maxY: 1, maxZ: 1,
}

export function getFluidMesh(context: FluidRenderContext, atlas: TextureAtlasProvider, volumes: FluidVolume[] = [FULL_FLUID_VOLUME]): Mesh {
	const { type } = context.fluid
	const heights = getFluidCornerHeights(context)
	const stillUv = atlas.getTextureUV(Identifier.create(`block/${type}_still`))
	const flowUv = atlas.getTextureUV(Identifier.create(`block/${type}_flow`))
	const color = BlockColors[type]?.({}) ?? [1, 1, 1]
	const mesh = new Mesh()
	const flow = getFluidFlow(context)
	volumes.forEach(volume => appendFluidVolume(mesh, context, volume, heights, stillUv, flowUv, color, flow))

	return mesh
}

function stairWaterCells(facing: string, shape: string): [number, number][] {
	const front: Record<string, [number, number][]> = {
		north: [[0, 0], [1, 0]],
		south: [[0, 1], [1, 1]],
		west: [[0, 0], [0, 1]],
		east: [[1, 0], [1, 1]],
	}
	const left: Record<string, [number, number]> = {
		north: [0, 0], south: [1, 1], west: [0, 1], east: [1, 0],
	}
	const right: Record<string, [number, number]> = {
		north: [1, 0], south: [0, 1], west: [0, 0], east: [1, 1],
	}
	const all: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]]
	let solid = front[facing] ?? front.north
	if (shape === 'outer_left') solid = [left[facing] ?? left.north]
	if (shape === 'outer_right') solid = [right[facing] ?? right.north]
	if (shape === 'inner_left') {
		const open = all.find(cell => cell[0] !== left[facing]?.[0] && cell[1] !== left[facing]?.[1])
		if (open) solid = all.filter(cell => cell !== open)
	}
	if (shape === 'inner_right') {
		const open = all.find(cell => cell[0] !== right[facing]?.[0] && cell[1] !== right[facing]?.[1])
		if (open) solid = all.filter(cell => cell !== open)
	}
	return all.filter(cell => !solid.some(value => value[0] === cell[0] && value[1] === cell[1]))
}

export function getWaterloggedFluidVolumes(block: BlockState): FluidVolume[] {
	const name = block.getName().path
	if (name.endsWith('_slab')) {
		return block.getProperty('type') === 'top'
			? [{ ...FULL_FLUID_VOLUME, maxY: 0.5, topVisible: false }]
			: [{ ...FULL_FLUID_VOLUME, minY: 0.5 }]
	}

	if (name.endsWith('_trapdoor')) {
		if (block.getProperty('open') !== 'true') {
			return block.getProperty('half') === 'top'
				? [{ ...FULL_FLUID_VOLUME, maxY: 13 / 16, topVisible: false }]
				: [{ ...FULL_FLUID_VOLUME, minY: 3 / 16 }]
		}
		switch (block.getProperty('facing')) {
			case 'south': return [{ ...FULL_FLUID_VOLUME, minZ: 3 / 16 }]
			case 'west': return [{ ...FULL_FLUID_VOLUME, maxX: 13 / 16 }]
			case 'east': return [{ ...FULL_FLUID_VOLUME, minX: 3 / 16 }]
			default: return [{ ...FULL_FLUID_VOLUME, maxZ: 13 / 16 }]
		}
	}

	if (name.endsWith('_stairs')) {
		const top = block.getProperty('half') === 'top'
		return stairWaterCells(block.getProperty('facing') ?? 'north', block.getProperty('shape') ?? 'straight').map(([x, z]) => ({
			minX: x / 2,
			minY: top ? 0 : 0.5,
			minZ: z / 2,
			maxX: (x + 1) / 2,
			maxY: top ? 0.5 : 1,
			maxZ: (z + 1) / 2,
			topVisible: !top,
		}))
	}

	return [{ ...FULL_FLUID_VOLUME }]
}

/**
 * Builds the legacy, context-free liquid cuboid.
 *
 * This is kept as an explicit baseline while the neighbor-aware fluid mesher is
 * developed. Callers should not assume its flat surface matches Minecraft.
 */
export function getLegacyFluidMesh(type: string, level: number, atlas: TextureAtlasProvider, cull: Cull, tintindex?: number) {
	const y = cull.up ? 16 : [14.2, 12.5, 10.5, 9, 7, 5.3, 3.7, 1.9, 16, 16, 16, 16, 16, 16, 16, 16][level]
	return new BlockModel(undefined, {
		still: `block/${type}_still`,
		flow: `block/${type}_flow`,
	}, [{
		from: [0, 0, 0],
		to: [16, y, 16],
		faces: {
			up: { texture: '#still', tintindex, cullface: Direction.UP },
			down: { texture: '#still', tintindex, cullface: Direction.DOWN },
			north: { texture: '#flow', tintindex, cullface: Direction.NORTH },
			east: { texture: '#flow', tintindex, cullface: Direction.EAST },
			south: { texture: '#flow', tintindex, cullface: Direction.SOUTH },
			west: { texture: '#flow', tintindex, cullface: Direction.WEST },
		},
	}]).getMesh(atlas, cull, BlockColors[type]?.({}))
}
