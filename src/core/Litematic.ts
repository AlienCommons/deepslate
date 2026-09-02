import type { NbtCompound, NbtLongArray } from '../nbt/index.js'
import { NbtType } from '../nbt/index.js'
import type { BlockPos } from './BlockPos.js'
import { BlockState } from './BlockState.js'

export interface LitematicBlock {
	pos: BlockPos
	state: BlockState
	nbt?: NbtCompound
}

export interface DecodedLitematic {
	size: BlockPos
	blocks: LitematicBlock[]
}

interface Region {
	name: string
	position: BlockPos
	size: BlockPos
	absSize: BlockPos
	palette: BlockState[]
	states: NbtLongArray
	blockEntities: Map<string, NbtCompound>
}

function readVector(compound: NbtCompound, key: string, regionName: string): BlockPos {
	const value = compound.get(key)
	if (!value?.isCompound() || !['x', 'y', 'z'].every(axis => value.hasNumber(axis))) {
		throw new Error(`Litematic region "${regionName}" has an invalid ${key} tag`)
	}
	return ['x', 'y', 'z'].map(axis => value.getNumber(axis)) as BlockPos
}

function volume(size: BlockPos, regionName: string) {
	const result = size[0] * size[1] * size[2]
	if (!size.every(value => Number.isSafeInteger(value) && value > 0) || !Number.isSafeInteger(result)) {
		throw new Error(`Litematic region "${regionName}" has an invalid Size`)
	}
	return result
}

function blockEntityPosition(tag: NbtCompound): BlockPos | undefined {
	if (['x', 'y', 'z'].every(axis => tag.hasNumber(axis))) {
		return ['x', 'y', 'z'].map(axis => tag.getNumber(axis)) as BlockPos
	}
	const pos = tag.get('Pos')
	if (pos?.isIntArray() && pos.length >= 3) {
		return pos.getAsTuple(3, value => value?.getAsNumber() ?? 0)
	}
	return undefined
}

function readBlockEntities(region: NbtCompound, version: number) {
	const entities = new Map<string, NbtCompound>()
	region.getList('TileEntities', NbtType.Compound).forEach(entry => {
		const pos = blockEntityPosition(entry)
		const nbt = version === 1 && entry.hasCompound('TileNBT') ? entry.getCompound('TileNBT') : entry
		if (pos) entities.set(pos.join(','), nbt)
	})
	return entities
}

function readRegion(name: string, tag: NbtCompound, version: number): Region {
	const position = readVector(tag, 'Position', name)
	const size = readVector(tag, 'Size', name)
	const absSize = size.map(Math.abs) as BlockPos
	const regionVolume = volume(absSize, name)
	const paletteTag = tag.get('BlockStatePalette')
	if (!paletteTag?.isList() || paletteTag.getType() !== NbtType.Compound || paletteTag.length === 0) {
		throw new Error(`Litematic region "${name}" has an invalid BlockStatePalette`)
	}
	const palette = paletteTag.map((entry, index) => {
		try {
			return BlockState.fromNbt(entry)
		} catch (error) {
			throw new Error(`Litematic region "${name}" has an invalid palette entry ${index}`, { cause: error })
		}
	})
	const statesTag = tag.get('BlockStates')
	if (!statesTag?.isLongArray()) {
		throw new Error(`Litematic region "${name}" has no BlockStates long array`)
	}
	const bits = Math.max(2, Math.ceil(Math.log2(palette.length)))
	const requiredLongs = Math.ceil(regionVolume * bits / 64)
	if (statesTag.length < requiredLongs) {
		throw new Error(`Litematic region "${name}" has ${statesTag.length} BlockStates longs; expected at least ${requiredLongs}`)
	}
	return {
		name,
		position,
		size,
		absSize,
		palette,
		states: statesTag,
		blockEntities: readBlockEntities(tag, version),
	}
}

function paletteIndex(region: Region, index: number) {
	const bits = Math.max(2, Math.ceil(Math.log2(region.palette.length)))
	const bitIndex = index * bits
	const longIndex = Math.floor(bitIndex / 64)
	const bitOffset = bitIndex % 64
	const mask = (1n << BigInt(bits)) - 1n
	const first = BigInt.asUintN(64, region.states.get(longIndex)?.toBigInt() ?? 0n)
	let value = first >> BigInt(bitOffset)
	if (bitOffset + bits > 64) {
		const second = BigInt.asUintN(64, region.states.get(longIndex + 1)?.toBigInt() ?? 0n)
		value |= second << BigInt(64 - bitOffset)
	}
	return Number(value & mask)
}

function isAir(state: BlockState) {
	return state.is('air') || state.is('cave_air') || state.is('void_air')
}

export function decodeLitematic(root: NbtCompound): DecodedLitematic {
	const regionsTag = root.get('Regions')
	if (!regionsTag?.isCompound() || regionsTag.size === 0) {
		throw new Error('Invalid Litematic file: missing Regions compound')
	}
	const version = root.hasNumber('Version') ? root.getNumber('Version') : 0
	const regions: Region[] = []
	regionsTag.forEach((name, tag) => {
		if (!tag.isCompound()) {
			throw new Error(`Litematic Regions entry "${name}" is not a compound`)
		}
		regions.push(readRegion(name, tag, version))
	})

	const min: BlockPos = [Infinity, Infinity, Infinity]
	const max: BlockPos = [-Infinity, -Infinity, -Infinity]
	regions.forEach(region => {
		for (let axis = 0; axis < 3; axis += 1) {
			const end = region.position[axis] + Math.sign(region.size[axis]) * (region.absSize[axis] - 1)
			min[axis] = Math.min(min[axis], region.position[axis], end)
			max[axis] = Math.max(max[axis], region.position[axis], end)
		}
	})

	const blocks = new Map<string, LitematicBlock>()
	regions.forEach(region => {
		const [sizeX, sizeY, sizeZ] = region.absSize
		for (let y = 0; y < sizeY; y += 1) {
			for (let z = 0; z < sizeZ; z += 1) {
				for (let x = 0; x < sizeX; x += 1) {
					const index = y * sizeX * sizeZ + z * sizeX + x
					const stateIndex = paletteIndex(region, index)
					const state = region.palette[stateIndex]
					if (!state) {
						throw new Error(`Litematic region "${region.name}" block ${index} references invalid palette index ${stateIndex}`)
					}
					if (isAir(state)) continue
					const local: BlockPos = [x, y, z]
					const world = local.map((value, axis) => region.position[axis] + Math.sign(region.size[axis]) * value) as BlockPos
					const pos = world.map((value, axis) => value - min[axis]) as BlockPos
					blocks.set(pos.join(','), {
						pos,
						state,
						nbt: region.blockEntities.get(local.join(',')),
					})
				}
			}
		}
	})

	return {
		size: max.map((value, axis) => value - min[axis] + 1) as BlockPos,
		blocks: [...blocks.values()],
	}
}
