import { mat4, vec3 } from 'gl-matrix'
import type { PlacedBlock, Resources, StructureProvider } from '../index.js'
import { BlockPos, Direction, Vector } from '../index.js'
import type { BlockState } from '../core/BlockState.js'
import { getFluidMesh, getWaterloggedFluidVolumes } from './FluidRenderer.js'
import type { FluidCell, FluidRenderContext, FluidState } from './FluidRenderer.js'
import { Mesh } from './Mesh.js'
import { RENDER_LAYERS, resolveRenderLayer } from './RenderLayer.js'
import type { RenderLayer } from './RenderLayer.js'
import { SpecialRenderers } from './SpecialRenderer.js'

type ChunkMeshes = Record<RenderLayer, Mesh>

export class ChunkBuilder {
	private chunks: ChunkMeshes[][][] = []
	private readonly chunkSize: vec3

	constructor(
		private readonly gl: WebGLRenderingContext,
		private structure: StructureProvider,
		private readonly resources: Resources,
		chunkSize: number | vec3 = 16
	) {
		this.chunkSize = typeof chunkSize === 'number' ? [chunkSize, chunkSize, chunkSize] : chunkSize
		this.updateStructureBuffers()
	}

	public setStructure(structure: StructureProvider) {
		this.structure = structure
		this.updateStructureBuffers()
	}

	public updateStructureBuffers(chunkPositions?: vec3[]): void {
		if (!this.structure)
			return
		
		if (!chunkPositions) {
			this.chunks.forEach(x => x.forEach(y => y.forEach(chunk => {
				RENDER_LAYERS.forEach(layer => chunk[layer].clear())
			})))
		} else {
			chunkPositions.forEach(chunkPos => {
				const chunk = this.getChunk(chunkPos)
				RENDER_LAYERS.forEach(layer => chunk[layer].clear())
			})
		}

		for (const b of this.structure.getBlocks()) {
			const blockName = b.state.getName()
			const blockProps = b.state.getProperties()
			const defaultProps = this.resources.getDefaultBlockProperties(blockName) ?? {}
			Object.entries(defaultProps).forEach(([k, v]) => {
				if (!blockProps[k]) blockProps[k] = v
			})

			const chunkPos: vec3 = [Math.floor(b.pos[0] / this.chunkSize[0]), Math.floor(b.pos[1] / this.chunkSize[1]), Math.floor(b.pos[2] / this.chunkSize[2])]

			if (chunkPositions && !chunkPositions.some(pos => vec3.equals(pos, chunkPos)))
				continue

			const chunk = this.getChunk(chunkPos)

			try {
				const blockDefinition = this.resources.getBlockDefinition(blockName)
				const cull = {
					up: this.needsCull(b, Direction.UP),
					down: this.needsCull(b, Direction.DOWN),
					west: this.needsCull(b, Direction.WEST),
					east: this.needsCull(b, Direction.EAST),
					north: this.needsCull(b, Direction.NORTH),
					south: this.needsCull(b, Direction.SOUTH),
				}
				const fluid = this.getFluidState(b.state)
				if (fluid) {
					const mesh = getFluidMesh(this.getFluidContext(b.pos, fluid), this.resources)
					this.addBlockMesh(chunk, mesh, b.pos, fluid.type === 'water' ? 'translucent' : 'emissive')
				} else {
					const mesh = new Mesh()
					if (blockDefinition) {
						mesh.merge(blockDefinition.getMesh(blockName, blockProps, this.resources, this.resources, cull))
					}
					const specialMesh = SpecialRenderers.getBlockMesh(b.state, b.nbt, this.resources, cull)
					if (!specialMesh.isEmpty()) {
						mesh.merge(specialMesh)
					}
					this.addBlockMesh(chunk, mesh, b.pos, resolveRenderLayer(this.resources.getBlockFlags(b.state.getName())))

					if (b.state.isWaterlogged()) {
						const water: FluidState = { type: 'water', level: 0 }
						const waterMesh = getFluidMesh(
							this.getFluidContext(b.pos, water),
							this.resources,
							getWaterloggedFluidVolumes(b.state),
						)
						this.addBlockMesh(chunk, waterMesh, b.pos, 'translucent')
					}
				}
			} catch (e) {
				console.error(`Error rendering block ${blockName}`, e)
			}
		}

		if (!chunkPositions) {
			this.chunks.forEach(x => x.forEach(y => y.forEach(chunk => {
				RENDER_LAYERS.forEach(layer => chunk[layer].rebuild(this.gl, { pos: true, color: true, texture: true, normal: true, blockPos: true }))
			})))
		} else {
			chunkPositions.forEach(chunkPos => {
				const chunk = this.getChunk(chunkPos)
				RENDER_LAYERS.forEach(layer => chunk[layer].rebuild(this.gl, { pos: true, color: true, texture: true, normal: true, blockPos: true }))
			})
		}
	}

