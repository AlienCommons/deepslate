export const RENDER_LAYERS = ['opaque', 'cutout', 'emissive', 'translucent'] as const

export type RenderLayer = typeof RENDER_LAYERS[number]

export type RenderLayerFlags = {
	render_layer?: RenderLayer,
	/** @deprecated Use render_layer: 'translucent'. */
	semi_transparent?: boolean,
}

export function resolveRenderLayer(flags?: RenderLayerFlags | null): RenderLayer {
	if (flags?.render_layer !== undefined) return flags.render_layer
	return flags?.semi_transparent ? 'translucent' : 'opaque'
}
