import { describe, expect, it } from 'vitest'
import { Identifier } from '../../src/core/index.js'
import { NbtCompound, NbtInt, NbtString } from '../../src/nbt/index.js'
import { EntityModelRegistry } from '../../src/render/EntityModelRegistry.js'

const geometry = {
	texture_size: [16, 16] as [number, number],
	bones: { body: { cubes: [{ origin: [0, 0, 0] as [number, number, number], size: [1, 1, 1] as [number, number, number], uv: [0, 0] as [number, number] }] } },
}

describe('EntityModelRegistry', () => {
	it('selects adult and baby static forms from NBT', () => {
		const registry = new EntityModelRegistry({
			models: {
				'minecraft:test': { axes: { age: { options: {
					adult: { geometry: 'adult', texture: 'test/adult' },
					baby: { geometry: 'baby', texture: 'test/baby' },
				} } } },
			},
			geometries: { adult: geometry, baby: geometry },
		}, {
			'minecraft:entity/test/adult': { width: 16, height: 16 },
			'minecraft:entity/test/baby': { width: 16, height: 16 },
		})
		const adult = registry.getEntityModel(Identifier.parse('minecraft:test'), new NbtCompound())
		const baby = registry.getEntityModel(Identifier.parse('minecraft:test'), new NbtCompound().set('Age', new NbtInt(-1)))

		expect(adult?.getTexture().toString()).toBe('minecraft:entity/test/adult')
		expect(baby?.getTexture().toString()).toBe('minecraft:entity/test/baby')
	})

	it('provides boat, minecart, and unknown-entity models', () => {
		const registry = new EntityModelRegistry({ models: {}, geometries: {} }, {
			'minecraft:entity/boat/spruce': { width: 128, height: 64 },
			'minecraft:entity/minecart/minecart': { width: 64, height: 32 },
			'minecraft:entity/armorstand/armorstand': { width: 64, height: 64 },
		})
		const boatNbt = new NbtCompound().set('Type', new NbtString('spruce'))

		expect(registry.getEntityModel(Identifier.parse('minecraft:boat'), boatNbt)?.getTexture().path).toBe('entity/boat/spruce')
		expect(registry.getEntityModel(Identifier.parse('minecraft:chest_minecart'), new NbtCompound())?.getTexture().path).toBe('entity/minecart/minecart')
		expect(registry.getEntityModel(Identifier.parse('minecraft:new_entity'), new NbtCompound())).not.toBeNull()
	})

	it('classifies translucent entity models separately', () => {
		const registry = new EntityModelRegistry({ models: {}, geometries: {} }, {
			'minecraft:entity/slime/slime': { width: 64, height: 32 },
			'minecraft:entity/armorstand/armorstand': { width: 64, height: 64 },
		})

		expect(registry.getEntityModel(Identifier.parse('minecraft:slime'), new NbtCompound())?.getRenderLayer()).toBe('translucent')
		expect(registry.getEntityModel(Identifier.parse('minecraft:armor_stand'), new NbtCompound())?.getRenderLayer()).toBe('cutout')
	})
})