	public getMeshes(layer?: RenderLayer): Mesh[] {
		const chunks = this.chunks.flatMap(x => x.flatMap(y => y.flatMap(chunk => chunk ?? [])))
		const layers = layer === undefined ? RENDER_LAYERS : [layer]
		return layers.flatMap(currentLayer => chunks.flatMap(chunk => chunk[currentLayer].isEmpty() ? [] : chunk[currentLayer]))
	}

	private getFluidState(block: BlockState): FluidState | undefined {
		if (!block.is('water') && !block.is('lava')) return undefined
		const parsedLevel = Number.parseInt(block.getProperty('level') ?? '0', 10)
		return {
			type: block.is('water') ? 'water' : 'lava',
			level: Number.isFinite(parsedLevel) ? Math.max(0, Math.min(15, parsedLevel)) : 0,
		}
	}

	private getContainedFluidState(block: BlockState): FluidState | undefined {
		return this.getFluidState(block) ?? (block.isWaterlogged() ? { type: 'water', level: 0 } : undefined)
	}

	private getFluidContext(pos: vec3, fluid: FluidState): FluidRenderContext {
		return {
			fluid,
			sample: (dx, dy, dz): FluidCell => {
				const block = this.structure.getBlock([pos[0] + dx, pos[1] + dy, pos[2] + dz])
				if (!block) return {}
				return {
					fluid: this.getContainedFluidState(block.state),
					solid: this.resources.getBlockFlags(block.state.getName())?.opaque ?? false,
				}
			},
		}
	}

	private addBlockMesh(chunk: ChunkMeshes, mesh: Mesh, pos: vec3, layer: RenderLayer) {
		if (mesh.isEmpty()) return
		this.finishChunkMesh(mesh, pos)
		chunk[layer].merge(mesh)
	}

	private needsCull(block: PlacedBlock, dir: Direction) {
		const neighbor = this.structure.getBlock(BlockPos.towards(block.pos, dir))?.state
		if (!neighbor) return false
		const neighborFlags = this.resources.getBlockFlags(neighbor.getName())

		if (block.state.getName().equals(neighbor.getName()) && neighborFlags?.self_culling){
			return true
		}
		
		if (neighborFlags?.opaque) {
			return true
		}
		return false
	}

	private finishChunkMesh(mesh: Mesh, pos: vec3) {
		const t = mat4.create()
		mat4.translate(t, t, pos)
		mesh.transform(t)

		for (const q of mesh.quads) {
			const normal = q.normal()
			q.forEach(v => v.normal = normal)
			q.forEach(v => v.blockPos = new Vector(pos[0], pos[1], pos[2]))
		}
	}

	private getChunk(chunkPos: vec3): ChunkMeshes {
		const x = Math.abs(chunkPos[0]) * 2 + (chunkPos[0] < 0 ? 1 : 0)
		const y = Math.abs(chunkPos[1]) * 2 + (chunkPos[1] < 0 ? 1 : 0)
		const z = Math.abs(chunkPos[2]) * 2 + (chunkPos[2] < 0 ? 1 : 0)

		if (!this.chunks[x]) this.chunks[x] = []
		if (!this.chunks[x][y]) this.chunks[x][y] = []
		if (!this.chunks[x][y][z]) {
			this.chunks[x][y][z] = {
				opaque: new Mesh(),
				cutout: new Mesh(),
				emissive: new Mesh(),
				translucent: new Mesh(),
			}
		}

		return this.chunks[x][y][z]
	}
}
