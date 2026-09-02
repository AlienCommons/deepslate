import { Structure } from './Structure.js'
import type { LitematicWorkerRequest, LitematicWorkerResponse } from './LitematicWorkerClient.js'
import { createStructureSnapshot } from './StructureSnapshot.js'

interface WorkerScope {
	onmessage: ((event: MessageEvent) => void) | null
	postMessage(message: LitematicWorkerResponse): void
}

const workerScope = self as unknown as WorkerScope

workerScope.onmessage = event => {
	try {
		const request = event.data as LitematicWorkerRequest
		const structure = Structure.fromLitematic(new Uint8Array(request.data))
		const response: LitematicWorkerResponse = { snapshot: createStructureSnapshot(structure) }
		workerScope.postMessage(response)
	} catch (error) {
		const response: LitematicWorkerResponse = {
			error: error instanceof Error ? error.message : 'Could not parse Litematic file',
		}
		workerScope.postMessage(response)
	}
}
