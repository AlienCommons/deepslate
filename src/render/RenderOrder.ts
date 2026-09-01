import type { mat4, vec3 } from 'gl-matrix'

function viewDepth(position: vec3, viewMatrix: mat4) {
	return viewMatrix[2] * position[0]
		+ viewMatrix[6] * position[1]
		+ viewMatrix[10] * position[2]
		+ viewMatrix[14]
}

export function sortBackToFront<T>(items: T[], getCenter: (item: T) => vec3, viewMatrix: mat4): T[] {
	return items
		.map((item, index) => ({ item, index, depth: viewDepth(getCenter(item), viewMatrix) }))
		.sort((a, b) => a.depth - b.depth || a.index - b.index)
		.map(entry => entry.item)
}
