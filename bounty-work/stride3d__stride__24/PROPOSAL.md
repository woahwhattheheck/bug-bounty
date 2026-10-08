# Proposal and estimate: Decals (stride3d/stride#24)

- Issue: https://github.com/stride3d/stride/issues/24
- Funding: Open Collective, Stride "Decals" project, https://opencollective.com/stride3d/projects/decals
  ($2,016.92 raised, $2,000 of it from Stride on Sep 22 2025, $0 disbursed as of Oct 8 2026)
- Bounty terms (Stride bug bounty page): 60% paid when the PR is merged, 40% at the next official engine release,
  paid as an Open Collective expense on the project.

## 1. Acceptance criteria collected from the issue

| # | Criterion | Source |
|---|-----------|--------|
| A1 | Decals project onto arbitrary opaque geometry | Eideren, Feb 16 2022 |
| A2 | A decal projects a Stride **material** | Eideren, Feb 16 2022 |
| A3 | An entity component; the projection direction follows the entity transform | Eideren, Feb 16 2022 |
| A4 | Visible in the editor and at runtime | Eideren, Feb 16 2022 |
| B1 | Bonus: the FPS sample gun script leaves decals (bullet holes) | Aggror, Feb 23 2022 |
| B2 | Bonus: documentation (what decals are, use cases, setup in the editor and from code) | Aggror, Feb 23 2022 |
| C1 | Tests that check decal output and catch regressions | Ethereal77, Sep 19 2025 |
| C2 | A sample/template showing decals | Ethereal77, Sep 19 2025 (covered by B1) |
| P1 | Cheap enough for dynamic impact decals (order of 0.2 ms per decal), depth-buffer projection rather than mesh generation | Eideren, Aug 4 2023 |
| D1 | Design input: "Decals can be implemented as an extension on top of our clustered shading system" (DOOM 2016) | Eideren, Nov 4 2025 |

## 2. Design

### Runtime
- **`DecalComponent`** (`Stride.Engine`, category Model): `Material`, `Size` (box volume, local X = U, local Y = V,
  local Z = projection depth), `Opacity`, `AngleFadeStart` / `AngleFadeEnd` (degrees), `DepthFade` (fraction of the
  depth at the far end), `SortOrder`, `RenderGroup`. The projection direction is the entity forward axis (-Z), so it
  follows the transform (A3), including parenting to moving objects.
- **`DecalRenderProcessor`**: one `RenderDecal` per component, sharing one unit-cube `MeshDraw`; updates world matrix,
  bounding box, mirrored transforms (`IsScalingNegative`) and fade parameters every frame; re-registers on material or
  render group change; disables degenerate (zero / non-finite) volumes.
- **`RenderDecal : RenderMesh`**: decals are rendered by the existing `MeshRenderFeature`, so they reuse the material
  pipeline, the forward + clustered lighting, shadows, environment lights and the effect permutation system. Any
  material works (diffuse with alpha, normal map, glossiness, metalness, emissive...) (A2).
- **`DecalRenderFeature`** (sub render feature of the mesh feature): selects the decal shader permutation through a
  new `StrideEffectBaseKeys.DecalShader` key mixed in by `StrideEffectBase.sdfx`, uploads a per-draw `float4` of
  parameters, and sets the volume pipeline state: cull front faces (back when mirrored) so the camera can be inside the
  volume, depth test `GreaterEqual` without depth write, material blend state (alpha blend by default).
- **`DecalProjection.sdsl`**: for each pixel of the volume, reads the opaque depth buffer, reconstructs the receiving
  surface position, its normal (from the neighbour closest in depth on each axis, to stay stable on silhouettes) and a
  tangent frame aligned with the decal axes. It then replaces the surface streams (`PositionWS`, `normalWS`,
  `tangentToWorld`, `TexCoord`, `IsFrontFace`) **before** the material and lighting run, so the decal is shaded exactly
  like the surface it lies on (A1). Angle fade, depth fade and opacity multiply the output; the `clip` is done last so
  texture derivatives stay valid on the borders.
