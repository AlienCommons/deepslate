import { describe, expect, it } from 'vitest'
import { Mesh } from '../../src/render/Mesh.js'

describe('Mesh lifecycle', () => {
	it('deletes every allocated WebGL buffer', () => {
		const deleted: WebGLBuffer[] = []
		const gl = {
			deleteBuffer: (buffer: WebGLBuffer) => deleted.push(buffer),
		} as unknown as WebGLRenderingContext
		const mesh = new Mesh()
		mesh.posBuffer = { id: 'position' } as unknown as WebGLBuffer
		mesh.indexBuffer = { id: 'index' } as unknown as WebGLBuffer

		mesh.dispose(gl)

		expect(deleted).toHaveLength(2)
		expect(mesh.posBuffer).toBeUndefined()
		expect(mesh.indexBuffer).toBeUndefined()
	})
})
