# Deepslate for AlienCommons

A fork of [misode/deepslate](https://github.com/misode/deepslate) focused on accurate browser-based rendering of Minecraft structures and schematics.

This fork is being developed for the AlienCommons schematic previewer. It retains Deepslate's NBT, structure, world-generation, and rendering APIs while improving the rendering pipeline.

## Status

This fork is under active development and has not yet been published as a separate npm package. The first rendering overhaul is implemented, including explicit render layers, neighbor-aware fluid geometry, clipped waterlogged volumes, animated fluid textures, emissive rendering, view-dependent transparent quad sorting, propagated sky and block light, smooth vertex lighting, and ambient occlusion. APIs may still change before the first release.

Rendering behavior is validated against Minecraft Java Edition 26.2, the latest stable release selected for this overhaul. See [Rendering validation](docs/rendering-validation.md) for the comparison scope, results, and known differences.

For the original stable package, see [misode/deepslate](https://github.com/misode/deepslate).

## Goals

- Render Minecraft structures and schematic projections directly in the browser.
- Improve water and lava geometry using neighboring fluid states.
- Render waterlogged blocks without overlapping surfaces or z-fighting.
- Separate opaque, cutout, and translucent rendering passes.
- Improve transparency ordering for water, glass, and other translucent blocks.
- Support animated fluid textures and directional flowing-water textures.
- Bake Minecraft-style sky light and local block light into structure meshes.
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
