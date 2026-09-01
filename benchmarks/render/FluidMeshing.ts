import * as b from 'benny'
import { getFluidMesh } from '../../src/render/FluidRenderer.js'
import type { FluidRenderContext, FluidState } from '../../src/render/FluidRenderer.js'
import type { TextureAtlasProvider } from '../../src/render/TextureAtlas.js'

const size = 16
const fluid: FluidState = { type: 'water', level: 0 }
const atlas: TextureAtlasProvider = {
	getTextureAtlas: () => { throw new Error('Texture image is not used by the mesh benchmark') },
	getTextureUV: () => [0, 0, 1, 1],
}
const contexts: FluidRenderContext[] = []
for (let x = 0; x < size; x += 1) {
	for (let y = 0; y < size; y += 1) {
		for (let z = 0; z < size; z += 1) {
			contexts.push({
				fluid,
				sample: (dx, dy, dz) => {
					const inside = x + dx >= 0 && x + dx < size
						&& y + dy >= 0 && y + dy < size
						&& z + dz >= 0 && z + dz < size
					return inside ? { fluid } : {}
				},
			})
		}
	}
}

b.suite('FluidMeshing',
	b.add('mesh a 16³ source-water section', () => {
		for (const context of contexts) getFluidMesh(context, atlas)
	}),
	b.cycle(),
	b.complete(),
)
