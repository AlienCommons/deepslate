import { describe, expect, it, vi } from 'vitest'
import { Structure } from '../../src/core/Structure.js'
import { loadLitematicInWorker } from '../../src/core/LitematicWorkerClient.js'
import { createStructureSnapshot } from '../../src/core/StructureSnapshot.js'

describe('Litematic worker client', () => {
	it('transfers an owned byte copy and restores the structure snapshot', async () => {
		const source = new Uint8Array([1, 2, 3])
		const snapshot = createStructureSnapshot(new Structure([1, 1, 1]).addBlock([0, 0, 0], 'stone'))
		const terminate = vi.fn()
		const worker = {
			onmessage: null as ((event: MessageEvent) => void) | null,
			onerror: null as ((event: ErrorEvent) => void) | null,
			terminate,
			postMessage(request: { data: ArrayBuffer }, transfer: Transferable[]) {
				expect(new Uint8Array(request.data)).toEqual(source)
				expect(transfer).toEqual([request.data])
				queueMicrotask(() => this.onmessage?.({ data: { snapshot } } as MessageEvent))
			},
		} as unknown as Worker

		const structure = await loadLitematicInWorker(() => worker, source)

		expect(source).toEqual(new Uint8Array([1, 2, 3]))
		expect(structure.getBlock([0, 0, 0])?.state.toString()).toBe('minecraft:stone')
		expect(terminate).toHaveBeenCalledOnce()
	})

	it('does not create a worker when already aborted', async () => {
		const createWorker = vi.fn()
		const controller = new AbortController()
		controller.abort(new Error('cancelled'))

		await expect(loadLitematicInWorker(createWorker, new Uint8Array(), { signal: controller.signal })).rejects.toThrow('cancelled')
		expect(createWorker).not.toHaveBeenCalled()
	})
})
