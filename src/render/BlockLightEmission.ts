import type { BlockState } from '../core/index.js'

// Snapshot of BlockState#getLightEmission from Minecraft Java 26.2. Conditional
// blocks are resolved below from the same state properties used by the client.
const CONSTANT_EMISSION = new Map<string, number>([
	['minecraft:lava', 15],
	['minecraft:brown_mushroom', 1],
	['minecraft:torch', 14],
	['minecraft:wall_torch', 14],
	['minecraft:fire', 15],
	['minecraft:soul_fire', 10],
	['minecraft:soul_torch', 10],
	['minecraft:soul_wall_torch', 10],
	['minecraft:copper_torch', 14],
	['minecraft:copper_wall_torch', 14],
	['minecraft:glowstone', 15],
	['minecraft:nether_portal', 11],
	['minecraft:jack_o_lantern', 15],
	['minecraft:enchanting_table', 7],
	['minecraft:brewing_stand', 1],
	['minecraft:lava_cauldron', 15],
	['minecraft:end_portal', 15],
	['minecraft:end_portal_frame', 1],
	['minecraft:dragon_egg', 1],
	['minecraft:ender_chest', 7],
	['minecraft:beacon', 15],
	['minecraft:sea_lantern', 15],
	['minecraft:end_rod', 14],
	['minecraft:end_gateway', 15],
	['minecraft:magma_block', 3],
	['minecraft:conduit', 15],
	['minecraft:lantern', 15],
	['minecraft:soul_lantern', 10],
	['minecraft:copper_lantern', 15],
	['minecraft:exposed_copper_lantern', 15],
	['minecraft:weathered_copper_lantern', 15],
	['minecraft:oxidized_copper_lantern', 15],
	['minecraft:waxed_copper_lantern', 15],
	['minecraft:waxed_exposed_copper_lantern', 15],
	['minecraft:waxed_weathered_copper_lantern', 15],
	['minecraft:waxed_oxidized_copper_lantern', 15],
	['minecraft:shroomlight', 15],
	['minecraft:crying_obsidian', 10],
	['minecraft:amethyst_cluster', 5],
	['minecraft:large_amethyst_bud', 4],
	['minecraft:medium_amethyst_bud', 2],
	['minecraft:small_amethyst_bud', 1],
	['minecraft:sculk_sensor', 1],
	['minecraft:calibrated_sculk_sensor', 1],
	['minecraft:sculk_catalyst', 6],
	['minecraft:ochre_froglight', 15],
	['minecraft:verdant_froglight', 15],
	['minecraft:pearlescent_froglight', 15],
	['minecraft:firefly_bush', 2],
])

const LIT_EMISSION = new Map<string, number>([
	['minecraft:furnace', 13],
	['minecraft:smoker', 13],
	['minecraft:blast_furnace', 13],
	['minecraft:redstone_ore', 9],
	['minecraft:deepslate_redstone_ore', 9],
	['minecraft:redstone_torch', 7],
	['minecraft:redstone_wall_torch', 7],
	['minecraft:redstone_lamp', 15],
	['minecraft:campfire', 15],
	['minecraft:soul_campfire', 10],
	['minecraft:copper_bulb', 15],
	['minecraft:exposed_copper_bulb', 12],
	['minecraft:weathered_copper_bulb', 8],
	['minecraft:oxidized_copper_bulb', 4],
	['minecraft:waxed_copper_bulb', 15],
	['minecraft:waxed_exposed_copper_bulb', 12],
	['minecraft:waxed_weathered_copper_bulb', 8],
	['minecraft:waxed_oxidized_copper_bulb', 4],
])

const GLOW_LICHEN_FACES = ['down', 'up', 'north', 'south', 'west', 'east']

export function getDefaultLightEmission(state: BlockState): number {
	const name = state.getName().toString()
	const constant = CONSTANT_EMISSION.get(name)
	if (constant !== undefined) return constant

	const lit = LIT_EMISSION.get(name)
	if (lit !== undefined) return state.getProperty('lit') === 'true' ? lit : 0

	if (name === 'minecraft:light') return parseLevel(state.getProperty('level'))
	if (name === 'minecraft:sea_pickle') {
		if (state.getProperty('waterlogged') !== 'true') return 0
		return 3 + 3 * parseLevel(state.getProperty('pickles'))
	}
	if (name === 'minecraft:respawn_anchor') {
		const charges = parseLevel(state.getProperty('charges'))
		return charges === 0 ? 0 : charges * 4 - 1
	}
	if (name === 'minecraft:glow_lichen') {
		return GLOW_LICHEN_FACES.some(face => state.getProperty(face) === 'true') ? 7 : 0
	}
	if (name === 'minecraft:cave_vines' || name === 'minecraft:cave_vines_plant') {
		return state.getProperty('berries') === 'true' ? 14 : 0
	}
	if (name === 'minecraft:trial_spawner') {
		const trialState = state.getProperty('trial_spawner_state')
		if (trialState === 'waiting_for_players') return 4
		return trialState === 'active'
			|| trialState === 'waiting_for_reward_ejection'
			|| trialState === 'ejecting_reward' ? 8 : 0
	}
	if (name === 'minecraft:vault') {
		return state.getProperty('vault_state') === 'inactive' ? 6 : 12
	}
	if (name === 'minecraft:candle' || name.startsWith('minecraft:') && name.endsWith('_candle')) {
		return state.getProperty('lit') === 'true' ? 3 * parseLevel(state.getProperty('candles')) : 0
	}
	if (name === 'minecraft:candle_cake' || name.startsWith('minecraft:') && name.endsWith('_candle_cake')) {
		return state.getProperty('lit') === 'true' ? 3 : 0
	}

	return 0
}

function parseLevel(value: string | undefined) {
	const parsed = Number.parseInt(value ?? '0', 10)
	return Number.isFinite(parsed) ? parsed : 0
}
