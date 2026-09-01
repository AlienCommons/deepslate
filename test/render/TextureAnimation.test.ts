import { describe, expect, it } from 'vitest'
import { getTextureAnimationFrame } from '../../src/render/TextureAtlas.js'
import type { TextureAnimation } from '../../src/render/TextureAtlas.js'

const image = {} as ImageData

describe('texture animation timing', () => {
	it('selects frames using Minecraft tick durations', () => {
		const animation: TextureAnimation = {
			x: 0,
			y: 0,
			frames: [
				{ image, durationMs: 50 },
				{ image, durationMs: 100 },
				{ image, durationMs: 50 },
			],
		}
		expect(getTextureAnimationFrame(animation, 0)).toBe(0)
		expect(getTextureAnimationFrame(animation, 49)).toBe(0)
		expect(getTextureAnimationFrame(animation, 50)).toBe(1)
		expect(getTextureAnimationFrame(animation, 149)).toBe(1)
		expect(getTextureAnimationFrame(animation, 150)).toBe(2)
		expect(getTextureAnimationFrame(animation, 200)).toBe(0)
	})

	it('wraps negative and large elapsed times', () => {
		const animation: TextureAnimation = {
			x: 0,
			y: 0,
			frames: [
				{ image, durationMs: 50 },
				{ image, durationMs: 50 },
			],
		}
		expect(getTextureAnimationFrame(animation, -1)).toBe(1)
		expect(getTextureAnimationFrame(animation, 1000)).toBe(0)
	})
})
