import type { NbtCompound } from '../nbt/index.js'
import type { BlockPos } from './BlockPos.js'
import type { BlockState } from './BlockState.js'
import type { PlacedEntity } from './Structure.js'

export interface StructureProvider {
	getSize(): BlockPos
	getBlocks(): { pos: BlockPos, state: BlockState, nbt?: NbtCompound }[]
	getBlock(pos: BlockPos): { pos: BlockPos, state: BlockState, nbt?: NbtCompound } | null
	getEntities?(): PlacedEntity[]
}
