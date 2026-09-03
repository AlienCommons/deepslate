import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

function fixture(t) {
	const directory = realpathSync(mkdtempSync(join(tmpdir(), 'deepslate-package-')))
	t.after(() => rmSync(directory, { recursive: true, force: true }))
	return directory
}

function seed(directory, path, content = 'obsolete build output') {
	const target = join(directory, path)
	mkdirSync(dirname(target), { recursive: true })
	writeFileSync(target, content)
}

function runNpm(directory, ...args) {
	assert.ok(process.env.npm_execpath, 'Run these checks with npm run test:package')
	return execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
		cwd: directory,
		encoding: 'utf8',
		timeout: 60_000,
		maxBuffer: 8 * 1024 * 1024,
	})
}

function packedFiles(directory, ...args) {
	const [result] = JSON.parse(runNpm(directory, 'pack', '--json', '--foreground-scripts=false', ...args))
	return { ...result, paths: new Set(result.files.map(file => file.path)) }
}

test('clean removes only generated outputs, independently of cwd, and is repeatable', t => {
	const directory = fixture(t)
	mkdirSync(join(directory, 'scripts'))
	cpSync(join(root, 'scripts/clean.mjs'), join(directory, 'scripts/clean.mjs'))
	for (const path of ['lib/old.js', 'lib/tsconfig.tsbuildinfo', 'dist/demo/old.js', 'src/keep.ts', 'demo/keep.json']) {
		seed(directory, path)
	}
	for (let i = 0; i < 2; i += 1) {
		execFileSync(process.execPath, [join(directory, 'scripts/clean.mjs')], { cwd: tmpdir() })
		assert.equal(existsSync(join(directory, 'lib')), false)
		assert.equal(existsSync(join(directory, 'dist')), false)
		assert.equal(readFileSync(join(directory, 'src/keep.ts'), 'utf8'), 'obsolete build output')
		assert.equal(readFileSync(join(directory, 'demo/keep.json'), 'utf8'), 'obsolete build output')
	}
})

test('pack rebuilds stale output, excludes demo, and ships usable library and worker exports', async t => {
	const directory = fixture(t)
	for (const path of ['package.json', 'README.md', 'LICENSE', 'tsconfig-base.json', 'vite.config.ts', 'src', 'demo']) {
		cpSync(join(root, path), join(directory, path), { recursive: true })
	}
	mkdirSync(join(directory, 'scripts'))
	cpSync(join(root, 'scripts/clean.mjs'), join(directory, 'scripts/clean.mjs'))
	symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction')
	const stalePaths = [
		'lib/worldgen/index.js', 'lib/core/Chunk.d.ts', 'lib/nbt/NbtRegion.js',
		'lib/math/noise/index.js', 'lib/math/random/index.js', 'lib/math/CubicSpline.d.ts',
		'lib/obsolete.js', 'lib/tsconfig.tsbuildinfo', 'dist/obsolete.js', 'dist/demo/obsolete.js',
	]
	for (const path of stalePaths) seed(directory, path)
	const packed = packedFiles(directory)
	for (const path of stalePaths.filter(path => !path.endsWith('.tsbuildinfo'))) {
		assert.equal(existsSync(join(directory, path)), false, `Build must remove ${path}`)
	}

	// Enumerate all expected compiler output, not just the public entry files.
	const expected = new Set(['package.json', 'README.md', 'LICENSE', 'dist/deepslate.umd.cjs'])
	for (const path of readdirSync(join(directory, 'src'), { recursive: true })) {
		if (!path.endsWith('.ts')) continue
		const stem = path.slice(0, -3).replaceAll('\\', '/')
		for (const extension of ['.js', '.js.map', '.d.ts', '.d.ts.map']) expected.add(`lib/${stem}${extension}`)
	}
	assert.deepEqual(packed.paths, expected)

	// A demo-only rebuild must clear old demo assets while preserving the library.
	const bundle = readFileSync(join(directory, 'dist/deepslate.umd.cjs'))
	runNpm(directory, 'run', 'build:demo')
	seed(directory, 'dist/demo/assets/obsolete.js')
	runNpm(directory, 'run', 'build:demo')
	assert.equal(existsSync(join(directory, 'dist/demo/assets/obsolete.js')), false)
	assert.ok(existsSync(join(directory, 'dist/demo/index.html')))
	assert.deepEqual(readFileSync(join(directory, 'dist/deepslate.umd.cjs')), bundle)
	const withDemo = packedFiles(directory, '--dry-run', '--ignore-scripts')
	assert.deepEqual(withDemo.paths, expected, 'Demo must be excluded even without a clean rebuild')

	// Inspect and import the actual archive rather than the working tree's lib/.
	const extracted = join(directory, 'unpacked')
	mkdirSync(extracted)
	execFileSync('tar', ['-xzf', join(directory, packed.filename), '-C', extracted])
	const packageRoot = join(extracted, 'package')
	const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
	const requirePackage = createRequire(join(packageRoot, 'package.json'))
	for (const [subpath, entry] of Object.entries(manifest.exports)) {
		const specifier = subpath === '.' ? manifest.name : `${manifest.name}/${subpath.slice(2)}`
		const target = typeof entry === 'string' ? entry : entry.default
		assert.equal(requirePackage.resolve(specifier), join(packageRoot, target))
		if (typeof entry !== 'string') {
			assert.ok(existsSync(join(packageRoot, entry.types)))
			await import(pathToFileURL(requirePackage.resolve(specifier)).href)
		}
	}
	assert.ok(packed.paths.has(relative(packageRoot, requirePackage.resolve(`${manifest.name}/core/LitematicWorker.js`)).replaceAll('\\', '/')))
	const api = await import(pathToFileURL(requirePackage.resolve(manifest.name)).href)
	const umd = requirePackage(join(packageRoot, manifest.unpkg))
	for (const name of ['Structure', 'NbtFile', 'StructureRenderer', 'EntityModelRegistry', 'loadLitematicInWorker']) {
		assert.equal(typeof api[name], 'function', `Missing ESM export ${name}`)
		assert.equal(typeof umd[name], 'function', `Missing UMD export ${name}`)
	}
	for (const name of ['CubicSpline', 'LegacyRandom', 'XoroshiroRandom', 'NbtRegion', 'NbtChunk', 'Chunk']) {
		assert.equal(name in api, false, `Removed export leaked into package: ${name}`)
		assert.equal(name in umd, false)
	}
	const { NbtCompound, NbtInt, NbtString, NbtList, NbtLongArray, NbtFile, Structure } = api
	const vector = value => new NbtCompound().set('x', new NbtInt(value)).set('y', new NbtInt(value)).set('z', new NbtInt(value))
	const region = new NbtCompound()
		.set('Position', vector(0))
		.set('Size', vector(1))
		.set('BlockStatePalette', new NbtList([new NbtCompound().set('Name', new NbtString('minecraft:stone'))]))
		.set('BlockStates', new NbtLongArray([0n]))
	const file = NbtFile.create({ compression: 'gzip' })
	file.root.set('Version', new NbtInt(6)).set('Regions', new NbtCompound().set('Main', region))
	const structure = Structure.fromLitematic(file.write())
	assert.deepEqual(structure.getSize(), [1, 1, 1])
	assert.equal(structure.getBlock([0, 0, 0]).state.toString(), 'minecraft:stone')
	t.diagnostic(`Verified ${packed.paths.size} package files; archive size ${packed.size} bytes`)
})
