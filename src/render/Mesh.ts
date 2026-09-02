import { mat4 as Matrix4, vec3 as Vector3 } from 'gl-matrix'
import type { mat4, vec3 } from 'gl-matrix'
import { Vector } from '../math/Vector.js'
import type { Color } from '../util/Color.js'
import { Line } from './Line.js'
import type { Quad } from './Quad.js'
import { sortBackToFront } from './RenderOrder.js'
import { Vertex } from './Vertex.js'

export class Mesh {
	public posBuffer: WebGLBuffer | undefined
	public colorBuffer: WebGLBuffer | undefined
	public textureBuffer: WebGLBuffer | undefined
	public textureLimitBuffer: WebGLBuffer | undefined
	public normalBuffer: WebGLBuffer | undefined
	public blockPosBuffer: WebGLBuffer | undefined
	public lightBuffer: WebGLBuffer | undefined
	public indexBuffer: WebGLBuffer | undefined
	public indexType: number = 0x1403 // WebGLRenderingContext.UNSIGNED_SHORT

	public linePosBuffer: WebGLBuffer | undefined
	public lineColorBuffer: WebGLBuffer | undefined
	private quadCenters: vec3[] | undefined
	private sortedCamera: { position: vec3, forward: vec3 } | undefined

	constructor(
		public quads: Quad[] = [],
		public lines: Line[] = []
	) {}

	public clear() {
		this.quads = []
		this.lines = []
		this.invalidateQuadOrder()
		return this	
	}

	public dispose(gl: WebGLRenderingContext) {
		const buffers = [
			this.posBuffer,
			this.colorBuffer,
			this.textureBuffer,
			this.textureLimitBuffer,
			this.normalBuffer,
			this.blockPosBuffer,
			this.lightBuffer,
			this.indexBuffer,
			this.linePosBuffer,
			this.lineColorBuffer,
		]
		buffers.forEach(buffer => {
			if (buffer) gl.deleteBuffer(buffer)
		})
		this.posBuffer = undefined
		this.colorBuffer = undefined
		this.textureBuffer = undefined
		this.textureLimitBuffer = undefined
		this.normalBuffer = undefined
		this.blockPosBuffer = undefined
		this.lightBuffer = undefined
		this.indexBuffer = undefined
		this.linePosBuffer = undefined
		this.lineColorBuffer = undefined
		return this
	}

	public isEmpty() {
		return this.quads.length === 0 && this.lines.length === 0
	}

	public quadVertices() {
		return this.quads.length * 4
	}

	public quadIndices() {
		return this.quads.length * 6
	}

	public lineVertices() {
		return this.lines.length * 2
	}

	public merge(other: Mesh) {
		this.quads = this.quads.concat(other.quads)
		this.lines = this.lines.concat(other.lines)
		this.invalidateQuadOrder()
		return this
	}

	public addLine(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, color: Color) {
		const line = new Line(
			Vertex.fromPos(new Vector(x1, y1, z1)),
			Vertex.fromPos(new Vector(x2, y2, z2))
		).setColor(color)
		this.lines.push(line)
		return this
	}

	public addLineCube(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, color: Color) {
		this.addLine(x1, y1, z1, x1, y1, z2, color)
		this.addLine(x2, y1, z1, x2, y1, z2, color)
		this.addLine(x1, y1, z1, x2, y1, z1, color)
		this.addLine(x1, y1, z2, x2, y1, z2, color)

		this.addLine(x1, y1, z1, x1, y2, z1, color)
		this.addLine(x2, y1, z1, x2, y2, z1, color)
		this.addLine(x1, y1, z2, x1, y2, z2, color)
		this.addLine(x2, y1, z2, x2, y2, z2, color)

		this.addLine(x1, y2, z1, x1, y2, z2, color)
		this.addLine(x2, y2, z1, x2, y2, z2, color)
		this.addLine(x1, y2, z1, x2, y2, z1, color)
		this.addLine(x1, y2, z2, x2, y2, z2, color)

		return this
	}

	public transform(transformation: mat4) {
		for (const quad of this.quads) {
			quad.transform(transformation)
		}
		this.invalidateQuadOrder()
		return this
	}

	public sortQuadsBackToFront(gl: WebGLRenderingContext, viewMatrix: mat4) {
		const camera = this.getCamera(viewMatrix)
		if (this.quads.length <= 1 || !this.indexBuffer || this.hasSortedCamera(camera)) return this

		this.quadCenters ??= this.quads.map(quad => {
			const vertices = quad.vertices()
			return vertices.reduce<vec3>((center, vertex) => [
				center[0] + vertex.pos.x / vertices.length,
				center[1] + vertex.pos.y / vertices.length,
				center[2] + vertex.pos.z / vertices.length,
			], [0, 0, 0])
		})
		const order = sortBackToFront(
			this.quads.map((_, index) => index),
			index => this.quadCenters![index],
			viewMatrix,
		)
		this.rebuildIndexBuffer(gl, order)
		this.sortedCamera = camera
		return this
	}

