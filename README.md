# Deepslate for AlienCommons

A fork of [misode/deepslate](https://github.com/misode/deepslate) focused on accurate browser-based rendering of Minecraft structures and schematics.

This fork is being developed for the AlienCommons schematic previewer. It retains Deepslate's NBT, structure, and rendering APIs while improving the rendering pipeline.

## Status

This fork is under active development and has not yet been published as a separate npm package. The first rendering overhaul is implemented, including explicit render layers, neighbor-aware fluid geometry, clipped waterlogged volumes, Minecraft-aligned water and lava animation, emissive rendering, state-dependent block emission, view-dependent transparent quad sorting, propagated sky and block light, smooth vertex lighting, and ambient occlusion. APIs may still change before the first release.

Rendering behavior targets Minecraft Java Edition 26.2. See [Rendering validation](docs/rendering-validation.md) for the comparison scope, results, and known differences.

For the original stable package, see [misode/deepslate](https://github.com/misode/deepslate).

## Litematic files

Deepslate can read gzip-compressed `.litematic` files directly into a renderable `Structure`:

```ts
import { Structure } from 'deepslate'

const bytes = new Uint8Array(await file.arrayBuffer())
const structure = Structure.fromLitematic(bytes)
```

The loader supports multiple regions, regions that extend along negative axes, tightly packed block-state palettes, block entity NBT, and static entities. The resulting structure is normalized to start at `[0, 0, 0]`. Scheduled block ticks are not currently included.

The demo includes an **Open .litematic** picker and an **Entities** switch for testing local files entirely in the browser. It parses files in a Web Worker and builds render chunks cooperatively, so large schematics do not monopolize the browser's main thread.

Bundled applications can use the one-shot worker client with their bundler's worker constructor:

```ts
import { loadLitematicInWorker } from 'deepslate/core'
import LitematicWorker from 'deepslate/core/LitematicWorker.js?worker'

const structure = await loadLitematicInWorker(
	() => new LitematicWorker(),
	new Uint8Array(await file.arrayBuffer()),
)
await renderer.setStructureAsync(structure)
```

`loadLitematicInWorker` and `setStructureAsync` both support cancellation. The synchronous APIs remain available for server-side use and small inputs.

## Static entities

`Structure` can store entities with floating-point positions, rotation, and NBT. `StructureRenderer` draws them when its resources provide `getEntityModel`, and entity drawing can be changed at runtime:

```ts
renderer.setEntityRenderingEnabled(false)
renderer.setEntityRenderingEnabled(true)
```

The renderer accepts data-driven bone and cuboid models, so applications can register vanilla or modded entities without changing the WebGL pipeline. Static entities sample the structure's sky and block light and participate in the appropriate cutout or translucent render pass. The demo includes static model forms for vanilla living entities, dedicated boat and minecart geometry, and a textured fallback for every other entity ID. Animations, equipment, passengers, nameplates, fire overlays, and other dynamic gameplay layers are intentionally outside the current static-preview scope.

## Goals

- Render Minecraft structures and schematic projections directly in the browser.
- Improve water and lava geometry using neighboring fluid states.
- Render waterlogged blocks without overlapping surfaces or z-fighting.
- Separate opaque, cutout, and translucent rendering passes.
- Improve global transparency ordering for water, glass, translucent entities, and other translucent geometry.
- Match Minecraft's water and lava animation timing, downward side flow, and directional top-surface textures.
- Bake Minecraft-style sky light and local block light into structure meshes.
- Match Minecraft 26.2 light levels for constant and state-dependent emitting blocks.
- Smooth light and ambient occlusion across block-face corners.
- Preserve the recognizable visual style of Minecraft.
- Remain suitable for large Minecraft builds.

## Non-goals

- Reimplementing the complete Minecraft client renderer.
- Dynamic shadows, colored lights, and path-traced global illumination.
- Biome-dependent water colors.
- Refraction, underwater post-processing, or other gameplay effects.
- Application-specific camera controls and user interface components.

Camera movement, keyboard controls, pointer lock, and preview UI belong to the consuming application rather than this rendering library.
