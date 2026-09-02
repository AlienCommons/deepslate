import type { StructureProvider } from '../core/index.js'
import type { Resources } from './StructureRenderer.js'
import type { Mesh } from './Mesh.js'
import { transformEntityMesh } from './EntityModel.js'

export class EntityMeshBuilder {
	private meshes: Mesh[] = []

	constructor(
		private readonly gl: WebGLRenderingContext,
		private structure: StructureProvider,
		private readonly resources: Resources,
	) {
		this.rebuild()
	}

	public setStructure(structure: StructureProvider) {
		this.structure = structure
		this.rebuild()
	}

	public rebuild() {
		this.meshes.forEach(mesh => mesh.dispose(this.gl))
		this.meshes = []
		if (!this.resources.getEntityModel || !this.structure.getEntities) return
		this.structure.getEntities().forEach(entity => {
			try {
				const model = this.resources.getEntityModel!(entity.id, entity.nbt)
				if (!model) return
				const mesh = transformEntityMesh(model.getMesh(this.resources), entity)
				if (mesh.isEmpty()) return
				mesh.rebuild(this.gl, { pos: true, color: true, texture: true, normal: true, light: true })
				this.meshes.push(mesh)
			} catch (error) {
				console.error(`Error rendering entity ${entity.id}`, error)
			}
		})
	}

	public getMeshes() {
		return this.meshes
	}

	public dispose() {
		this.meshes.forEach(mesh => mesh.dispose(this.gl))
		this.meshes = []
	}
}
