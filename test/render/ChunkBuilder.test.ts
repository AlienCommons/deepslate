import { describe, expect, it, vi } from 'vitest'
import { Structure } from '../../src/core/index.js'
import { ChunkBuilder } from '../../src/render/ChunkBuilder.js'
import type { Resources } from '../../src/render/StructureRenderer.js'

function mockGl() {
	return {
		ARRAY_BUFFER: 0x8892,
		ELEMENT_ARRAY_BUFFER: 0x8893,
		DYNAMIC_DRAW: 0x88e8,
		UNSIGNED_SHORT: 0x1403,
		UNSIGNED_INT: 0x1405,
		createBuffer: () => ({}),
		deleteBuffer: () => undefined,
		bindBuffer: () => undefined,
		bufferData: () => undefined,
	} as unknown as WebGLRenderingContext
}

const resources = {
	getBlockDefinition: () => null,
	getBlockModel: () => null,
	getTextureUV: () => [0, 0, 1, 1],
	getBlockFlags: () => ({ opaque: true }),
	getBlockProperties: () => null,
	getDefaultBlockProperties: () => null,
} as unknown as Resources

describe('ChunkBuilder', () => {
	it('cooperatively yields between chunk batches', async () => {
		const structure = new Structure([4, 1, 1])
			.addBlock([0, 0, 0], 'stone')
			.addBlock([2, 0, 0], 'stone')
		const builder = new ChunkBuilder(mockGl(), structure, resources, 2)
		const yieldTask = vi.fn(async () => undefined)

		await builder.updateStructureBuffersAsync({ chunksPerYield: 1, yieldTask })

		expect(yieldTask).toHaveBeenCalledOnce()
	})

	it('honors cancellation before rebuilding', async () => {
		const builder = new ChunkBuilder(mockGl(), new Structure([1, 1, 1]), resources)
		const controller = new AbortController()
		controller.abort(new Error('cancelled'))

		await expect(builder.updateStructureBuffersAsync({ signal: controller.signal })).rejects.toThrow('cancelled')
	})
})
