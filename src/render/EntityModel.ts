import { mat4, vec3 } from 'gl-matrix'
import type { NbtCompound } from '../nbt/index.js'
import { Identifier } from '../core/Identifier.js'
import type { PlacedEntity } from '../core/Structure.js'
import { Vector } from '../math/index.js'
import { Mesh } from './Mesh.js'
import { Quad } from './Quad.js'
import type { TextureAtlasProvider } from './TextureAtlas.js'

type Vec3 = [number, number, number]
type Vec2 = [number, number]

export interface EntityCubeDefinition {
	origin: Vec3
	size: Vec3
	uv: Vec2
	grow?: number | Vec3
	mirror?: boolean
	pivot?: Vec3
	rotation?: Vec3
}

export interface EntityBoneDefinition {
	pivot?: Vec3
	rotation?: Vec3
	scale?: number
	parent?: string
	visible?: boolean
	cubes?: EntityCubeDefinition[]
}

export interface EntityGeometryDefinition {
	texture_size?: [number, number]
	bones: Record<string, EntityBoneDefinition>
}

export interface EntityModelProvider {
	getEntityModel(id: Identifier, nbt: NbtCompound): EntityModel | null
}

interface PreparedCube {
	points: Record<string, vec3>
	size: Vec3
	uv: Vec2
	mirror: boolean
}

const rotation = (matrix: mat4, degrees: Vec3) => {
	mat4.rotateZ(matrix, matrix, degrees[2] * Math.PI / 180)
	mat4.rotateY(matrix, matrix, degrees[1] * Math.PI / 180)
	mat4.rotateX(matrix, matrix, degrees[0] * Math.PI / 180)
}

export class EntityModel {
	private readonly texture: Identifier

	constructor(
		texture: Identifier | string,
		private readonly geometry: EntityGeometryDefinition,
	) {
		this.texture = typeof texture === 'string' ? Identifier.parse(texture) : texture
	}

	public getTexture() {
		return this.texture
	}

	public getMesh(resources: TextureAtlasProvider) {
		const textureUv = resources.getTextureUV(this.texture)
		if (!textureUv) return new Mesh()
		const cubes = this.prepareCubes()
		if (cubes.length === 0) return new Mesh()

		const allPoints = cubes.flatMap(cube => Object.values(cube.points))
		const minY = Math.min(...allPoints.map(point => -point[1] / 16))
		const centerX = (Math.min(...allPoints.map(point => point[0])) + Math.max(...allPoints.map(point => point[0]))) / 32
		const centerZ = (Math.min(...allPoints.map(point => point[2])) + Math.max(...allPoints.map(point => point[2]))) / 32
		const toWorld = (point: vec3) => new Vector(point[0] / 16 - centerX, -point[1] / 16 - minY, point[2] / 16 - centerZ)
		const mesh = new Mesh()
		cubes.forEach(cube => this.addCube(mesh, cube, textureUv, toWorld))
		return mesh
	}

	private prepareCubes() {
		const transforms = new Map<string, mat4>()
		const getTransform = (name: string, stack = new Set<string>()): mat4 => {
			const cached = transforms.get(name)
			if (cached) return cached
			if (stack.has(name)) throw new Error(`Entity model contains a bone cycle at ${name}`)
			stack.add(name)
			const bone = this.geometry.bones[name]
			const matrix = bone.parent ? mat4.clone(getTransform(bone.parent, stack)) : mat4.create()
			mat4.translate(matrix, matrix, bone.pivot ?? [0, 0, 0])
			rotation(matrix, bone.rotation ?? [0, 0, 0])
			stack.delete(name)
			transforms.set(name, matrix)
			return matrix
		}

		const result: PreparedCube[] = []
		Object.entries(this.geometry.bones).forEach(([name, bone]) => {
			if (bone.visible === false) return
			const boneTransform = getTransform(name)
			const scale = bone.scale ?? 1
			bone.cubes?.forEach(cube => {
				const grow = typeof cube.grow === 'number' ? [cube.grow, cube.grow, cube.grow] : (cube.grow ?? [0, 0, 0])
				const min = cube.origin.map((value, axis) => (value - grow[axis]) * scale) as Vec3
				const max = cube.origin.map((value, axis) => (value + cube.size[axis] + grow[axis]) * scale) as Vec3
				const cubeTransform = mat4.clone(boneTransform)
				if (cube.rotation && cube.pivot) {
					mat4.translate(cubeTransform, cubeTransform, cube.pivot)
					rotation(cubeTransform, cube.rotation)
					mat4.translate(cubeTransform, cubeTransform, cube.pivot.map(value => -value) as Vec3)
				}
				const point = (x: number, y: number, z: number) => vec3.transformMat4(vec3.create(), [x, y, z], cubeTransform)
				result.push({
					points: {
						nnn: point(min[0], min[1], min[2]), nnp: point(min[0], min[1], max[2]),
						npn: point(min[0], max[1], min[2]), npp: point(min[0], max[1], max[2]),
						pnn: point(max[0], min[1], min[2]), pnp: point(max[0], min[1], max[2]),
						ppn: point(max[0], max[1], min[2]), ppp: point(max[0], max[1], max[2]),
					},
					size: cube.size,
					uv: cube.uv,
					mirror: cube.mirror ?? false,
				})
			})
		})
		return result
	}

