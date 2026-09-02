import type { NbtCompound } from '../nbt/index.js'
import type { Identifier } from '../core/index.js'
import { EntityModel } from './EntityModel.js'
import type { EntityGeometryDefinition, EntityModelProvider } from './EntityModel.js'
import type { RenderLayer } from './RenderLayer.js'

interface ModelOption {
	geometry?: string
	texture?: string
	textures?: Record<string, string>
	baby_texture?: string
	render_layer?: RenderLayer
}

interface ModelAxis {
	default?: string
	options: Record<string, ModelOption>
}

interface ModelEntry {
	axes: Record<string, ModelAxis>
}

export interface EntityModelDataSet {
	source_version?: string
	models: Record<string, ModelEntry>
	geometries: Record<string, EntityGeometryDefinition>
}

export interface EntityTextureInfo {
	width: number
	height: number
}

const makeBoat = (texture: string) => new EntityModel(texture, {
	texture_size: [128, 64],
	bones: {
		body: {
			pivot: [0, 24, 0],
			cubes: [
				{ origin: [-14, -3, -8], size: [28, 3, 16], uv: [0, 0] },
				{ origin: [-14, -12, -8], size: [2, 9, 16], uv: [0, 19] },
				{ origin: [12, -12, -8], size: [2, 9, 16], uv: [0, 19], mirror: true },
				{ origin: [-12, -12, -8], size: [24, 9, 2], uv: [0, 36] },
				{ origin: [-12, -12, 6], size: [24, 9, 2], uv: [0, 36], mirror: true },
			],
		},
	},
})

const makeMinecart = (texture: string) => new EntityModel(texture, {
	texture_size: [64, 32],
	bones: {
		body: {
			pivot: [0, 24, 0],
			cubes: [
				{ origin: [-10, -4, -8], size: [20, 4, 16], uv: [0, 10] },
				{ origin: [-10, -12, -8], size: [2, 8, 16], uv: [0, 0] },
				{ origin: [8, -12, -8], size: [2, 8, 16], uv: [0, 0], mirror: true },
				{ origin: [-8, -12, -8], size: [16, 8, 2], uv: [0, 0] },
				{ origin: [-8, -12, 6], size: [16, 8, 2], uv: [0, 0], mirror: true },
			],
		},
	},
})

export class EntityModelRegistry implements EntityModelProvider {
	private readonly modelCache = new Map<string, EntityModel>()
	private readonly textureEntries: Array<[string, EntityTextureInfo]>

	constructor(
		private readonly data: EntityModelDataSet,
		textures: Record<string, EntityTextureInfo>,
	) {
		this.textureEntries = Object.entries(textures)
	}

	public getSourceVersion() {
		return this.data.source_version
	}

	public getEntityModel(id: Identifier, nbt: NbtCompound) {
		const cacheKey = `${id}|${this.appearanceKey(nbt)}`
		const cached = this.modelCache.get(cacheKey)
		if (cached) return cached
		const model = this.createSpecialModel(id.path, nbt) ?? this.createDataModel(id.toString(), nbt) ?? this.createFallbackModel(id.path)
		if (model) this.modelCache.set(cacheKey, model)
		return model
	}

	private createDataModel(id: string, nbt: NbtCompound) {
		const entry = this.data.models[id]
		if (!entry) return null
		let resolved: ModelOption = {}
		Object.entries(entry.axes).forEach(([name, axis]) => {
			const selection = this.selectAxis(name, axis, nbt)
			resolved = { ...resolved, ...axis.options[selection] }
		})
		const geometry = resolved.geometry ? this.data.geometries[resolved.geometry] : undefined
		let texture = resolved.texture ?? Object.values(resolved.textures ?? {})[0]
		if (this.isBaby(nbt) && resolved.baby_texture) texture = resolved.baby_texture
		if (!geometry || !texture) return null
		const textureId = `minecraft:entity/${texture}`
		if (!this.hasTexture(textureId)) return null
		return new EntityModel(textureId, geometry, resolved.render_layer ?? this.getRenderLayer(id.replace(/^minecraft:/, '')))
	}

	private selectAxis(name: string, axis: ModelAxis, nbt: NbtCompound) {
		const options = Object.keys(axis.options)
		if (name === 'age') return this.isBaby(nbt) && axis.options.baby ? 'baby' : (axis.options.adult ? 'adult' : axis.default ?? options[0])
		if (name === 'size') return nbt.getBoolean('Small') && axis.options.small ? 'small' : (axis.default ?? (axis.options.large ? 'large' : options[0]))
		const raw = nbt.getString(name) || nbt.getString(name[0].toUpperCase() + name.slice(1))
		const normalized = raw.replace(/^minecraft:/, '')
		return (normalized && axis.options[normalized]) ? normalized : (axis.default ?? options[0])
	}

	private isBaby(nbt: NbtCompound) {
		return nbt.getBoolean('IsBaby') || (nbt.hasNumber('Age') && nbt.getNumber('Age') < 0)
	}

	private createSpecialModel(path: string, nbt: NbtCompound) {
		if (path === 'boat' || path.endsWith('_boat') || path === 'chest_boat' || path.endsWith('_chest_boat') || path.endsWith('_raft')) {
			const chest = path.includes('chest')
			const type = nbt.getString('Type') || path.replace(/_?chest_(?:boat|raft)$|_?(?:boat|raft)$/, '') || 'oak'
			return makeBoat(`minecraft:entity/${chest ? 'chest_boat' : 'boat'}/${type}`)
		}
		if (path.includes('minecart')) return makeMinecart('minecraft:entity/minecart/minecart')
		return null
	}

	private createFallbackModel(path: string) {
		const candidates = [
			`minecraft:entity/${path}/${path}`,
			`minecraft:entity/${path}`,
		]
		const texture = candidates.find(candidate => this.textureEntries.some(([id]) => id === candidate))
			?? this.textureEntries.find(([id]) => id.endsWith(`/${path}`) || id.includes(`/${path}/`))?.[0]
			?? 'minecraft:entity/armorstand/armorstand'
		const info = this.textureEntries.find(([id]) => id === texture)?.[1] ?? { width: 64, height: 32 }
		return new EntityModel(texture, {
			texture_size: [info.width, info.height],
			bones: {
				body: {
					pivot: [0, 24, 0],
					cubes: [{ origin: [-8, -16, -8], size: [16, 16, 16], uv: [0, 0] }],
				},
			},
		}, this.getRenderLayer(path))
	}

	private appearanceKey(nbt: NbtCompound) {
		return ['IsBaby', 'Age', 'Small', 'Type', 'variant', 'Variant']
			.map(key => {
				const value = nbt.get(key)
				return `${key}=${value?.isNumber() ? value.getAsNumber() : value?.getAsString() ?? ''}`
			})
			.join(';')
	}

	private hasTexture(id: string) {
		return this.textureEntries.some(([texture]) => texture === id)
	}

	private getRenderLayer(path: string): RenderLayer {
		return path === 'slime' ? 'translucent' : 'cutout'
	}
}
