import { mat4 } from 'gl-matrix'
import type { Resources, TextureAnimation, TextureAnimationMetadata } from '../src/index.js'
import { BlockDefinition, BlockModel, EntityModelRegistry, getTextureAnimationTimeline, Identifier, NbtCompound, NbtString, Structure, StructureRenderer, TextureAtlas, upperPowerOfTwo } from '../src/index.js'
import { loadLitematicInWorker } from '../src/core/LitematicWorkerClient.js'
import LitematicWorker from '../src/core/LitematicWorker.ts?worker'
import { getSpectatorLook, getSpectatorMovement } from './SpectatorMovement.js'

const MINECRAFT_VERSION = '26.2'
const MCMETA = 'https://raw.githubusercontent.com/misode/mcmeta/'
const resourceUrl = (branch: string, path: string) => `${MCMETA}${MINECRAFT_VERSION}-${branch}/${path}`

class SpectatorControls {
	private readonly keys = new Set<string>()
	private readonly position: [number, number, number]
	private yaw = 0
	private pitch = 0.12
	private lastFrame = performance.now()

	constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly render: (view: mat4, elapsedMs: number) => void,
		start: [number, number, number],
	) {
		this.position = start
		canvas.addEventListener('click', () => canvas.requestPointerLock())
		document.addEventListener('mousemove', event => {
			if (document.pointerLockElement !== canvas) return
			const [yaw, pitch] = getSpectatorLook(this.yaw, this.pitch, event.movementX, event.movementY)
			this.yaw = yaw
			this.pitch = pitch
		})
		document.addEventListener('keydown', event => {
			this.keys.add(event.code)
			if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(event.code)) event.preventDefault()
		})
		document.addEventListener('keyup', event => this.keys.delete(event.code))
		document.addEventListener('pointerlockchange', () => {
			document.body.classList.toggle('is-playing', document.pointerLockElement === canvas)
		})
		requestAnimationFrame(time => this.frame(time))
	}

	public reset(position: [number, number, number]) {
		this.position.splice(0, 3, ...position)
		this.yaw = 0
		this.pitch = 0.12
	}

	private frame(time: number) {
		const delta = Math.min((time - this.lastFrame) / 1000, 0.05)
		this.lastFrame = time
		const speed = (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) ? 16 : 6
		const forward = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0)
		const right = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0)
		const vertical = (this.keys.has('Space') ? 1 : 0) - (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1 : 0)
		const movement = getSpectatorMovement(this.yaw, forward, right, vertical)
		this.position[0] += movement[0] * speed * delta
		this.position[1] += movement[1] * speed * delta
		this.position[2] += movement[2] * speed * delta

		const view = mat4.create()
		mat4.rotateX(view, view, this.pitch)
		mat4.rotateY(view, view, this.yaw)
		mat4.translate(view, view, [-this.position[0], -this.position[1], -this.position[2]])
		this.render(view, time)
		requestAnimationFrame(next => this.frame(next))
	}
}

