import { describe, expect, it } from 'vitest'
import { BlockState } from '../../src/core/index.js'
import { getDefaultLightEmission } from '../../src/render/BlockLightEmission.js'

const emission = (state: string) => getDefaultLightEmission(BlockState.parse(state))

describe('Minecraft 26.2 block light emission', () => {
	it.each([
		['minecraft:glowstone', 15],
		['minecraft:torch', 14],
		['minecraft:soul_lantern', 10],
		['minecraft:copper_torch', 14],
		['minecraft:copper_lantern', 15],
		['minecraft:firefly_bush', 2],
		['minecraft:calibrated_sculk_sensor', 1],
		['minecraft:amethyst_cluster', 5],
		['minecraft:brewing_stand', 1],
	] as const)('matches the constant emission of %s', (state, expected) => {
		expect(emission(state)).toBe(expected)
	})

	it.each([
		['minecraft:furnace[lit=true]', 13],
		['minecraft:furnace[lit=false]', 0],
		['minecraft:redstone_lamp[lit=true]', 15],
		['minecraft:redstone_lamp[lit=false]', 0],
		['minecraft:weathered_copper_bulb[lit=true,powered=false]', 8],
		['minecraft:oxidized_copper_bulb[lit=true,powered=true]', 4],
		['minecraft:soul_campfire[lit=true]', 10],
		['minecraft:soul_campfire[lit=false]', 0],
	] as const)('honors the lit state of %s', (state, expected) => {
		expect(emission(state)).toBe(expected)
	})

	it.each([
		['minecraft:light[level=11]', 11],
		['minecraft:sea_pickle[pickles=4,waterlogged=true]', 15],
		['minecraft:sea_pickle[pickles=4,waterlogged=false]', 0],
		['minecraft:respawn_anchor[charges=3]', 11],
		['minecraft:candle[candles=4,lit=true]', 12],
		['minecraft:blue_candle[candles=2,lit=true]', 6],
		['minecraft:blue_candle_cake[lit=true]', 3],
		['minecraft:cave_vines[berries=true]', 14],
		['minecraft:glow_lichen[up=true]', 7],
		['minecraft:glow_lichen[up=false]', 0],
		['minecraft:trial_spawner[trial_spawner_state=waiting_for_players]', 4],
		['minecraft:trial_spawner[trial_spawner_state=ejecting_reward]', 8],
		['minecraft:trial_spawner[trial_spawner_state=cooldown]', 0],
		['minecraft:vault[vault_state=inactive]', 6],
		['minecraft:vault[vault_state=active]', 12],
	] as const)('matches state-dependent emission for %s', (state, expected) => {
		expect(emission(state)).toBe(expected)
	})

	it('does not assign vanilla light to similarly named modded blocks', () => {
		expect(emission('example:blue_candle[candles=4,lit=true]')).toBe(0)
	})
})
