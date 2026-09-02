import type { vec3 } from 'gl-matrix'
import type { Vector } from '../math/index.js'
import type { LightSample } from './LightEngine.js'

export type BakedVertexLight = [sky: number, block: number, ambientOcclusion: number]

export interface VertexLightSampler {
	getLight(pos: vec3): LightSample
	getOpacity(pos: vec3): number
	getEmission?(pos: vec3): number
}

const AO_BRIGHTNESS = [1, 0.8, 0.6, 0.5] as const

/**
 * Samples the four cells touching a face corner, matching Minecraft's smooth
 * lighting layout. Values are normalized for direct use as a vertex attribute.
 */
export function sampleVertexLight(
	pos: Vector,
	blockPos: Vector,
	normal: Vector,
	sampler: VertexLightSampler,
): BakedVertexLight {
	const normalComponents = normal.components()
	const faceAxis = dominantAxis(normalComponents)
	const faceDirection = normalComponents[faceAxis] < 0 ? -1 : 1
	const sideAxes = ([0, 1, 2] as const).filter(axis => axis !== faceAxis)
	const block = blockPos.components()
	const vertex = pos.components()
	const sideDirections = sideAxes.map(axis => vertex[axis] < block[axis] + 0.5 ? -1 : 1)

	const face = [...block] as vec3
	face[faceAxis] += faceDirection
	const sideA = offset(face, sideAxes[0], sideDirections[0])
	const sideB = offset(face, sideAxes[1], sideDirections[1])
	const corner = offset(sideA, sideAxes[1], sideDirections[1])

	const sideAOA = sampler.getOpacity(sideA) >= 15
	const sideAOB = sampler.getOpacity(sideB) >= 15
	const cornerAO = sampler.getOpacity(corner) >= 15
	const samplePositions = [
		face,
		...(!sideAOA ? [sideA] : []),
		...(!sideAOB ? [sideB] : []),
		...(!cornerAO && !(sideAOA && sideAOB) ? [corner] : []),
	]
	const samples = samplePositions.map(samplePos => sampler.getLight(samplePos))
	const emission = sampler.getEmission?.(block) ?? 0
	const occlusion = sideAOA && sideAOB
		? 3
		: Number(sideAOA) + Number(sideAOB) + Number(cornerAO)

	return [
		average(samples.map(sample => sample.sky)) / 15,
		Math.max(emission, average(samples.map(sample => sample.block))) / 15,
		AO_BRIGHTNESS[occlusion],
	]
}

function dominantAxis(normal: vec3) {
	let axis = 0
	if (Math.abs(normal[1]) > Math.abs(normal[axis])) axis = 1
	if (Math.abs(normal[2]) > Math.abs(normal[axis])) axis = 2
	return axis
}

function offset(pos: vec3, axis: number, amount: number): vec3 {
	const result = [...pos] as vec3
	result[axis] += amount
	return result
}

function average(values: number[]) {
	return values.reduce((sum, value) => sum + value, 0) / values.length
}
