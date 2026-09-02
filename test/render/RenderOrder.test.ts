import { describe, expect, it } from 'vitest'
import { mat4 } from 'gl-matrix'
import { Vector } from '../../src/math/index.js'
import { Mesh } from '../../src/render/Mesh.js'
import { Quad } from '../../src/render/Quad.js'
import { sortBackToFront } from '../../src/render/RenderOrder.js'

function quadAt(z: number) {
	return Quad.fromPoints(
		new Vector(0, 0, z),
		new Vector(1, 0, z),
		new Vector(1, 1, z),
		new Vector(0, 1, z),
	)
}

function mockGl() {
	const uploads: Uint16Array[] = []
	const gl = {
		ELEMENT_ARRAY_BUFFER: 0x8893,
		DYNAMIC_DRAW: 0x88e8,
		createBuffer: () => ({}),
		deleteBuffer: () => undefined,
		bindBuffer: () => undefined,
		bufferData: (_target: number, data: Uint16Array) => uploads.push(data),
	} as unknown as WebGLRenderingContext
	return { gl, uploads }
}

describe('transparent render ordering', () => {
	it('sorts distant geometry before nearby geometry in view space', () => {
		const view = mat4.create()
		const items = [
			{ id: 'near', center: [0, 0, -2] as [number, number, number] },
			{ id: 'far', center: [0, 0, -20] as [number, number, number] },
			{ id: 'middle', center: [0, 0, -8] as [number, number, number] },
		]
		expect(sortBackToFront(items, item => item.center, view).map(item => item.id)).toEqual(['far', 'middle', 'near'])
	})

	it('uses the supplied camera transform rather than world coordinates', () => {
		const view = mat4.create()
		mat4.rotateY(view, view, Math.PI / 2)
		const items = [
			{ id: 'west', center: [-10, 0, 0] as [number, number, number] },
			{ id: 'east', center: [2, 0, 0] as [number, number, number] },
		]
		expect(sortBackToFront(items, item => item.center, view)[0].id).toBe('east')
	})

	it('updates a mesh index buffer with distant translucent quads first', () => {
		const { gl, uploads } = mockGl()
		const mesh = new Mesh([quadAt(-2), quadAt(-20)])
		mesh.rebuild(gl, {})

		const view = mat4.create()
		mesh.sortQuadsBackToFront(gl, view)
		expect(Array.from(uploads.at(-1)!)).toEqual([
			4, 5, 6, 4, 6, 7,
			0, 1, 2, 0, 2, 3,
		])

		const uploadCount = uploads.length
		mesh.sortQuadsBackToFront(gl, view)
		expect(uploads).toHaveLength(uploadCount)

		mat4.rotateY(view, view, Math.PI)
		mesh.sortQuadsBackToFront(gl, view)
		expect(Array.from(uploads.at(-1)!)).toEqual([
			0, 1, 2, 0, 2, 3,
			4, 5, 6, 4, 6, 7,
		])
	})
})
