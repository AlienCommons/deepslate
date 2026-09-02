import type { Identifier } from '../core/index.js'
import { isPowerOfTwo, upperPowerOfTwo } from '../math/index.js'

export type UV = [number, number, number, number]

export type TextureAnimationMetadata = {
	animation?: {
		frametime?: number,
		frames?: (number | { index: number, time?: number })[],
		interpolate?: boolean,
	},
}

export type TextureAnimationFrame = {
	image: ImageData,
	mipmaps?: ImageData[],
	durationMs: number,
}

export type TextureAnimation = {
	x: number,
	y: number,
	frames: TextureAnimationFrame[],
}

export type TextureAnimationStep = {
	index: number,
	durationMs: number,
}

export function getTextureAnimationTimeline(frameCount: number, metadata: TextureAnimationMetadata = {}): TextureAnimationStep[] {
	const animation = metadata.animation
	const defaultTime = animation?.frametime ?? 1
	const sequence = animation?.frames ?? Array.from({ length: frameCount }, (_, frame) => frame)
	return sequence.map(entry => ({
		index: typeof entry === 'number' ? entry : entry.index,
		durationMs: (typeof entry === 'number' ? defaultTime : entry.time ?? defaultTime) * 50,
	}))
}

export function getTextureAnimationFrame(animation: TextureAnimation, elapsedMs: number) {
	const duration = animation.frames.reduce((total, frame) => total + frame.durationMs, 0)
	if (duration <= 0) return 0
	let time = ((elapsedMs % duration) + duration) % duration
	for (let index = 0; index < animation.frames.length; index += 1) {
		time -= animation.frames[index].durationMs
		if (time < 0) return index
	}
	return animation.frames.length - 1
}

export function createTextureMipmaps(image: ImageData): ImageData[] {
	const mipmaps: ImageData[] = []
	const ImageDataConstructor = image.constructor as { new(data: Uint8ClampedArray, width: number, height: number): ImageData }
	let source = image
	while (source.width > 1 || source.height > 1) {
		const width = Math.max(1, Math.floor(source.width / 2))
		const height = Math.max(1, Math.floor(source.height / 2))
		const data = new Uint8ClampedArray(width * height * 4)
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				const samples = [
					[x * 2, y * 2],
					[Math.min(x * 2 + 1, source.width - 1), y * 2],
					[x * 2, Math.min(y * 2 + 1, source.height - 1)],
					[Math.min(x * 2 + 1, source.width - 1), Math.min(y * 2 + 1, source.height - 1)],
				]
				for (let channel = 0; channel < 4; channel += 1) {
					const total = samples.reduce((sum, [sx, sy]) => sum + source.data[(sy * source.width + sx) * 4 + channel], 0)
					data[(y * width + x) * 4 + channel] = Math.round(total / samples.length)
				}
			}
		}
		source = new ImageDataConstructor(data, width, height)
		mipmaps.push(source)
	}
	return mipmaps
}

export interface TextureAtlasProvider {
	getTextureAtlas(): ImageData
	getTextureUV(texture: Identifier): UV
	getTextureAnimations?(): TextureAnimation[]
	getPixelSize?(): number;
}

export class TextureAtlas implements TextureAtlasProvider {
	private readonly part: number

	constructor(
		private readonly img: ImageData,
		private readonly idMap: Record<string, UV>,
		private readonly animations: TextureAnimation[] = [],
	) {
		if (!isPowerOfTwo(img.width) || !isPowerOfTwo(img.height)) {
			throw new Error(`Expected texture atlas dimensions to be powers of two, got ${img.width}x${img.height}.`)
		}
		this.part = 16 / img.width
	}

	public getTextureAtlas() {
		return this.img
	}

	public getTextureUV(id: Identifier) {
		return this.idMap[id.toString()] ?? [0, 0, this.part, this.part]
	}

	public getPixelSize() {
		return this.part / 16
	}

	public getTextureAnimations() {
		return this.animations
	}

	public static async fromBlobs(textures: { [id: string]: Blob }, metadata: Record<string, TextureAnimationMetadata> = {}): Promise<TextureAtlas> {
		const initialWidth = Math.sqrt(Object.keys(textures).length + 1)
		const width = upperPowerOfTwo(initialWidth)
		const pixelWidth = width * 16
		const part = 1 / width

		const canvas = document.createElement('canvas')
		canvas.width = pixelWidth
		canvas.height = pixelWidth
		const ctx = canvas.getContext('2d')!
		this.drawInvalidTexture(ctx)

		const idMap: Record<string, UV> = {}
		const animations: TextureAnimation[] = []
		let index = 1
		await Promise.all(Object.keys(textures).map(async (id) => {
			const u = (index % width)
			const v = Math.floor(index / width)
			index += 1
			idMap[id] = [part * u, part * v, part * u + part, part * v + part]
			const img = await createImageBitmap(textures[id])
			const frameSize = img.width
			const frameCount = img.height >= frameSize && img.height % frameSize === 0 ? img.height / frameSize : 1
			ctx.drawImage(img, 0, 0, img.width, frameSize, 16 * u, 16 * v, 16, 16)

			if (frameCount > 1) {
				const frameCanvas = document.createElement('canvas')
				frameCanvas.width = 16
				frameCanvas.height = 16
				const frameContext = frameCanvas.getContext('2d')!
				const frames = getTextureAnimationTimeline(frameCount, metadata[id]).map(step => {
					frameContext.clearRect(0, 0, 16, 16)
					frameContext.drawImage(img, 0, step.index * frameSize, img.width, frameSize, 0, 0, 16, 16)
					const image = frameContext.getImageData(0, 0, 16, 16)
					return { image, mipmaps: createTextureMipmaps(image), durationMs: step.durationMs }
				})
				animations.push({ x: 16 * u, y: 16 * v, frames })
			}
		}))

		return new TextureAtlas(ctx.getImageData(0, 0, pixelWidth, pixelWidth), idMap, animations)
	}

	public static empty() {
		const canvas = document.createElement('canvas')
		canvas.width = 16
		canvas.height = 16
		const ctx = canvas.getContext('2d')!
		TextureAtlas.drawInvalidTexture(ctx)
		return new TextureAtlas(ctx.getImageData(0, 0, 16, 16), {})
	}

	private static drawInvalidTexture(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = 'black'
		ctx.fillRect(0, 0, 16, 16)
		ctx.fillStyle = 'magenta'
		ctx.fillRect(0, 0, 8, 8)
		ctx.fillRect(8, 8, 8, 8)
	}
}
