# Deepslate for AlienCommons

A fork of [misode/deepslate](https://github.com/misode/deepslate) focused on accurate browser-based rendering of Minecraft structures and schematics.

This fork is being developed for the AlienCommons schematic previewer. It retains Deepslate's NBT, structure, world-generation, and rendering APIs while improving the rendering pipeline.

## Status

This fork is under active development and has not yet been published as a separate npm package. APIs and rendering behavior may change while the new renderer is being developed.

Rendering behavior is currently validated against Minecraft Java Edition 26.2, the latest stable release selected for this overhaul.

For the original stable package, see [misode/deepslate](https://github.com/misode/deepslate).

## Goals

- Render Minecraft structures and schematic projections directly in the browser.
- Improve water and lava geometry using neighboring fluid states.
- Render waterlogged blocks without overlapping surfaces or z-fighting.
- Separate opaque, cutout, and translucent rendering passes.
- Improve transparency ordering for water, glass, and other translucent blocks.
- Support animated fluid textures and directional flowing-water textures.
- Preserve the recognizable visual style of Minecraft.
- Remain suitable for large Minecraft builds.

## Non-goals

- Reimplementing the complete Minecraft client renderer.
- Biome-dependent water colors.
- Refraction, underwater post-processing, or other gameplay effects.
- Application-specific camera controls and user interface components.

Camera movement, keyboard controls, pointer lock, and preview UI belong to the consuming application rather than this rendering library.
