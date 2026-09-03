import { describe, expect, it } from 'vitest'
import { Rotation, Structure } from '../../src/core/index.js'
import { clamp, isPowerOfTwo, Matrix3, Matrix4, upperPowerOfTwo, Vector } from '../../src/math/index.js'

describe('retained rendering math', () => {
	it('clamps item and block color values', () => {
		expect(clamp(-1, 0, 1)).toBe(0)
		expect(clamp(0.5, 0, 1)).toBe(0.5)
		expect(clamp(2, 0, 1)).toBe(1)
	})

	it('sizes texture atlases to powers of two', () => {
		for (const size of [1, 16, 256, 1024, 4096]) {
			expect(isPowerOfTwo(size)).toBe(true)
			expect(upperPowerOfTwo(size)).toBe(size)
		}
		expect(isPowerOfTwo(300)).toBe(false)
		expect(upperPowerOfTwo(300)).toBe(512)
	})

	it('retains vector and matrix transformations', () => {
		const position = new Vector(2, 3, 4)
		const matrix = new Matrix4().translate(position)
		expect(matrix.getTranslation().components()).toEqual(position.components())
		expect(Matrix3.fromMatrix4(matrix).m00).toBe(1)
		expect(position.add(new Vector(1, 0, -1)).components()).toEqual([3, 3, 3])
	})

	it('retains deterministic structure rotation without random generators', () => {
		expect(Structure.transform([1, 2, 3], Rotation.NONE, [0, 0, 0])).toEqual([1, 2, 3])
		expect(Structure.transform([1, 2, 3], Rotation.CLOCKWISE_90, [0, 0, 0])).toEqual([-3, 2, 1])
		expect(Structure.transform([1, 2, 3], Rotation.CLOCKWISE_180, [0, 0, 0])).toEqual([-1, 2, -3])
		expect(Structure.transform([1, 2, 3], Rotation.COUNTERCLOCKWISE_90, [0, 0, 0])).toEqual([3, 2, -1])
	})
})
