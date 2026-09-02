# Rendering validation

The rendering overhaul is validated against an unmodified Minecraft Java Edition 26.2 client. The goal is a recognizable and useful structure preview, not a pixel-identical replacement for Minecraft's complete renderer.

## Reference scene

The manual reference scene uses a fixed daytime camera and contains:

- a sealed glass tank filled with source water;
- exposed bottom and top slabs, stairs, an open trapdoor, and a fence with `waterlogged=true`;
- a contained lava column behind glass;
- a roofed alcove containing glowstone, hard shadow transitions, and occluded corners;
- opaque, cutout, emissive, and translucent blocks viewed together.

The same categories are present in the demo validation scene. The demo uses Minecraft 26.2 block models, textures, and animation metadata.

## Results

| Area | Minecraft 26.2 reference | Deepslate result |
| --- | --- | --- |
| Water surface | Source blocks sit below the full-block ceiling; flowing edges use different corner heights. | Neighboring fluid states determine exposed faces and averaged corner heights. Internal faces between compatible fluids are culled. |
| Flow direction | Flowing water rotates its surface texture with the direction of travel. | Flow vectors rotate the flowing-water UVs; still surfaces use the still-water texture. |
| Glass and water | Glass remains readable in front of water without writing transparent fragments into the depth buffer. | Translucent chunks and their contained quads are rendered back-to-front with depth writes disabled, preserving the glass/water relationship as the camera moves. |
| Waterlogged blocks | Water occupies only the unfilled portion of slabs, stairs, and trapdoors. | Slabs, stairs, and trapdoors use shape-aware clipped fluid volumes. Other waterlogged shapes retain a conservative approximation. |
| Lava and light-emitting blocks | Lava textures animate and remain visually bright. | Texture animation metadata updates the atlas at runtime, and emissive geometry bypasses directional darkening. |
| Sky and block light | Daylight enters exposed columns and loses one level as it spreads under cover; light-emitting blocks propagate local light up to level 15. | A baked two-channel light volume propagates sky and block light through the structure, including configurable opacity and emission per block. |
| Smooth lighting and ambient occlusion | The four corners of a face blend nearby light values, while opaque side and corner blocks darken creases. | Each rendered vertex averages the four adjacent light cells and applies Minecraft-style corner occlusion before the fragment shader's light curve. |
| Cutout blocks | Transparent texels are discarded rather than blended. | Cutout geometry uses alpha testing in its own render pass. |

The comparison confirmed that the overhaul fixes the original failure modes targeted by this fork: flat full-block liquids, internal fluid faces, water overlapping partial blocks, unstable glass/water depth ordering, static fluid textures, and dim lava.

## Minecraft 26.2 lighting cross-check

The baked-light implementation was also checked against the installed, unobfuscated Minecraft Java 26.2 client rather than tuned only by eye:

- `LightCoordsUtil.getLightCoords` raises a rendered block's block-light coordinate to at least its own emission level. Deepslate does the same, so glowstone is rendered at level 15 instead of inheriting level 14 from adjacent air.
- `CardinalLighting.DEFAULT` uses `1.0` for up, `0.5` for down, `0.8` for north/south, and `0.6` for west/east. The vertex shader uses those exact directional factors.
- Minecraft's `lightmap.fsh` applies `level / (4 - 3 * level)` separately to sky and block light, adds the two colored channels, and clamps the result. Deepslate now follows that composition instead of taking the brighter channel only.
- The stable block-light factor is `1.4`, and the default block-light tint is `#FFD88C`. Deepslate omits only Minecraft's tiny random light flicker so static schematic previews do not shimmer.

Visual checks against Minecraft captures with smooth lighting enabled cover exposed faces, floor/wall junctions, enclosed corners, and roofed daylight. Glowstone and lava emission behavior is additionally checked against the client light-coordinate and lightmap implementations. Opaque neighbors affect ambient occlusion but no longer contribute a second zero-light penalty, which removes the former black bands along walls.

Default block emission is a snapshot of every emitting block registered by the 26.2 client. It includes state-dependent sources such as lit furnaces and redstone lamps, candle count, waterlogged sea pickles, charged respawn anchors, copper-bulb oxidation, trial-spawner state, vault state, and the 26.2 copper torches and lanterns. Explicit resource-pack `light_emission` flags still take precedence for custom or modded blocks.

## Automated coverage

The test suite covers:

- render-layer classification and state ordering;
- neighbor-aware fluid faces, corner heights, and flow UVs;
- waterlogged slab, stair, and trapdoor clipping;
- animated texture metadata and frame selection;
- Minecraft 26.2 top-flow rotation, downward side-flow UVs, underside orientation, and the exact water/lava animation sequences;
- transparent sorting and renderer state transitions;
- sky light, water attenuation, lateral light spread, and block-light falloff;
- smooth per-corner light sampling and ambient-occlusion levels;
- a dense 16 x 16 x 16 fluid-section performance benchmark.
- a 32 x 32 x 32 combined sky- and block-light propagation benchmark.

The demo is also built in CI so resource or integration regressions fail the workflow.

## Deliberate differences

The following remain outside this renderer's current accuracy target:

- biome-dependent water tint;
- Minecraft's dimension-specific sky rules, time-of-day brightness, colored light, dynamic entity shadows, fog, and post-processing;
- exact global ordering between intersecting translucent surfaces across chunk boundaries;
- exact water clipping for every possible waterlogged block model;
- byte-for-byte reproduction of Minecraft's internal flowing-fluid UV calculation.

These differences do not prevent a player from inspecting a machine or building schematic, but they should be considered before using the renderer for cinematic or pixel-comparison output.
