import { describe, expect, it } from 'vitest'
import { mat4 } from 'gl-matrix'
import { sortBackToFront } from '../../src/render/RenderOrder.js'

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
})