	public computeNormals() {
		for (const quad of this.quads) {
			const normal = quad.normal()
			quad.forEach(v => v.normal = normal)
		}
	}

	public rebuild(gl: WebGLRenderingContext, options: { pos?: boolean, color?: boolean, texture?: boolean, normal?: boolean, blockPos?: boolean, light?: boolean }) {
		const rebuildBuffer = (buffer: WebGLBuffer | undefined, type: number, data: BufferSource): WebGLBuffer | undefined => {
			if (!buffer) {
				buffer = gl.createBuffer() ?? undefined
			}
			if (!buffer) {
				throw new Error('Cannot create new buffer')
			}
			gl.bindBuffer(type, buffer)
			gl.bufferData(type, data, gl.DYNAMIC_DRAW)
			return buffer
		}
		const rebuildBufferV = (array: Quad[] | Line[], buffer: WebGLBuffer | undefined, mapper: (v: Vertex) => number[] | undefined): WebGLBuffer | undefined => {
			if (array.length === 0) {
				if (buffer) gl.deleteBuffer(buffer)
				return undefined
			}
			const data = array.flatMap(e => e.vertices().flatMap(v => {
				const data = mapper(v)
				if (!data) throw new Error('Missing vertex component')
				return data
			}))
			return rebuildBuffer(buffer, gl.ARRAY_BUFFER, new Float32Array(data))
		}

		if (options.pos) {
			this.posBuffer = rebuildBufferV(this.quads, this.posBuffer, v => v.pos.components())
			this.linePosBuffer = rebuildBufferV(this.lines, this.linePosBuffer, v => v.pos.components())
		}
		if (options.color) {
			this.colorBuffer = rebuildBufferV(this.quads, this.colorBuffer, v => v.color)
			this.lineColorBuffer = rebuildBufferV(this.lines, this.lineColorBuffer, v => v.color)
		}
		if (options.texture) {
			this.textureBuffer = rebuildBufferV(this.quads, this.textureBuffer, v => v.texture)
			this.textureLimitBuffer = rebuildBufferV(this.quads, this.textureLimitBuffer, v => v.textureLimit)
		}
		if (options.normal) {
			this.normalBuffer = rebuildBufferV(this.quads, this.normalBuffer, v => v.normal?.components())
		}
		if (options.blockPos) {
			this.blockPosBuffer = rebuildBufferV(this.quads, this.blockPosBuffer, v => v.blockPos?.components())
		}
		if (options.light) {
			this.lightBuffer = rebuildBufferV(this.quads, this.lightBuffer, v => v.light)
		}
		if (this.quads.length === 0) {
			if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer)
			this.indexBuffer = undefined
		} else {
			this.rebuildIndexBuffer(gl)
		}
		this.quadCenters = undefined
		this.sortedCamera = undefined

		return this
	}

	private rebuildIndexBuffer(gl: WebGLRenderingContext, order = this.quads.map((_, index) => index)) {
		this.indexBuffer ??= gl.createBuffer() ?? undefined
		if (!this.indexBuffer) throw new Error('Cannot create new buffer')

		const needsUint32 = this.quadVertices() > 65536
		if (needsUint32) {
			const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
			if (!webgl2 && !gl.getExtension('OES_element_index_uint')) {
				throw new Error('Mesh exceeds the 16-bit index limit and OES_element_index_uint is unavailable')
			}
		}
		this.indexType = needsUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
		const indices = needsUint32
			? new Uint32Array(order.length * 6)
			: new Uint16Array(order.length * 6)
		for (let outputIndex = 0; outputIndex < order.length; outputIndex += 1) {
			const vertexIndex = order[outputIndex] * 4
			indices.set([
				vertexIndex,
				vertexIndex + 1,
				vertexIndex + 2,
				vertexIndex,
				vertexIndex + 2,
				vertexIndex + 3,
			], outputIndex * 6)
		}
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW)
	}

	private hasSortedCamera(camera: { position: vec3, forward: vec3 } | undefined) {
		if (!camera || !this.sortedCamera) return false
		const positionDelta = Vector3.squaredDistance(camera.position, this.sortedCamera.position)
		const directionSimilarity = Vector3.dot(camera.forward, this.sortedCamera.forward)
		return positionDelta < 0.25 * 0.25 && directionSimilarity > Math.cos(Math.PI / 180)
	}

	private getCamera(viewMatrix: mat4) {
		const inverse = Matrix4.invert(Matrix4.create(), viewMatrix)
		if (!inverse) return undefined
		return {
			position: [inverse[12], inverse[13], inverse[14]] as vec3,
			forward: Vector3.normalize(Vector3.create(), [-inverse[8], -inverse[9], -inverse[10]]),
		}
	}

	private invalidateQuadOrder() {
		this.quadCenters = undefined
		this.sortedCamera = undefined
	}
}
