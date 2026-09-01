import { describe, expect, it } from 'vitest'
import { getSpectatorMovement } from '../../demo/SpectatorMovement.js'

describe('Minecraft-style spectator movement', () => {
	it('moves forward along the current look direction', () => {
		expect(getSpectatorMovement(0, 1, 0, 0)).toEqual([0, 0, -1])
		const turned = getSpectatorMovement(-Math.PI / 2, 1, 0, 0)
		expect(turned[0]).toBeCloseTo(1)
		expect(turned[2]).toBeCloseTo(0)
	})

	it('maps Space and Shift to vertical movement', () => {
		expect(getSpectatorMovement(0, 0, 0, 1)).toEqual([0, 1, -0])
		expect(getSpectatorMovement(0, 0, 0, -1)).toEqual([0, -1, -0])
	})

	it('normalizes diagonal input to a constant speed', () => {
		const movement = getSpectatorMovement(0, 1, 1, 1)
		expect(Math.hypot(...movement)).toBeCloseTo(1)
	})
})
