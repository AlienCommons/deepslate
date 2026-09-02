import type { vec3 } from 'gl-matrix'
import type { BlockState, StructureProvider } from '../core/index.js'

export type LightProperties = {
	opaque?: boolean,
	light_emission?: number,
	light_opacity?: number,
	render_layer?: string,
}

export type LightSample = {
	sky: number,
	block: number,
}

export type LightEngineOptions = {
	maxDenseCells?: number,
}

type CellProperties = {
	emission: number,
	opacity: number,
}

const DIRECTIONS: vec3[] = [
	[1, 0, 0], [-1, 0, 0],
	[0, 1, 0], [0, -1, 0],
	[0, 0, 1], [0, 0, -1],
]

const DEFAULT_MAX_DENSE_CELLS = 4 * 1024 * 1024

export class LightEngine {
	private readonly size: vec3
	private readonly volume: number
	private readonly dense: boolean
	private readonly cells = new Map<number, CellProperties>()
	private readonly columns = new Map<number, { y: number, opacity: number }[]>()
	private skyLight: Uint8Array | undefined
	private blockLight: Uint8Array | Map<number, number>

	constructor(
		private readonly structure: StructureProvider,
		private readonly getProperties: (state: BlockState) => LightProperties | null | undefined,
		options?: LightEngineOptions,
	) {
		this.size = structure.getSize()
		this.volume = this.size[0] * this.size[1] * this.size[2]
		this.dense = this.volume <= (options?.maxDenseCells ?? DEFAULT_MAX_DENSE_CELLS)
		this.blockLight = this.dense ? new Uint8Array(this.volume) : new Map()
		this.rebuild()
	}

	public rebuild() {
		this.cells.clear()
		this.columns.clear()
		this.skyLight = this.dense ? new Uint8Array(this.volume) : undefined
		this.blockLight = this.dense ? new Uint8Array(this.volume) : new Map()

		const sources: number[] = []
		for (const block of this.structure.getBlocks()) {
			const index = this.index(block.pos[0], block.pos[1], block.pos[2])
			const flags = this.getProperties(block.state) ?? {}
			const properties = {
				emission: clampLight(flags.light_emission ?? (flags.render_layer === 'emissive' ? 15 : 0)),
				opacity: clampLight(flags.light_opacity ?? (flags.opaque ? 15 : 0)),
			}
			this.cells.set(index, properties)
			if (properties.emission > 0) {
				this.setBlockLight(index, properties.emission)
				sources.push(index)
			}

			const column = this.columnIndex(block.pos[0], block.pos[2])
			const entries = this.columns.get(column) ?? []
			entries.push({ y: block.pos[1], opacity: properties.opacity })
			this.columns.set(column, entries)
		}
		this.columns.forEach(entries => entries.sort((a, b) => b.y - a.y))

		if (this.dense) this.buildDenseSkyLight()
		this.propagateBlockLight(sources)
		return this
	}

	public getLight(pos: vec3): LightSample {
		return {
			sky: this.getSkyLight(pos),
			block: this.getBlockLight(pos),
		}
	}

	public getSkyLight(pos: vec3) {
		const [x, y, z] = floorPos(pos)
		if (!this.isInside(x, y, z)) return 15
		return this.skyLight?.[this.index(x, y, z)] ?? this.getDirectSkyLight(x, y, z)
	}

	public getBlockLight(pos: vec3) {
		const [x, y, z] = floorPos(pos)
		if (!this.isInside(x, y, z)) return 0
		const index = this.index(x, y, z)
		return this.blockLight instanceof Uint8Array
			? this.blockLight[index]
			: this.blockLight.get(index) ?? 0
	}

	public getOpacity(pos: vec3) {
		const [x, y, z] = floorPos(pos)
		if (!this.isInside(x, y, z)) return 0
		return this.cells.get(this.index(x, y, z))?.opacity ?? 0
	}

	public getEmission(pos: vec3) {
		const [x, y, z] = floorPos(pos)
		if (!this.isInside(x, y, z)) return 0
		return this.cells.get(this.index(x, y, z))?.emission ?? 0
	}

	private buildDenseSkyLight() {
		const skyLight = this.skyLight!
		for (let x = 0; x < this.size[0]; x += 1) {
			for (let z = 0; z < this.size[2]; z += 1) {
				let light = 15
				for (let y = this.size[1] - 1; y >= 0; y -= 1) {
					const index = this.index(x, y, z)
					const opacity = this.cells.get(index)?.opacity ?? 0
					light = opacity >= 15 ? 0 : Math.max(0, light - opacity)
					skyLight[index] = light
				}
			}
		}

		const queue: number[] = []
		for (let index = 0; index < this.volume; index += 1) {
			const light = skyLight[index]
			if (light <= 1) continue
			const [x, y, z] = this.position(index)
			if (DIRECTIONS.some(([dx, dy, dz]) => {
				const nx = x + dx
				const ny = y + dy
				const nz = z + dz
				return this.isInside(nx, ny, nz) && skyLight[this.index(nx, ny, nz)] < light - 1
			})) queue.push(index)
		}
		this.propagate(queue, skyLight)
	}

	private propagateBlockLight(sources: number[]) {
		this.propagate(sources, this.blockLight)
	}

	private propagate(queue: number[], light: Uint8Array | Map<number, number>) {
		let cursor = 0
		while (cursor < queue.length) {
			const index = queue[cursor++]
			const current = light instanceof Uint8Array ? light[index] : light.get(index) ?? 0
			if (current <= 1) continue
			const [x, y, z] = this.position(index)
			for (const [dx, dy, dz] of DIRECTIONS) {
				const nx = x + dx
				const ny = y + dy
				const nz = z + dz
				if (!this.isInside(nx, ny, nz)) continue
				const neighbor = this.index(nx, ny, nz)
				const opacity = this.cells.get(neighbor)?.opacity ?? 0
				const candidate = current - Math.max(1, opacity)
				const previous = light instanceof Uint8Array ? light[neighbor] : light.get(neighbor) ?? 0
				if (candidate <= previous) continue
				if (light instanceof Uint8Array) light[neighbor] = candidate
				else light.set(neighbor, candidate)
				queue.push(neighbor)
			}
		}
	}

	private getDirectSkyLight(x: number, y: number, z: number) {
		let light = 15
		for (const entry of this.columns.get(this.columnIndex(x, z)) ?? []) {
			if (entry.y < y) break
			light = entry.opacity >= 15 ? 0 : Math.max(0, light - entry.opacity)
			if (light === 0) break
		}
		return light
	}

	private setBlockLight(index: number, value: number) {
		if (this.blockLight instanceof Uint8Array) this.blockLight[index] = value
		else this.blockLight.set(index, value)
	}

	private isInside(x: number, y: number, z: number) {
		return x >= 0 && x < this.size[0]
			&& y >= 0 && y < this.size[1]
			&& z >= 0 && z < this.size[2]
	}

	private index(x: number, y: number, z: number) {
		return x * this.size[1] * this.size[2] + y * this.size[2] + z
	}

	private position(index: number): vec3 {
		const x = Math.floor(index / (this.size[1] * this.size[2]))
		const remainder = index - x * this.size[1] * this.size[2]
		const y = Math.floor(remainder / this.size[2])
		return [x, y, remainder - y * this.size[2]]
	}

	private columnIndex(x: number, z: number) {
		return x * this.size[2] + z
	}
}

function clampLight(value: number) {
	return Math.max(0, Math.min(15, Math.round(value)))
}

function floorPos(pos: vec3): vec3 {
	return [Math.floor(pos[0]), Math.floor(pos[1]), Math.floor(pos[2])]
}
