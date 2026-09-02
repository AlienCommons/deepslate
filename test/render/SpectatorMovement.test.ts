import { describe, expect, it } from 'vitest'
import { getSpectatorLook, getSpectatorMovement } from '../../demo/SpectatorMovement.js'

describe('Minecraft-style spectator movement', () => {
	it('moves forward along the current look direction', () => {
		expect(getSpectatorMovement(0, 1, 0, 0)).toEqual([0, 0, -1])
		const turned = getSpectatorMovement(Math.PI / 2, 1, 0, 0)
		expect(turned[0]).toBeCloseTo(1)
		expect(turned[2]).toBeCloseTo(0)
	})

	it('moves right relative to the current look direction', () => {
		expect(getSpectatorMovement(0, 0, 1, 0)).toEqual([1, 0, 0])
		const turned = getSpectatorMovement(Math.PI / 2, 0, 1, 0)
		expect(turned[0]).toBeCloseTo(0)
		expect(turned[2]).toBeCloseTo(1)
	})

	it('turns right when the pointer moves right', () => {
		const [yaw] = getSpectatorLook(0, 0, 100, 0)
		expect(yaw).toBeGreaterThan(0)
		const movement = getSpectatorMovement(yaw, 1, 0, 0)
		expect(movement[0]).toBeGreaterThan(0)
	})

	it('clamps vertical look before it can flip over', () => {
		const [, down] = getSpectatorLook(0, 0, 0, 10_000)
		const [, up] = getSpectatorLook(0, 0, 0, -10_000)
		expect(down).toBeCloseTo(Math.PI / 2 - 0.01)
		expect(up).toBeCloseTo(-Math.PI / 2 + 0.01)
	})

	it('maps Space and Shift to vertical movement', () => {
		expect(getSpectatorMovement(0, 0, 0, 1)).toEqual([0, 1, 0])
		expect(getSpectatorMovement(0, 0, 0, -1)).toEqual([0, -1, 0])
	})

	it('normalizes diagonal input to a constant speed', () => {
		const movement = getSpectatorMovement(0, 1, 1, 1)
		expect(Math.hypot(...movement)).toBeCloseTo(1)
	})
})
