# HANDOFF · IfcOpenShell/IfcOpenShell#6428 · Open Collective (OSArch) $277.31

Status: **HANDOFF** (ready for submission)

| Field | Value |
|---|---|
| Issue | https://github.com/IfcOpenShell/IfcOpenShell/issues/6428 "D&D Phase 1 Item 07 - placing and editing sheets / layouts easier from bonsai" (open, label Bonsai, no assignee) |
| Bounty | OSArch Open Collective project **bonsai-editing-sheetslayouts-e**: https://opencollective.com/osarch/projects/bonsai-editing-sheetslayouts-e |
| Balance | USD 277.31 (OC GraphQL API, 2026-10-08) |
| Fiscal host | Open Source Collective (`opensource`); parent collective `osarch` |
| Forum thread | https://community.osarch.org/discussion/2640/drawings-documentation-donation-proposal |
| Funding rules | https://community.osarch.org/discussion/1741/have-an-idea-youd-like-to-get-funding-for-or-see-realized |
| Upstream default branch | `v0.9.0` @ `f96911ce5cca7c31b963226108329ee43e57b4c8` |
| Patch | `fix.patch` (1 commit, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`) |

## Payout evidence (OSArch pays external developers)
- **External developer paid.** OC expense #258895 was PAID on 2025-07-25: USD 316.12, INVOICE, PayPal. It came from the OSArch project `convert-blenderbim-svg-to-dxf` and went to an external individual, Eduardo Luiz Schilling.
- **Full OSArch history.** OSArch has 4 expenses, all PAID: #258895, #218797, #178374 and #166758 (OC API). None were rejected or left unpaid.

## Eligibility and payout steps for an external implementer
1. **Comment on the issue.** The OC project page asks developers to "ping us at the following link [#6428], and share your intentions". **The submitter should comment on #6428** with the PR link. This team does not post upstream; the human does.
2. **Who decides.** The OSArch steering committee decides when the project is done and how much to pay. Partial solutions can be funded.
3. **365-day clause.** The project page says unused funds can move to OSArch general funding after 365 days. The project was created on 2025-03-25. As of 2026-10-08 the USD 277.31 is still in the project balance.
4. **Submit the expense after merge.**
   1. Go to https://opencollective.com/bonsai-editing-sheetslayouts-e/expenses/new, or click **Submit Expense** on the project page.
   2. Choose **Invoice**.
   3. Payee: your individual profile.
   4. Payout: PayPal, or bank transfer through Wise.
   5. Description: `Bonsai: arrange sheet layouts in Blender (IfcOpenShell#6428), PR <link>`.
   6. Amount: the amount agreed with the steering committee, up to USD 277.31.
   7. Submit. OSArch approves it and Open Source Collective pays. Provide W-8 or W-9 tax info if asked.

## Issue summary
Placing drawings on sheets meant opening the layout SVG in Inkscape (`bim.open_layout`). The reporter wants to set drawing positions on sheets inside Bonsai. Inkscape also produced large PDFs for them, with rasterized linked images.

## Root cause
Bonsai had no way to place items on a sheet beyond `SheetBuilder.next_drawing_location`, which auto-packs drawings in rows. Any other position required an external SVG editor.

## Change
- **Edit Sheet Layout button** (`bim.enable_editing_sheet_layout`, VIEW_ORTHO icon) in the Sheets panel.
  - It reads the active sheet's layout SVG and creates temporary real-size objects (1 mm = 1 mm) in a "Sheet Layout" collection:
    - the sheet outline, not selectable;
    - one rectangle per drawing, schedule or reference, named "<identification> - <name>" with the name shown in the viewport;
    - each item's view-title rectangle, parented to its item.
  - Items can only move in the sheet plane: Z, rotation and scale are locked.
  - The objects are isolated with local view and shown from the top, framed.
- **Native Blender tools.** Items are moved with grab, snapping to other items' vertices and edges, increment snapping, axis constraints, typed values, the N-panel location and Align Objects. No custom modal tool or GPU drawing code was needed.
- **Save** (`bim.edit_sheet_layout`): writes the new positions in mm to the layout SVG through `SheetBuilder.set_sheet_item_positions`. Every image of an item moves by the same offset, so the view title keeps its place relative to its drawing. Then the temporary objects are removed and local view is exited.
- **Cancel** (`bim.disable_editing_sheet_layout`): removes the objects and leaves the layout unchanged.
- **`SheetBuilder.get_sheet_layout(sheet)`**: returns the sheet size and each item's content and title rectangles in mm.

### Files changed
- `src/bonsai/bonsai/bim/module/drawing/sheeter.py`: `get_sheet_layout`, `get_image_rectangle`, `set_sheet_item_positions`.
- `src/bonsai/bonsai/tool/drawing.py`: `create_sheet_layout_objects`, `get_sheet_layout_positions`, `remove_sheet_layout_objects`, `isolate_sheet_layout_objects`, `exit_sheet_layout_view`, `get_sheet_layout_collection`.
- `src/bonsai/bonsai/bim/module/drawing/operator.py`: `EnableEditingSheetLayout`, `EditSheetLayout`, `DisableEditingSheetLayout`.
- `src/bonsai/bonsai/bim/module/drawing/prop.py`: `DocProperties.editing_sheet_layout_id`.
- `src/bonsai/bonsai/bim/module/drawing/ui.py`: Edit Layout button, plus a Save/Cancel box while editing.
- `src/bonsai/bonsai/bim/module/drawing/__init__.py`: registration.
- `src/bonsai/test/tool/test_drawing_sheet_layout.py`: new file with 7 Blender-backed tests and the AI-generated header that AGENTS.md requires.

Total: 7 files, +428 / -0.

## Validation (focused; Blender 5.2.2 LTS headless + ifcopenshell 0.9.0 + Bonsai from this branch)
```
cd src/bonsai
BONSAI_TEST_ARGS='-o addopts= -p no:pytest-blender test/tool/test_drawing_sheet_layout.py test/tool/test_drawing.py -q' blender -b -P runpytest.py
→ 94 passed  (7 new + the existing drawing tool tests, incl. the sheet position test)
BONSAI_TEST_ARGS='-o addopts= -p no:pytest-blender -p pytest_bdd test/bim/test_feature.py -q -m drawing' blender -b -P runpytest.py
→ 24 passed, 656 deselected  (incl. Add sheet / Create sheet / Add drawing to sheet scenarios)
python -m pytest -p no:pytest-blender test/core/test_drawing.py -q → 41 passed
ruff format / ruff check → clean
git am fix.patch on fresh v0.9.0@f96911c → OK
```
What the new tests cover:
- Reading the layout: A1 sheet is 841×594, the drawing is at (30, 30) and 500×500, the title is at (30, 535).
- Moving an item: the drawing goes to (100, 20.5) and its title to (100, 525.5); unknown references are ignored.
- Editing mode objects: real-size sheet and item, Y axis flipped, name `1 - PLAN_VIEW`, transform locks, title child, local view isolates the sheet from the model.
- Save: the SVG is updated, the objects are removed and local view is exited.
- Save followed by `bim.create_sheets`: the built sheet has `translate(100.0,20.5)`.
- Cancel: the layout is unchanged and everything is cleaned up.

## Combined check with the other two lane patches
- The patches for #6432, #6422 and #6428 each apply standalone and in any order: 6432→6422→6428, 6428→6422→6432 and 6422→6428→6432 were all tried.
- With all three applied:
  - `test_drawing.py`, `test_drawing_print_preview.py`, `test_drawing_sheet_layout.py` and `test_blender.py`: 144 passed.
  - Drawing BDD: 24 passed.

### Blender GUI checks for the submitter (needs a display)
1. Open a project with a sheet that has two or more drawings.
2. Select the sheet in the Sheets panel and click the new **Edit Sheet Layout** button (VIEW_ORTHO icon). The viewport should switch to a top view of the sheet outline, with labelled item rectangles and their view-title boxes.
3. Move the items with G and snapping, Align Objects, and typed N-panel values. The location shows in project units, mm for mm projects.
4. Click **Save Sheet Layout**, then Create Sheet and open it. The drawings should be at their new positions.
5. Check that the previous view is restored.
6. Try Cancel and check that nothing changes.
7. Take screenshots for the PR.

## Possible follow-ups (separate PRs, not needed to close the issue)
- Texture the item rectangles with rendered drawing previews. The #6422 patch adds the SVG→PNG rendering this would use.
- Scaling a drawing on the sheet. The image size only clips the view, as BIMvoice's PR also notes. Scaling a view means changing the drawing scale.

## Competition
- **PR #9688** (BIMvoice, opened 2026-09-29, open, no review; it replaces closed #8804).
  - It adds an "Edit Position On Sheet" dialog where you type X/Y in mm for one selected item at a time.
  - It does not mention #6428 with a closing keyword.
- **How ours differs:**
  - It is a visual editor. All items are shown on the real-size sheet with their titles, and are arranged together using Blender's own move, snap and align tools.
  - It has Save and Cancel.
  - It has a test that the result carries through to Create Sheet, 7 Blender-backed tests in total, and `Closes #6428`.
  - A typed X/Y is still possible through Blender's N panel.

## Upstream contribution rules (from repo `AGENTS.md`)
- **Required AI disclosure.** The commit body line, the new test-file header and the PR text below are included. The repo requires disclosure of AI-generated contributions, and leaving it out is a stated reason for rejection.
- **Other rules.** The subject is 50 characters or fewer and in the imperative, the PR covers one issue, ruff is clean, and tests are included.

## How to apply
```
git clone https://github.com/IfcOpenShell/IfcOpenShell && cd IfcOpenShell
git checkout -b bonsai-sheet-layout-editor origin/v0.9.0
git am /path/to/fix.patch
git push <fork> bonsai-sheet-layout-editor   # then open PR against v0.9.0
```

## PR title
Bonsai: arrange sheet layouts in the 3D viewport

## PR body (ready to paste)
```
Closes #6428

D&D Phase 1 Item 07 ("placing and editing sheets / layouts easier from bonsai"), funded through the OSArch Open Collective project https://opencollective.com/osarch/projects/bonsai-editing-sheetslayouts-e.

## What this does
Positioning drawings, schedules and references on a sheet required opening the layout SVG in Inkscape.

- New **Edit Sheet Layout** button in the Sheets panel. It creates temporary real-size (1 mm = 1 mm) outlines of the sheet and of every item placed on it, named after the item, with their view title boxes, and isolates them in the viewport seen from the top.
- Items are arranged with the usual Blender tools: grab, snapping to other items, increments, axis constraints, typed values, Align Objects. They are locked to the sheet plane (no Z move, rotation or scale).
- **Save Sheet Layout** writes the new positions to the layout SVG (view titles keep their offset to their item) and restores the viewport. **Cancel** leaves the layout untouched.
- `SheetBuilder.get_sheet_layout()` / `set_sheet_item_positions()` read and write item positions in mm.

## Tests
New Blender-backed tests in `test/tool/test_drawing_sheet_layout.py`: reading the layout, moving items (incl. view titles, unknown references), editing mode objects (size, position, locks, title, local view isolation), saving (incl. `bim.create_sheets` output), cancelling.
- `test/tool/test_drawing_sheet_layout.py`, `test/tool/test_drawing.py`: 94 passed (Blender 5.2.2, headless)
- `test/bim/test_feature.py -m drawing`: 24 passed
- `test/core/test_drawing.py`: 41 passed
- `ruff format` / `ruff check`: clean

## AI assistance
Per AGENTS.md: the code in this PR was generated with the assistance of an AI coding tool (noted in the commit body and the new test file header).

## Bounty
This PR implements the OSArch-funded item above. On merge, I'd like to request the bounty payout from the OSArch Open Collective project (bonsai-editing-sheetslayouts-e, USD 277.31); I'll submit the expense there once the steering committee confirms the item as done.
```