function createValidationStructure() {
	const structure = new Structure([20, 9, 20])
	for (let x = 0; x < 20; x += 1) {
		for (let z = 0; z < 20; z += 1) structure.addBlock([x, 0, z], 'minecraft:stone')
	}

	for (let y = 1; y <= 3; y += 1) {
		for (let edge = 1; edge <= 7; edge += 1) {
			structure.addBlock([1, y, edge], 'minecraft:glass')
			structure.addBlock([7, y, edge], 'minecraft:glass')
			structure.addBlock([edge, y, 1], 'minecraft:glass')
			structure.addBlock([edge, y, 7], 'minecraft:glass')
		}
	}
	for (let x = 2; x <= 6; x += 1) {
		for (let z = 2; z <= 6; z += 1) {
			structure.addBlock([x, 1, z], 'minecraft:water', { level: '0' })
			structure.addBlock([x, 2, z], 'minecraft:water', { level: '0' })
		}
	}

	for (let x = 1; x <= 8; x += 1) {
		for (let z = 9; z <= 11; z += 1) structure.addBlock([x, 4, z], 'minecraft:smooth_stone')
		structure.addBlock([x, 5, 9], 'minecraft:glass')
		structure.addBlock([x, 5, 11], 'minecraft:glass')
		structure.addBlock([x, 5, 10], 'minecraft:water', { level: String(Math.min(7, x - 1)) })
	}
	structure.addBlock([0, 5, 10], 'minecraft:glass')

	// A roofed alcove makes skylight falloff, smooth corner lighting, ambient
	// occlusion, and local block light easy to inspect in one view.
	for (let x = 10; x <= 18; x += 1) {
		for (let z = 9; z <= 18; z += 1) structure.addBlock([x, 6, z], 'minecraft:stone')
		for (let y = 1; y <= 5; y += 1) structure.addBlock([x, y, 9], 'minecraft:stone')
	}
	for (let y = 1; y <= 5; y += 1) {
		for (let z = 9; z <= 18; z += 1) structure.addBlock([18, y, z], 'minecraft:stone')
	}
	structure.addBlock([13, 2, 16], 'minecraft:glowstone')

	structure.addBlock([11, 1, 3], 'minecraft:oak_fence', { north: 'false', east: 'false', south: 'false', west: 'false', waterlogged: 'true' })
	structure.addBlock([13, 1, 3], 'minecraft:oak_slab', { type: 'bottom', waterlogged: 'true' })
	structure.addBlock([15, 1, 3], 'minecraft:oak_slab', { type: 'top', waterlogged: 'true' })
	structure.addBlock([11, 1, 5], 'minecraft:oak_stairs', { facing: 'north', half: 'bottom', shape: 'straight', waterlogged: 'true' })
	structure.addBlock([13, 1, 5], 'minecraft:oak_stairs', { facing: 'east', half: 'bottom', shape: 'inner_left', waterlogged: 'true' })
	structure.addBlock([15, 1, 5], 'minecraft:oak_stairs', { facing: 'south', half: 'bottom', shape: 'outer_right', waterlogged: 'true' })
	structure.addBlock([11, 1, 7], 'minecraft:oak_trapdoor', { facing: 'north', half: 'bottom', open: 'false', powered: 'false', waterlogged: 'true' })
	structure.addBlock([13, 1, 7], 'minecraft:oak_trapdoor', { facing: 'north', half: 'bottom', open: 'true', powered: 'false', waterlogged: 'true' })

	for (let y = 1; y <= 5; y += 1) structure.addBlock([16, y, 14], 'minecraft:lava', { level: y === 5 ? '0' : '8' })
	for (let y = 1; y <= 5; y += 1) structure.addBlock([16, y, 13], 'minecraft:glass')
	structure.addBlock([15, 1, 15], 'minecraft:iron_block')
	structure.addBlock([16, 1, 15], 'minecraft:redstone_block')
	structure.addBlock([17, 1, 15], 'minecraft:observer', { facing: 'north', powered: 'false' })
	structure.addEntity([9.5, 1, 4.5], 'minecraft:armor_stand', new NbtCompound().set('id', new NbtString('minecraft:armor_stand')), [25, 0])
	structure.addEntity([5, 1, 15], 'minecraft:oak_boat', new NbtCompound().set('id', new NbtString('minecraft:oak_boat')), [-20, 0])
	return structure
}

function getPreviewPosition(structure: Structure): [number, number, number] {
	const [x, y, z] = structure.getSize()
	return [x / 2, Math.max(2, y / 2), z + Math.max(8, Math.max(x, y, z) * 0.9)]
}

function getAnimations(atlas: CanvasRenderingContext2D, uvMap: Record<string, [number, number, number, number]>): TextureAnimation[] {
	const metadata: Record<string, TextureAnimationMetadata> = {
		'block/water_still': { animation: { frametime: 2 } },
		'block/water_flow': { animation: {} },
		'block/lava_still': {
			animation: {
				frametime: 2,
				frames: [
					...Array.from({ length: 20 }, (_, index) => index),
					...Array.from({ length: 18 }, (_, index) => 18 - index),
				],
			},
		},
		'block/lava_flow': { animation: { frametime: 3 } },
	}
	return Object.entries(metadata).flatMap(([id, animationMetadata]) => {
		const [x, y, width, height] = uvMap[id] ?? []
		if (!width || height <= width) return []
		const timeline = getTextureAnimationTimeline(Math.floor(height / width), animationMetadata)
		const frames = timeline.map(step => ({
			image: atlas.getImageData(x, y + step.index * width, width, width),
			durationMs: step.durationMs,
		}))
		return [{ x, y, frames }]
	})
}

