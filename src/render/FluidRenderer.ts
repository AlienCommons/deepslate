import { Direction } from '../core/Direction.js'
import { BlockColors } from './BlockColors.js'
import { BlockModel } from './BlockModel.js'
import type { Cull } from './Cull.js'
import type { TextureAtlasProvider } from './TextureAtlas.js'

/**
 * Builds the legacy, context-free liquid cuboid.
 *
 * This is kept as an explicit baseline while the neighbor-aware fluid mesher is
 * developed. Callers should not assume its flat surface matches Minecraft.
 */
export function getLegacyFluidMesh(type: string, level: number, atlas: TextureAtlasProvider, cull: Cull, tintindex?: number) {
	const y = cull.up ? 16 : [14.2, 12.5, 10.5, 9, 7, 5.3, 3.7, 1.9, 16, 16, 16, 16, 16, 16, 16, 16][level]
	return new BlockModel(undefined, {
		still: `block/${type}_still`,
		flow: `block/${type}_flow`,
	}, [{
		from: [0, 0, 0],
		to: [16, y, 16],
		faces: {
			up: { texture: '#still', tintindex, cullface: Direction.UP },
			down: { texture: '#still', tintindex, cullface: Direction.DOWN },
			north: { texture: '#flow', tintindex, cullface: Direction.NORTH },
			east: { texture: '#flow', tintindex, cullface: Direction.EAST },
			south: { texture: '#flow', tintindex, cullface: Direction.SOUTH },
			west: { texture: '#flow', tintindex, cullface: Direction.WEST },
		},
	}]).getMesh(atlas, cull, BlockColors[type]?.({}))
}
