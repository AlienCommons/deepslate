import { describe, expect, it } from 'vitest'
import { Vector } from '../../src/math/index.js'
import type { LightSample } from '../../src/render/LightEngine.js'
import { sampleVertexLight } from '../../src/render/VertexLighting.js'
import type { VertexLightSampler } from '../../src/render/VertexLighting.js'

class TestSampler implements VertexLightSampler {
	public readonly lights = new Map<string, LightSample>()
	public readonly opaque = new Set<string>()
	public readonly emissions = new Map<string, number>()

	public getLight(pos: [number, number, number]) {
		return this.lights.get(pos.join(',')) ?? { sky: 15, block: 0 }
	}

	public getOpacity(pos: [number, number, number]) {
		return this.opaque.has(pos.join(',')) ? 15 : 0
	}

	public getEmission(pos: [number, number, number]) {
		return this.emissions.get(pos.join(',')) ?? 0
	}
}

describe('smooth vertex lighting', () => {
	it('keeps an unoccluded face corner fully lit', () => {
		const sampler = new TestSampler()
		const light = sampleVertexLight(
			new Vector(2, 2, 2),
			new Vector(1, 1, 1),
			new Vector(0, 1, 0),
			sampler,
		)

		expect(light).toEqual([1, 0, 1])
	})

	it('averages sky and block light across the four corner samples', () => {
		const sampler = new TestSampler()
		sampler.lights.set('1,2,1', { sky: 15, block: 0 })
		sampler.lights.set('2,2,1', { sky: 10, block: 5 })
		sampler.lights.set('1,2,2', { sky: 5, block: 10 })
		sampler.lights.set('2,2,2', { sky: 0, block: 15 })

		const light = sampleVertexLight(
			new Vector(2, 2, 2),
			new Vector(1, 1, 1),
			new Vector(0, 1, 0),
			sampler,
		)

		expect(light[0]).toBe(0.5)
		expect(light[1]).toBe(0.5)
	})

	it('keeps a light-emitting block at its own emission level', () => {
		const sampler = new TestSampler()
		sampler.lights.set('1,2,1', { sky: 0, block: 14 })
		sampler.lights.set('2,2,1', { sky: 0, block: 13 })
		sampler.lights.set('1,2,2', { sky: 0, block: 13 })
		sampler.lights.set('2,2,2', { sky: 0, block: 12 })
		sampler.emissions.set('1,1,1', 15)

		const light = sampleVertexLight(
			new Vector(2, 2, 2),
			new Vector(1, 1, 1),
			new Vector(0, 1, 0),
			sampler,
		)

		expect(light[1]).toBe(1)
	})

	it('darkens corners according to neighboring opaque blocks', () => {
		const sampler = new TestSampler()
		sampler.opaque.add('2,2,1')
		sampler.opaque.add('2,2,2')
		sampler.lights.set('2,2,1', { sky: 0, block: 0 })
		sampler.lights.set('2,2,2', { sky: 0, block: 0 })

		const light = sampleVertexLight(
			new Vector(2, 2, 2),
			new Vector(1, 1, 1),
			new Vector(0, 1, 0),
			sampler,
		)

		expect(light[0]).toBe(1)
		expect(light[2]).toBe(0.6)
	})

	it('uses maximum corner occlusion when both side blocks are opaque', () => {
		const sampler = new TestSampler()
		sampler.opaque.add('2,2,1')
		sampler.opaque.add('1,2,2')
		sampler.lights.set('2,2,1', { sky: 0, block: 0 })
		sampler.lights.set('1,2,2', { sky: 0, block: 0 })

		const light = sampleVertexLight(
			new Vector(2, 2, 2),
			new Vector(1, 1, 1),
			new Vector(0, 1, 0),
			sampler,
		)

		expect(light[0]).toBe(1)
		expect(light[2]).toBe(0.5)
	})
})
