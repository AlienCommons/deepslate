import { describe, expect, it } from 'vitest'
import { RENDER_LAYERS, resolveRenderLayer } from '../../src/render/RenderLayer.js'

describe('render layers', () => {
	it('draws solid layers before translucent geometry', () => {
		expect(RENDER_LAYERS).toEqual(['opaque', 'cutout', 'emissive', 'translucent'])
	})

	it('defaults blocks to the opaque layer', () => {
		expect(resolveRenderLayer()).toBe('opaque')
		expect(resolveRenderLayer({})).toBe('opaque')
	})

	it('supports every explicit render layer', () => {
		for (const layer of RENDER_LAYERS) {
			expect(resolveRenderLayer({ render_layer: layer })).toBe(layer)
		}
	})

	it('keeps semi_transparent flags backward compatible', () => {
		expect(resolveRenderLayer({ semi_transparent: true })).toBe('translucent')
		expect(resolveRenderLayer({ render_layer: 'cutout', semi_transparent: true })).toBe('cutout')
	})
})
