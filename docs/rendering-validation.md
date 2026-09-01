# Rendering validation

The rendering overhaul is validated against an unmodified Minecraft Java Edition 26.2 client. The goal is a recognizable and useful structure preview, not a pixel-identical replacement for Minecraft's complete renderer.

## Reference scene

The manual reference scene uses a fixed daytime camera and contains:

- a sealed glass tank filled with source water;
- exposed bottom and top slabs, stairs, an open trapdoor, and a fence with `waterlogged=true`;
- a contained lava column behind glass;
- opaque, cutout, emissive, and translucent blocks viewed together.

The same categories are present in the demo validation scene. The demo uses Minecraft 26.2 block models, textures, and animation metadata.

## Results

| Area | Minecraft 26.2 reference | Deepslate result |
| --- | --- | --- |
| Water surface | Source blocks sit below the full-block ceiling; flowing edges use different corner heights. | Neighboring fluid states determine exposed faces and averaged corner heights. Internal faces between compatible fluids are culled. |
| Flow direction | Flowing water rotates its surface texture with the direction of travel. | Flow vectors rotate the flowing-water UVs; still surfaces use the still-water texture. |
| Glass and water | Glass remains readable in front of water without writing transparent fragments into the depth buffer. | Translucent chunks are rendered back-to-front with depth writes disabled, preserving the glass/water relationship. |
| Waterlogged blocks | Water occupies only the unfilled portion of slabs, stairs, and trapdoors. | Slabs, stairs, and trapdoors use shape-aware clipped fluid volumes. Other waterlogged shapes retain a conservative approximation. |
| Lava and light-emitting blocks | Lava textures animate and remain visually bright. | Texture animation metadata updates the atlas at runtime, and emissive geometry bypasses directional darkening. |
| Cutout blocks | Transparent texels are discarded rather than blended. | Cutout geometry uses alpha testing in its own render pass. |

The comparison confirmed that the overhaul fixes the original failure modes targeted by this fork: flat full-block liquids, internal fluid faces, water overlapping partial blocks, unstable glass/water depth ordering, static fluid textures, and dim lava.

## Automated coverage

The test suite covers:

- render-layer classification and state ordering;
- neighbor-aware fluid faces, corner heights, and flow UVs;
- waterlogged slab, stair, and trapdoor clipping;
- animated texture metadata and frame selection;
- transparent sorting and renderer state transitions;
- a dense 16 x 16 x 16 fluid-section performance benchmark.

The demo is also built in CI so resource or integration regressions fail the workflow.

## Deliberate differences

The following remain outside this renderer's current accuracy target:

- biome-dependent water tint;
- Minecraft's complete light engine, ambient occlusion, shadows, fog, and post-processing;
- exact per-quad ordering between intersecting translucent surfaces inside one chunk;
- exact water clipping for every possible waterlogged block model;
- byte-for-byte reproduction of Minecraft's internal flowing-fluid UV calculation.

These differences do not prevent a player from inspecting a machine or building schematic, but they should be considered before using the renderer for cinematic or pixel-comparison output.