Promise.all([
	fetch(resourceUrl('summary', 'assets/block_definition/data.min.json')).then(response => response.json()),
	fetch(resourceUrl('summary', 'assets/model/data.min.json')).then(response => response.json()),
	fetch(resourceUrl('atlas', 'all/data.min.json')).then(response => response.json()),
	fetch(new URL('./entity-models.json', import.meta.url)).then(response => response.json()),
	new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image()
		image.onload = () => resolve(image)
		image.onerror = reject
		image.crossOrigin = 'anonymous'
		image.src = resourceUrl('atlas', 'all/atlas.png')
	}),
]).then(([blockstates, models, uvMap, entityModelData, atlasImage]) => {
	const blockDefinitions: Record<string, BlockDefinition> = {}
	Object.keys(blockstates).forEach(id => blockDefinitions[Identifier.create(id).toString()] = BlockDefinition.fromJson(blockstates[id]))
	const blockModels: Record<string, BlockModel> = {}
	Object.keys(models).forEach(id => blockModels[Identifier.create(id).toString()] = BlockModel.fromJson(models[id]))
	Object.values(blockModels).forEach(model => model.flatten({ getBlockModel: id => blockModels[id.toString()] }))

	const atlasSize = upperPowerOfTwo(Math.max(atlasImage.width, atlasImage.height))
	const atlasCanvas = document.createElement('canvas')
	atlasCanvas.width = atlasSize
	atlasCanvas.height = atlasSize
	const atlasContext = atlasCanvas.getContext('2d')!
	atlasContext.drawImage(atlasImage, 0, 0)
	const idMap: Record<string, [number, number, number, number]> = {}
	Object.keys(uvMap).forEach(id => {
		const [u, v, width, height] = uvMap[id]
		const visibleHeight = width !== height && id.startsWith('block/') ? width : height
		idMap[Identifier.create(id).toString()] = [u / atlasSize, v / atlasSize, (u + width) / atlasSize, (v + visibleHeight) / atlasSize]
	})
	const animations = getAnimations(atlasContext, uvMap)
	const textureAtlas = new TextureAtlas(atlasContext.getImageData(0, 0, atlasSize, atlasSize), idMap, animations)
	const entityTextures = Object.fromEntries(Object.entries<[number, number, number, number]>(uvMap)
		.filter(([id]) => id.startsWith('entity/'))
		.map(([id, [, , width, height]]) => [`minecraft:${id}`, { width, height }]))
	const entityModels = new EntityModelRegistry(entityModelData, entityTextures)

	const fullBlocks = new Set(['stone', 'smooth_stone', 'iron_block', 'redstone_block', 'observer', 'glowstone'])
	const resources: Resources = {
		getBlockDefinition: id => blockDefinitions[id.toString()],
		getBlockModel: id => blockModels[id.toString()],
		getTextureUV: id => textureAtlas.getTextureUV(id),
		getTextureAtlas: () => textureAtlas.getTextureAtlas(),
		getTextureAnimations: () => textureAtlas.getTextureAnimations(),
		getPixelSize: () => textureAtlas.getPixelSize(),
		getEntityModel: (id, nbt) => entityModels.getEntityModel(id, nbt),
		getBlockFlags(id) {
			const name = id.path
			if (name === 'glass') return { opaque: false, solid: true, self_culling: true, render_layer: 'translucent' }
			if (name === 'lava') return { opaque: false, render_layer: 'emissive' }
			if (name === 'water') return { opaque: false, light_opacity: 1, self_culling: true, render_layer: 'translucent' }
			if (name === 'glowstone') return { opaque: true }
			return { opaque: fullBlocks.has(name), render_layer: name.includes('leaves') ? 'cutout' : 'opaque' }
		},
		getBlockProperties: () => null,
		getDefaultBlockProperties: () => null,
	}

	const canvas = document.getElementById('preview') as HTMLCanvasElement
	const gl = canvas.getContext('webgl', { alpha: false, antialias: true })!
	const renderer = new StructureRenderer(gl, createValidationStructure(), resources, { chunkSize: 4, useInvisibleBlockBuffer: false })
	gl.clearColor(0.48, 0.68, 0.92, 1)
	const resize = () => {
		const ratio = Math.min(devicePixelRatio, 2)
		const width = Math.floor(canvas.clientWidth * ratio)
		const height = Math.floor(canvas.clientHeight * ratio)
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width
			canvas.height = height
			renderer.setViewport(0, 0, width, height)
		}
	}
	new ResizeObserver(resize).observe(canvas)
	resize()
	const controls = new SpectatorControls(canvas, (view, elapsedMs) => {
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
		renderer.drawStructure(view, elapsedMs)
	}, [10, 5, 25])

	const fileInput = document.getElementById('litematic-file') as HTMLInputElement
	const entityToggle = document.getElementById('render-entities') as HTMLInputElement
	const fileStatus = document.getElementById('file-status')!
	fileInput.disabled = false
	entityToggle.disabled = false
	entityToggle.addEventListener('change', () => renderer.setEntityRenderingEnabled(entityToggle.checked))
	fileStatus.textContent = 'Using the built-in rendering validation scene.'
	fileInput.addEventListener('change', async () => {
		const file = fileInput.files?.[0]
		if (!file) return
		fileStatus.textContent = `Opening ${file.name}…`
		try {
			const structure = await loadLitematicInWorker(
				() => new LitematicWorker(),
				new Uint8Array(await file.arrayBuffer()),
			)
			renderer.setStructure(structure)
			controls.reset(getPreviewPosition(structure))
			const [x, y, z] = structure.getSize()
			const entityCount = structure.getEntities().length
			fileStatus.textContent = `${file.name} · ${x} × ${y} × ${z} · ${structure.getBlocks().length.toLocaleString()} blocks · ${entityCount.toLocaleString()} entities`
		} catch (error) {
			console.error(error)
			fileStatus.textContent = error instanceof Error ? error.message : `Could not open ${file.name}.`
		} finally {
			fileInput.value = ''
		}
	})
}).catch(error => {
	console.error(error)
	document.getElementById('status')!.textContent = `Failed to load Minecraft ${MINECRAFT_VERSION} resources.`
	document.getElementById('file-status')!.textContent = 'The file picker is unavailable until resources load.'
})