- **Compositor**: `ForwardRenderer.DecalRenderStage`, drawn after the opaque stage and before the transparent stage,
  with the depth buffer bound as a shader resource (reusing the existing depth-as-SRV path used by soft particles and
  subsurface scattering). `DecalSortMode` orders decals by `SortOrder` then creation order. The default graphics
  compositor and the template compositor get a "Decals" stage. Projects with an older compositor still render decals:
  the processor adds the `DecalRenderFeature` at runtime and decals fall back to the transparent stage.
- **`RenderSystem.AddRenderObject`** now falls back to the root render feature of the closest base type when no feature
  is registered for the exact type (`RenderDecal` -> `RenderMesh`). Exact-type registrations keep priority.

### Editor (A4)
- **`DecalGizmo`**: billboard icon plus, when selected, the box volume and an arrow along the projection direction,
  scaled by `Size` and the entity scale. Decals are drawn in the scene editor by the editor forward renderer, which also
  gets the decal stage in the default compositor.

### Sample and docs (B1, B2, C2)
- **FPS template**: `BulletHoleDecals` script listening to `WeaponScript.WeaponFired`: one decal per impact, oriented on
  the hit normal with a random roll, parented to rigid bodies so holes follow moving props, skips characters, capped
  count, lifetime and fade-out. Uses a generated crater texture when no material is assigned.
- **Docs** (stride-docs): new manual page `graphics/decals.md` + TOC and graphics index entries.

### Tests (C1)
- 14 GPU-free unit tests (fade math, clamping, volume matrices and bounds, processor updates, stage selectors, pipeline
  states, sort order, render-system routing, feature auto-registration).
- 3 GPU rendering tests (headless game, pixel checks on the rendered frame): opaque / translucent / grazing-angle /
  out-of-volume / camera-inside-volume / texture orientation / sort order, the same scene without a decal stage
  (fallback path), and lighting with a directional light at several decal orientations, with and without a normal map.
- Shader compilation test of the decal permutation with clustered lights and a normal map (SPIR-V, plus FXC on Windows),
  checking the per-draw cbuffer group and the depth texture binding.

### On the clustered approach (D1)
DOOM-style clustered decals evaluate decals inside the opaque surface shader, from a texture atlas, with a fixed decal
"material" (albedo / normal / roughness). That is the right tool for very large numbers of static decals, but it does
not satisfy A2 (projecting an arbitrary Stride material) without a material-to-atlas baking step, and it needs changes
to every opaque material shader. The projected-volume approach implemented here:
- reuses the material and lighting system unchanged, so any material and any light type works today;
- costs one 12-triangle draw per decal plus per-pixel work only inside the volume footprint (5 depth loads + the
  material + the lighting), which fits the dynamic-impact use case (P1);
- is independent of the light-clustering code, so a clustered decal path can be added later as an optimisation for
  dense static decals, sharing `DecalComponent` and the editor work.

The proposal comment asks the maintainers which of the two they want as the first deliverable; the clustered path is
listed below as a follow-up milestone.

## 3. Milestones and estimate

| Milestone | Content | State on the branch |
|-----------|---------|---------------------|
| M1 Runtime | component, processor, render feature, SDSL, compositor stage, sort mode, render-system routing, tests | implemented; validated on Linux/Vulkan (software rasterizer) |
| M2 Editor | gizmo (volume + direction), default compositor assets, component menu entry | implemented; Windows build + Game Studio check by the submitter |
| M3 Sample + docs | FPS bullet holes, manual page | implemented; FPS template compiled against the branch |
| M4 Review | review iterations, Windows CI (D3D11 / WARP test run), profiling numbers on hardware | open |

Estimate: the funded **$2,000** for M1-M4 (the full issue scope including both bonus items).
Payment per the bounty terms: $1,200 (60%) at merge, $800 (40%) at the next engine release, as Open Collective
expenses on the Decals project.

Schedule: the branch is ready to open as a PR as soon as the scope is confirmed; review iterations are expected to take
1-3 weeks depending on reviewer availability.

### Follow-ups (outside the funded scope, can be scoped separately)
1. Receiver filtering: exclude render groups from receiving decals (stencil mask written by the opaque pass).
2. Decal output to the normal / roughness buffers used by SSR and AO (D-buffer style).
3. MSAA support (needs a resolved depth copy or per-sample depth reads; the stage is skipped with a one-time warning
   when MSAA is on, same constraint as soft particles today).
4. Clustered decals for dense static decals (D1).
5. Dedicated gizmo icon (art asset).
