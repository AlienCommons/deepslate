import type { JsonValue } from '../util/index.js'
import { NbtCompound } from '../nbt/index.js'
import type { BlockPos } from './BlockPos.js'
import { Structure } from './Structure.js'

export interface StructureSnapshot {
	size: BlockPos
	palette: Array<{ name: string, properties: Record<string, string> }>
	blocks: Array<{ pos: BlockPos, state: number, nbt?: JsonValue }>
	entities: Array<{
		pos: [number, number, number]
		id: string
		nbt: JsonValue
		rotation?: [number, number]
	}>
}

export function createStructureSnapshot(structure: Structure): StructureSnapshot {
	const palette: StructureSnapshot['palette'] = []
	const paletteIndices = new Map<string, number>()
	const blocks = structure.getBlocks().map(block => {
		const key = block.state.toString()
		let state = paletteIndices.get(key)
		if (state === undefined) {
			state = palette.length
			paletteIndices.set(key, state)
			palette.push({
				name: block.state.getName().toString(),
				properties: block.state.getProperties(),
			})
		}
		return {
			pos: [...block.pos] as BlockPos,
			state,
			nbt: block.nbt?.toJson(),
		}
	})
	return {
		size: [...structure.getSize()] as BlockPos,
		palette,
		blocks,
		entities: structure.getEntities().map(entity => ({
			pos: [...entity.pos],
			id: entity.id.toString(),
			nbt: entity.nbt.toJson(),
			rotation: entity.rotation ? [...entity.rotation] : undefined,
		})),
	}
}

export function structureFromSnapshot(snapshot: StructureSnapshot) {
	const structure = new Structure(snapshot.size)
	snapshot.blocks.forEach(block => {
		const state = snapshot.palette[block.state]
		if (!state) throw new Error(`Structure snapshot references invalid palette index ${block.state}`)
		structure.addBlock(
			block.pos,
			state.name,
			state.properties,
			block.nbt === undefined ? undefined : NbtCompound.fromJson(block.nbt),
		)
	})
	snapshot.entities.forEach(entity => structure.addEntity(
		entity.pos,
		entity.id,
		NbtCompound.fromJson(entity.nbt),
		entity.rotation,
	))
	return structure
}
