import type { StructureProvider } from '../core/index.js'
import type { Resources } from './StructureRenderer.js'
import type { Mesh } from './Mesh.js'
import { transformEntityMesh } from './EntityModel.js'
import type { RenderLayer } from './RenderLayer.js'
import type { LightSample } from './LightEngine.js'

interface EntityMesh {
	mesh: Mesh
	layer: RenderLayer
	pos: [number, number, number]
}

export class EntityMeshBuilder {
	private meshes: EntityMesh[] = []

	constructor(
		private readonly gl: WebGLRenderingContext,
		private structure: StructureProvider,
		private readonly resources: Resources,
		private readonly sampleLight: (pos: [number, number, number]) => LightSample,
	) {
		this.rebuild()
	}

	public setStructure(structure: StructureProvider) {
		this.structure = structure
		this.rebuild()
	}

	public rebuild() {
		this.meshes.forEach(({ mesh }) => mesh.dispose(this.gl))
		this.meshes = []
		if (!this.resources.getEntityModel || !this.structure.getEntities) return
		this.structure.getEntities().forEach(entity => {
			try {
				const model = this.resources.getEntityModel!(entity.id, entity.nbt)
				if (!model) return
				const mesh = transformEntityMesh(model.getMesh(this.resources), entity)
				if (mesh.isEmpty()) return
				this.applyLighting(mesh, entity.pos)
				mesh.rebuild(this.gl, { pos: true, color: true, texture: true, normal: true, light: true })
				this.meshes.push({ mesh, layer: model.getRenderLayer(), pos: entity.pos })
			} catch (error) {
				console.error(`Error rendering entity ${entity.id}`, error)
			}
		})
	}

	public updateLighting() {
		this.meshes.forEach(({ mesh, pos }) => {
			this.applyLighting(mesh, pos)
			mesh.rebuild(this.gl, { light: true })
		})
	}

	public getMeshes(layer?: RenderLayer) {
		return this.meshes
			.filter(entry => layer === undefined || entry.layer === layer)
			.map(entry => entry.mesh)
	}

	public dispose() {
		this.meshes.forEach(({ mesh }) => mesh.dispose(this.gl))
		this.meshes = []
	}

	private applyLighting(mesh: Mesh, pos: [number, number, number]) {
		const light = this.sampleLight([pos[0], pos[1] + 0.5, pos[2]])
		mesh.quads.forEach(quad => quad.forEach(vertex => {
			vertex.light = [light.sky / 15, light.block / 15, 1]
		}))
	}
}
