import { Direction } from '../core/Direction.js'
import { Identifier } from '../core/Identifier.js'
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

function averageCornerHeight(context: FluidRenderContext, offsets: [number, number][]) {
	let total = 0
	let weight = 0
	for (const [dx, dz] of offsets) {
		const height = getSampleHeight(context, dx, dz)
		if (height >= 1) return 1
		if (height < 0) continue
		const sampleWeight = height >= 0.8 ? 10 : 1
		total += height * sampleWeight
		weight += sampleWeight
	}
	return weight === 0 ? 0 : total / weight
}

export function getFluidCornerHeights(context: FluidRenderContext): FluidCornerHeights {
	return {
		northWest: averageCornerHeight(context, [[0, 0], [-1, 0], [0, -1], [-1, -1]]),
		northEast: averageCornerHeight(context, [[0, 0], [1, 0], [0, -1], [1, -1]]),
		southEast: averageCornerHeight(context, [[0, 0], [1, 0], [0, 1], [1, 1]]),
		southWest: averageCornerHeight(context, [[0, 0], [-1, 0], [0, 1], [-1, 1]]),
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

function textureCoords(uv: UV, flowing = false, flow: [number, number] = [0, 0]) {
	const [u0, v0, u1, v1] = uv
	if (!flowing) return [u0, v0, u0, v1, u1, v1, u1, v0]

	const centerU = (u0 + u1) / 2
	const centerV = (v0 + v1) / 2
	const radiusU = (u1 - u0) * 0.35
	const radiusV = (v1 - v0) * 0.35
	const angle = Math.atan2(flow[1], flow[0]) - Math.PI / 4
	return [0, Math.PI / 2, Math.PI, Math.PI * 3 / 2].flatMap(offset => [
		centerU + Math.cos(angle + offset) * radiusU,
		centerV + Math.sin(angle + offset) * radiusV,
	])
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

export function getFluidMesh(context: FluidRenderContext, atlas: TextureAtlasProvider): Mesh {
	const { type } = context.fluid
	const heights = getFluidCornerHeights(context)
	const stillUv = atlas.getTextureUV(Identifier.create(`block/${type}_still`))
	const flowUv = atlas.getTextureUV(Identifier.create(`block/${type}_flow`))
	const color = BlockColors[type]?.({}) ?? [1, 1, 1]
	const mesh = new Mesh()
	const flow = getFluidFlow(context)
	const flowing = flow[0] !== 0 || flow[1] !== 0

	if (!isSameFluid(context.sample(0, 1, 0), type)) {
		mesh.quads.push(fluidQuad([
			[0, heights.northWest, 0],
			[0, heights.southWest, 1],
			[1, heights.southEast, 1],
			[1, heights.northEast, 0],
		], flowing ? flowUv : stillUv, color, textureCoords(flowing ? flowUv : stillUv, flowing, flow)))
	}

	const below = context.sample(0, -1, 0)
	if (!below.solid && !isSameFluid(below, type)) {
		mesh.quads.push(fluidQuad([[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], stillUv, color))
	}

	const sides: {dx: number, dz: number, points: [number, number, number][]}[] = [
		{ dx: 0, dz: -1, points: [[0, 0, 0], [0, heights.northWest, 0], [1, heights.northEast, 0], [1, 0, 0]] },
		{ dx: 1, dz: 0, points: [[1, 0, 0], [1, heights.northEast, 0], [1, heights.southEast, 1], [1, 0, 1]] },
		{ dx: 0, dz: 1, points: [[1, 0, 1], [1, heights.southEast, 1], [0, heights.southWest, 1], [0, 0, 1]] },
		{ dx: -1, dz: 0, points: [[0, 0, 1], [0, heights.southWest, 1], [0, heights.northWest, 0], [0, 0, 0]] },
	]
	for (const side of sides) {
		const neighbor = context.sample(side.dx, 0, side.dz)
		if (!neighbor.solid && !isSameFluid(neighbor, type)) {
			mesh.quads.push(fluidQuad(side.points, flowUv, color))
		}
	}

	return mesh
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
