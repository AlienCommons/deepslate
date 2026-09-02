import type { StructureSnapshot } from './StructureSnapshot.js'
import { structureFromSnapshot } from './StructureSnapshot.js'

export type LitematicWorkerRequest = { data: ArrayBuffer }
export type LitematicWorkerResponse =
	| { snapshot: StructureSnapshot }
	| { error: string }

export interface LitematicWorkerOptions {
	signal?: AbortSignal
}

/** Parses a Litematic in an owned, one-shot worker and terminates it afterwards. */
export function loadLitematicInWorker(
	createWorker: () => Worker,
	data: Uint8Array,
	options: LitematicWorkerOptions = {},
) {
	return new Promise<ReturnType<typeof structureFromSnapshot>>((resolve, reject) => {
		if (options.signal?.aborted) {
			reject(options.signal.reason ?? new DOMException('The operation was aborted', 'AbortError'))
			return
		}

		const worker = createWorker()
		const cleanup = () => {
			options.signal?.removeEventListener('abort', abort)
			worker.terminate()
		}
		const abort = () => {
			cleanup()
			reject(options.signal?.reason ?? new DOMException('The operation was aborted', 'AbortError'))
		}
		worker.onmessage = event => {
			cleanup()
			const response = event.data as LitematicWorkerResponse
			if ('error' in response) reject(new Error(response.error))
			else resolve(structureFromSnapshot(response.snapshot))
		}
		worker.onerror = event => {
			cleanup()
			reject(new Error(event.message || 'Litematic worker failed'))
		}
		options.signal?.addEventListener('abort', abort, { once: true })

		const copy = data.slice()
		const request: LitematicWorkerRequest = { data: copy.buffer }
		worker.postMessage(request, [copy.buffer])
	})
}
