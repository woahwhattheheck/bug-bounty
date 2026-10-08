# HANDOFF · IfcOpenShell/IfcOpenShell#6422 · Open Collective (OSArch) $314.31

Status: **HANDOFF** (ready for submission)

| Field | Value |
|---|---|
| Issue | https://github.com/IfcOpenShell/IfcOpenShell/issues/6422 "D&D Phase 1 item 01 - See drawing as they print in the Bonsai viewport" (open, label Bonsai, no assignee) |
| Bounty | OSArch Open Collective project **see-drawing-as-they-print-in-t**: https://opencollective.com/osarch/projects/see-drawing-as-they-print-in-t |
| Balance | USD 314.31 (OC GraphQL API, 2026-10-08) |
| Fiscal host | Open Source Collective (`opensource`); parent collective `osarch` |
| Forum thread | https://community.osarch.org/discussion/2640/drawings-documentation-donation-proposal |
| Funding rules | https://community.osarch.org/discussion/1741/have-an-idea-youd-like-to-get-funding-for-or-see-realized |
| Upstream default branch | `v0.9.0` @ `f96911ce5cca7c31b963226108329ee43e57b4c8` |
| Patch | `fix.patch` (1 commit, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`) |

## Payout evidence (OSArch pays external developers)
- OC expense #258895, PAID 2025-07-25: USD 316.12, type INVOICE, payout via PayPal. It was paid from the OSArch project `convert-blenderbim-svg-to-dxf` to an external individual, Eduardo Luiz Schilling.
- OSArch expense history (OC API, `includeChildrenExpenses`) has 4 expenses: #258895, #218797, #178374 and #166758. All of them are PAID; none was rejected or left unpaid.

## Eligibility and payout steps for an external implementer
1. The project page asks developers to comment on the issue first: "If you're a developer that would like to work on this project, please ping us at the following link [#6422], and share your intentions." **The submitter should comment on #6422** with the PR link. This team does not post upstream; the human does.
2. "The steering committee will act as the arbiter to determine when the project is done and when the funds should be distributed". They may also fund partial solutions.
3. The project page says unspent funds may move to OSArch general funding after 365 days. The project was created on 2025-03-25. As of 2026-10-08 the USD 314.31 is still in the project's balance.
4. After merge, submit an Open Collective expense:
   1. Sign in at https://opencollective.com as the payee.
   2. Open https://opencollective.com/see-drawing-as-they-print-in-t/expenses/new, or use **Submit Expense** on the project page.
   3. Fill in the expense:
      - Type: **Invoice**.
      - Payee: your individual profile.
      - Payout method: PayPal, or bank transfer through Wise.
      - Description: `Bonsai: see drawings as they print in the viewport (IfcOpenShell#6422), PR <link>`.
      - Item: the amount the steering committee agrees, up to USD 314.31. Include the merged PR URL.
   4. Submit. OSArch admins approve the expense and Open Source Collective pays it. Provide W-8/W-9 tax info if asked.

## Issue summary
Users have to "add stuff (almost blindly) on drawing -> print drawing -> adjust -> repeat". They cannot see stylesheets, symbols, tags, patterns or printed text sizes in Bonsai. The request is to see the drawing as it prints, inside Bonsai.

## Root cause
The viewport only showed the 3D model plus Bonsai's own GPU decorations. The printed result (the generated SVG with CSS styles, hatches, markers, symbols and text) could only be seen outside Bonsai. That meant a browser, Inkscape, or the PDF.

## Change
- **Print Preview toggle** (`bim.toggle_print_preview`) in the Active Drawing panel. It renders the drawing's generated SVG to a PNG and shows it in front of the drawing camera view as a camera background image. The image uses `STRETCH` to the camera frame, which matches the SVG paper size exactly. An opacity slider makes it easy to compare the print with the model. If the drawing has not been created yet, it is created first.
- **What you see is the actual print.** The preview is the real generated SVG rendered by the same kind of tool that produces the PDFs. Line weights, cut fills, hatch patterns, markers, symbols, text and its printed size all appear exactly as printed.
- **Kept up to date.** The preview refreshes every time `bim.create_drawing` runs. When a drawing is activated, its preview is restored. This also covers the case where Bonsai recreates the camera data after a size change; the cached image is reused, so it is not re-rendered.
- **Rendering command.** A new preference, "SVG to PNG Command", uses the same JSON format as "SVG to PDF Command" with `svg`, `png` and `dpi` placeholders. If it is blank, Bonsai uses `inkscape` or `rsvg-convert` when found on PATH.
- **Resolution.** It is chosen from the paper size: up to 4096 px on the long side, clamped to 36–300 DPI. Images go to Blender's session temp dir.
- **Global option.** Like the other cache options, the toggle and opacity are stored in `DocProperties`. Turning the toggle off removes all preview images.

### Files changed
- `src/bonsai/bonsai/tool/drawing.py`: adds `get_svg2png_commands`, `get_print_preview_dpi`, `rasterize_svg`, `get_print_preview_path`, `get_print_preview_background`, `update_print_preview`, `show_print_preview`, `sync_print_preview` and `remove_print_preview`.
- `src/bonsai/bonsai/bim/module/drawing/operator.py`: new `TogglePrintPreview`. It also refreshes the preview after Create Drawing and syncs it after Activate Drawing.
- `src/bonsai/bonsai/bim/module/drawing/prop.py`: adds `DocProperties.should_show_print_preview` and `print_preview_opacity`.
- `src/bonsai/bonsai/bim/module/drawing/ui.py`: adds the toggle and opacity controls to the Active Drawing panel.
- `src/bonsai/bonsai/bim/module/drawing/__init__.py`: registers the new operator.
- `src/bonsai/bonsai/bim/ui.py`: adds the `svg2png_command` preference.
- `src/bonsai/test/tool/test_drawing_print_preview.py`: new file with 20 Blender-backed tests. It carries the AI-generated header that AGENTS.md requires.
- Total: 7 files, +425/-0.

## Validation (focused; Blender 5.2.2 LTS headless + ifcopenshell 0.9.0 + Bonsai from this branch)
```
cd src/bonsai
BONSAI_TEST_ARGS='-o addopts= -p no:pytest-blender test/tool/test_drawing_print_preview.py test/tool/test_drawing.py -q' blender -b -P runpytest.py
→ 107 passed  (new print preview tests + the existing drawing tool tests)
BONSAI_TEST_ARGS='-o addopts= -p no:pytest-blender -p pytest_bdd test/bim/test_feature.py -q -m drawing' blender -b -P runpytest.py
→ 24 passed, 656 deselected
python -m pytest -p no:pytest-blender test/core/test_drawing.py -q → 41 passed
ruff format / ruff check → clean
git am fix.patch on fresh v0.9.0@f96911c → OK; also applies on top of the #6432 patch (no conflicts)
```
The new tests use a fake converter (a Python one-liner that writes a PNG and logs its calls). They cover:
- DPI selection;
- the preference and the inkscape/rsvg-convert fallback;
- background image setup (FRONT, STRETCH, alpha);
- refreshing an existing preview;
- a missing SVG;
- a failing converter and a converter that is not found;
- removal;
- toggle on and off;
- the toggle creating the drawing when no SVG exists yet;
- refresh after Create Drawing;
- opacity changes;
- the preview appearing when another drawing is activated;
- the preview being restored after the camera data is recreated, without re-rendering;
- the preview staying off when the option is off.

End-to-end check with the real `rsvg-convert` 2.58 auto-detected:
- A 30 m × 20 m plan at 1:100 with three walls and a TEXT annotation gave a 3544×2363 px PNG at 300 DPI, i.e. 300×200 mm paper.
- The aspect ratio matches the camera render (885×590). The background is transparent, frame method STRETCH, display depth FRONT.
- Wall positions in the PNG match the camera frame (checked visually).

### Blender GUI checks for the submitter (needs a display + Inkscape)
1. Install Inkscape and make sure it is on PATH, or set "SVG to PNG Command" in the Bonsai preferences. On macOS, for example: `[["/Applications/Inkscape.app/Contents/MacOS/inkscape", "svg", "--export-type=png", "--export-dpi", "dpi", "--export-filename", "png"]]`.
2. Activate a drawing that has annotations, hatches and text. Click **Print Preview** in the Active Drawing panel. The printed drawing should appear over the camera view and line up with the model.
3. Move the opacity slider. Edit an annotation, click Create Drawing, and check that the preview updates.
4. Change the drawing width or height, re-activate the drawing, and check that the preview is still shown.
5. Check a reflected ceiling plan (camera scale -1). Confirm the preview orientation matches the model. Background images are drawn in camera-frame space.
6. Take screenshots before and after for the PR.

## Competition
- **PR #9472** (franklincg, opened 2026-09-10, open, no review, "Refs #6422").
  - It draws only straight SVG lines with a GPU overlay, using a hand-written subset of the SVG/CSS parser.
  - By its own description it leaves out fills, text, curves, transforms, clipping, markers/patterns and paint servers. Those are exactly what the issue asks to see: "stylesheets, symbols, tags and patterns ... correct text sizes".
- **Ours differs:**
  - It shows the complete printed drawing by rendering the real SVG with a full renderer.
  - It is about 120 lines of tool code, with no custom SVG parser.
  - It refreshes when drawings are created and survives camera data recreation.
  - It has 20 tests and uses `Closes #6422`.

## Upstream contribution rules (from repo `AGENTS.md`)
- **Required disclosure.** The repo requires AI-generated contributions to be marked in three places: the commit body, a header in new files, and the PR description. The commit body line, the new test-file header and the PR text below are all included. Omitting them is a stated reason for rejection.
- **Other rules.** The subject line must be 50 characters or fewer and imperative, one issue per PR, ruff clean, with tests. All are met.

## How to apply
```
git clone https://github.com/IfcOpenShell/IfcOpenShell && cd IfcOpenShell
git checkout -b bonsai-print-preview origin/v0.9.0
git am /path/to/fix.patch
git push <fork> bonsai-print-preview   # then open PR against v0.9.0
```

## PR title
Bonsai: show drawings in the viewport as they print

## PR body (ready to paste)
```
Closes #6422

D&D Phase 1 Item 01 ("See drawing as they print in the Bonsai viewport"), funded through the OSArch Open Collective project https://opencollective.com/osarch/projects/see-drawing-as-they-print-in-t.

## What this does
Checking how stylesheets, symbols, hatches, tags and text sizes come out currently means opening the generated SVG (or PDF) outside of Bonsai after every change.

- New **Print Preview** toggle in the Active Drawing panel. It renders the drawing's generated SVG to an image and shows it in front of the drawing camera view, stretched to the camera frame (which is exactly the SVG paper area), with an opacity slider to compare against the model.
- Because it is the actual generated SVG, everything that prints is visible: line weights, cut fills, hatch patterns, markers, symbols and text at its printed size.
- The preview is refreshed every time the drawing is created, and restored when a drawing is activated (including after Bonsai recreates the camera data, e.g. when the drawing size changes). If the drawing wasn't created yet, toggling the preview creates it.
- Rendering uses a new "SVG to PNG Command" preference (same JSON format as "SVG to PDF Command", with `svg`, `png` and `dpi` placeholders). If blank, `inkscape` or `rsvg-convert` from PATH is used. Resolution is picked from the paper size (max 4096 px on the long side, 36–300 DPI); images go to Blender's session temp folder.
- The toggle and opacity are global options in DocProperties, like the cache options next to them.

## Tests
New Blender-backed tests in `test/tool/test_drawing_print_preview.py` (a fake converter stands in for Inkscape): DPI selection, converter fallback, background setup, refresh, missing SVG, failing/missing converter, removal, toggle (incl. creating the drawing), refresh on Create Drawing, opacity, activation of another drawing, recreated camera data, disabled option.
- `test/tool/test_drawing_print_preview.py`, `test/tool/test_drawing.py`: 107 passed (Blender 5.2.2, headless)
- `test/bim/test_feature.py -m drawing`: 24 passed
- `test/core/test_drawing.py`: 41 passed
- Also checked end to end with rsvg-convert 2.58 on a generated plan (3544×2363 px for a 300×200 mm sheet, aligned with the camera frame).
- `ruff format` / `ruff check`: clean

## AI assistance
Per AGENTS.md: the code in this PR was generated with the assistance of an AI coding tool (noted in the commit body and the new test file header).

## Bounty
This PR implements the OSArch-funded item above. On merge, I'd like to request the bounty payout from the OSArch Open Collective project (see-drawing-as-they-print-in-t, USD 314.31); I'll submit the expense there once the steering committee confirms the item as done.
```