	private addCube(mesh: Mesh, cube: PreparedCube, atlas: [number, number, number, number], toWorld: (point: vec3) => Vector) {
		const [x, y, z] = cube.size
		const [u, v] = cube.uv
		const u1 = u + z
		const u2 = u1 + x
		const u3 = u2 + x
		const u4 = u2 + z
		const u5 = u4 + x
		const v1 = v + z
		const v2 = v1 + y
		const faces: Array<{ points: string[], uv: [number, number, number, number], normal: Vec3 }> = [
			{ points: ['nnp', 'nnn', 'npn', 'npp'], uv: [u, v1, u1, v2], normal: [-1, 0, 0] },
			{ points: ['pnn', 'pnp', 'ppp', 'ppn'], uv: [u2, v1, u4, v2], normal: [1, 0, 0] },
			{ points: ['pnn', 'nnn', 'nnp', 'pnp'], uv: [u1, v, u2, v1], normal: [0, 1, 0] },
			{ points: ['ppp', 'npp', 'npn', 'ppn'], uv: [u2, v, u3, v1], normal: [0, -1, 0] },
			{ points: ['nnn', 'pnn', 'ppn', 'npn'], uv: [u1, v1, u2, v2], normal: [0, 0, -1] },
			{ points: ['pnp', 'nnp', 'npp', 'ppp'], uv: [u4, v1, u5, v2], normal: [0, 0, 1] },
		]
		faces.forEach(face => {
			if ((face.normal[0] !== 0 && x === 0) || (face.normal[1] !== 0 && y === 0) || (face.normal[2] !== 0 && z === 0)) return
			const points = face.points.map(key => toWorld(cube.points[key]))
			const quad = Quad.fromPoints(points[0], points[1], points[2], points[3])
			const mapped = this.mapUv(face.uv, atlas, cube.mirror)
			quad.setTexture(mapped, atlas).setColor([1, 1, 1])
			quad.forEach(vertex => {
				vertex.normal = new Vector(...face.normal)
				vertex.light = [1, 0, 1]
			})
			mesh.quads.push(quad)
		})
	}

	private mapUv(rect: [number, number, number, number], atlas: [number, number, number, number], mirror: boolean) {
		const [textureWidth, textureHeight] = this.geometry.texture_size ?? [64, 32]
		const map = (u: number, v: number): [number, number] => [
			atlas[0] + (atlas[2] - atlas[0]) * u / textureWidth,
			atlas[1] + (atlas[3] - atlas[1]) * v / textureHeight,
		]
		const [u1, v1, u2, v2] = rect
		const left = mirror ? u2 : u1
		const right = mirror ? u1 : u2
		return [...map(left, v1), ...map(right, v1), ...map(right, v2), ...map(left, v2)]
	}
}

export function transformEntityMesh(mesh: Mesh, entity: PlacedEntity) {
	const transform = mat4.create()
	mat4.translate(transform, transform, entity.pos)
	const yaw = entity.rotation?.[0] ?? 0
	mat4.rotateY(transform, transform, -yaw * Math.PI / 180)
	return mesh.transform(transform)
}
