import { rmSync } from 'node:fs'

// Only remove generated output, resolved relative to this script rather than cwd.
// Removing the whole lib directory also discards stale TypeScript build metadata.
for (const directory of ['../lib/', '../dist/']) {
	rmSync(new URL(directory, import.meta.url), { recursive: true, force: true })
}
