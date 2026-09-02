import { describe, expect, it } from 'vitest'
import { Structure } from '../../src/core/index.js'
import { NbtCompound, NbtDouble, NbtFile, NbtFloat, NbtInt, NbtList, NbtLongArray, NbtString } from '../../src/nbt/index.js'

const vector = (x: number, y: number, z: number) => new NbtCompound()
	.set('x', new NbtInt(x))
	.set('y', new NbtInt(y))
	.set('z', new NbtInt(z))

const state = (name: string, properties?: Record<string, string>) => {
	const tag = new NbtCompound().set('Name', new NbtString(name))
	if (properties) {
		tag.set('Properties', new NbtCompound(new Map(
			Object.entries(properties).map(([key, value]) => [key, new NbtString(value)]),
		)))
	}
	return tag
}

function pack(values: number[], paletteSize: number) {
	const bits = Math.max(2, Math.ceil(Math.log2(paletteSize)))
	const longs = Array<bigint>(Math.ceil(values.length * bits / 64)).fill(0n)
	const mask = (1n << BigInt(bits)) - 1n
	values.forEach((value, index) => {
		const bitIndex = index * bits
		const longIndex = Math.floor(bitIndex / 64)
		const offset = bitIndex % 64
		longs[longIndex] |= (BigInt(value) & mask) << BigInt(offset)
		if (offset + bits > 64) {
			longs[longIndex + 1] |= BigInt(value) >> BigInt(64 - offset)
		}
	})
	return new NbtLongArray(longs.map(value => BigInt.asIntN(64, value)))
}

function region(
	position: [number, number, number],
	size: [number, number, number],
	palette: NbtCompound[],
	values: number[],
	tileEntities: NbtCompound[] = [],
) {
	return new NbtCompound()
		.set('Position', vector(...position))
		.set('Size', vector(...size))
		.set('BlockStatePalette', new NbtList(palette))
		.set('BlockStates', pack(values, palette.length))
		.set('TileEntities', new NbtList(tileEntities))
}

function litematic(regions: Record<string, NbtCompound>, version = 6) {
	return new NbtCompound()
		.set('Version', new NbtInt(version))
		.set('MinecraftDataVersion', new NbtInt(0))
		.set('Metadata', new NbtCompound())
		.set('Regions', new NbtCompound(new Map(Object.entries(regions))))
}

describe('Structure.fromLitematic', () => {
	it('reads X-Z-Y order and properties', () => {
		const root = litematic({ Main: region(
			[0, 0, 0], [2, 2, 2],
			[state('minecraft:air'), state('minecraft:stone'), state('minecraft:oak_stairs', { facing: 'west' })],
			[1, 0, 2, 0, 0, 1, 0, 0],
		) })
		const structure = Structure.fromLitematic(root)

		expect(structure.getSize()).toEqual([2, 2, 2])
		expect(structure.getBlocks().map(block => [block.pos, block.state.toString()])).toEqual([
			[[0, 0, 0], 'minecraft:stone'],
			[[0, 0, 1], 'minecraft:oak_stairs[facing=west]'],
			[[1, 1, 0], 'minecraft:stone'],
		])
	})

	it('decodes entries crossing a long boundary', () => {
		const palette = Array.from({ length: 17 }, (_, i) => state(`minecraft:test_${i}`))
		const values = Array.from({ length: 14 }, (_, i) => i + 1)
		const structure = Structure.fromLitematic(litematic({ Main: region([0, 0, 0], [14, 1, 1], palette, values) }))

		expect(structure.getBlocks().map(block => block.state.getName().path)).toEqual(
			values.map(value => `test_${value}`),
		)
	})

	it('merges and normalizes positive and negative regions', () => {
		const root = litematic({
			Positive: region([4, 2, 8], [2, 1, 1], [state('minecraft:air'), state('minecraft:stone')], [1, 1]),
			Negative: region([1, 2, 8], [-2, 1, 1], [state('minecraft:air'), state('minecraft:gold_block')], [1, 1]),
		})
		const structure = Structure.fromLitematic(root)

		expect(structure.getSize()).toEqual([6, 1, 1])
		expect(structure.getBlocks().map(block => [block.pos, block.state.getName().path])).toEqual([
			[[4, 0, 0], 'stone'],
			[[5, 0, 0], 'stone'],
			[[1, 0, 0], 'gold_block'],
			[[0, 0, 0], 'gold_block'],
		])
	})

	it('keeps block entity NBT', () => {
		const tile = vector(0, 0, 0).set('id', new NbtString('minecraft:chest'))
		const structure = Structure.fromLitematic(litematic({ Main: region(
			[0, 0, 0], [1, 1, 1], [state('minecraft:air'), state('minecraft:chest')], [1], [tile],
		) }))

		expect(structure.getBlock([0, 0, 0])?.nbt?.getString('id')).toBe('minecraft:chest')
	})

	it('loads and normalizes entities with rotation and NBT', () => {
		const main = region(
			[10, 2, -4], [2, 2, 2], [state('minecraft:air'), state('minecraft:stone')], Array(8).fill(0),
		)
		main.set('Entities', new NbtList([
			new NbtCompound()
				.set('id', new NbtString('minecraft:oak_boat'))
				.set('Pos', new NbtList([new NbtDouble(0.5), new NbtDouble(1), new NbtDouble(1.5)]))
				.set('Rotation', new NbtList([new NbtFloat(90), new NbtFloat(0)]))
				.set('CustomName', new NbtString('Machine boat')),
		]))
		const structure = Structure.fromLitematic(litematic({ Main: main }))
		const entities = structure.getEntities()

		expect(entities).toHaveLength(1)
		expect(entities[0].id.toString()).toBe('minecraft:oak_boat')
		expect(entities[0].pos).toEqual([0.5, 1, 1.5])
		expect(entities[0].rotation).toEqual([90, 0])
		expect(entities[0].nbt.getString('CustomName')).toBe('Machine boat')
	})

	it('reads gzip-compressed .litematic bytes', () => {
		const root = litematic({ Main: region(
			[0, 0, 0], [1, 1, 1], [state('minecraft:air'), state('minecraft:water', { level: '0' })], [1],
		) })
		const bytes = new NbtFile('', root, 'gzip', false, undefined).write()
		const structure = Structure.fromLitematic(bytes)

		expect(structure.getBlock([0, 0, 0])?.state.toString()).toBe('minecraft:water[level=0]')
	})

	it('rejects truncated block state data and invalid palette indices', () => {
		const truncated = region([0, 0, 0], [33, 1, 1], [state('minecraft:air'), state('minecraft:stone')], Array(33).fill(1))
		truncated.set('BlockStates', new NbtLongArray([0n]))
		expect(() => Structure.fromLitematic(litematic({ Main: truncated }))).toThrow(/expected at least 2/)

		const invalid = region([0, 0, 0], [1, 1, 1], [state('minecraft:air'), state('minecraft:stone')], [3])
		expect(() => Structure.fromLitematic(litematic({ Main: invalid }))).toThrow(/invalid palette index 3/)
	})
})
