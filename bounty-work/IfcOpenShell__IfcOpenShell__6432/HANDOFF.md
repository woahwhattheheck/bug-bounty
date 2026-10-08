# HANDOFF · IfcOpenShell/IfcOpenShell#6432 · Open Collective (OSArch) $285.30

Status: **HANDOFF** (ready for submission)

| Field | Value |
|---|---|
| Issue | https://github.com/IfcOpenShell/IfcOpenShell/issues/6432 "D&D Phase 1 Item 10 - Open multiple drawings in viewport" (open, label Bonsai, no assignee) |
| Bounty | OSArch Open Collective project **bonsai-open-multiple-drawings**: https://opencollective.com/osarch/projects/bonsai-open-multiple-drawings |
| Balance | USD 285.30 (OC GraphQL API, 2026-10-08) |
| Fiscal host | Open Source Collective (`opensource`), parent collective `osarch` |
| Forum thread | https://community.osarch.org/discussion/2640/drawings-documentation-donation-proposal |
| Funding rules | https://community.osarch.org/discussion/1741/have-an-idea-youd-like-to-get-funding-for-or-see-realized |
| Upstream default branch | `v0.9.0` @ `f96911ce5cca7c31b963226108329ee43e57b4c8` |
| Patch | `fix.patch` (1 commit, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`) |

## Payout evidence (OSArch pays external developers)
- Expense #258895 was PAID on 2025-07-25: USD 316.12, type INVOICE, payout by PayPal. It was paid from the OSArch project `convert-blenderbim-svg-to-dxf` to an external individual, Eduardo Luiz Schilling.
- OSArch expense history (OC API, `includeChildrenExpenses`) has 4 expenses, all PAID: #258895, #218797 (USD 831.25), #178374 and #166758. There are no rejected or unpaid expenses.

## Eligibility and payout steps for an external implementer
These come from the OC project page and the OSArch funding rules.
1. The project page says: "If you're a developer that would like to work on this project, please ping us at the following link, and share your intentions". The link is issue #6432. **The submitter (woahwhattheheck) posts a short comment on #6432** saying they have implemented the feature and linking the PR. This team does not post upstream; the human does it.
2. "The steering committee will act as the arbiter to determine when the project is done and when the funds should be distributed". Partial solutions can be paid partially.
3. The project page also says that funds unused within 365 days may move to OSArch general funding. The project was created on 2025-03-25. As of 2026-10-08 the USD 285.30 is still in the project balance.
4. After the PR is merged, submit an Open Collective expense:
   1. Sign in or sign up at https://opencollective.com as the payee (woahwhattheheck / Bryce).
   2. Open https://opencollective.com/bonsai-open-multiple-drawings/expenses/new, or use **Submit Expense** on the project page.
   3. Type: **Invoice**. Payee: your individual profile. Payout method: PayPal, or bank transfer through Wise. Open Source Collective supports both.
   4. Description: `Bonsai: open multiple drawings in viewport (IfcOpenShell#6432), PR <link>`. One item for the amount the steering committee agrees, with the project balance of USD 285.30 as the ceiling. Reference the merged PR URL.
   5. Submit. OSArch admins approve, then Open Source Collective pays. If they ask for it, add tax info (W-8/W-9).

## Issue summary
Activating a drawing sets `scene.camera`, so every 3D viewport in camera view switched to the new drawing. The drawing's element isolation (hide others) is global, so another viewport could not keep showing a different drawing. The reporter wants one viewport on a plan and another on a section, and to "be able to choose what changes when".

## Root cause
- `tool.Blender.activate_camera` and `ActivateDrawing` always worked on the first VIEW_3D area and on the global `scene.camera`.
- `tool.Drawing.activate_drawing` isolated the drawing's objects globally with `hide_view_set`.
- Decorations (`DecorationsHandler`, `CutDecorator`, `DecoratorData`) only ever used `scene.camera` and the first viewport.

## Change
- **Lock button in the 3D viewport header.** It appears when the viewport looks through a drawing camera. `bim.toggle_drawing_viewport_lock` locks the viewport to its drawing: the drawing camera becomes the viewport's local camera, and Blender local view shows only that drawing's elements and annotations. Clicking again unlocks the viewport, and it follows the active drawing again. A locked viewport shows the drawing name in its header.
- **Activation targets one viewport.** `bim.activate_drawing` acts on the viewport it is invoked from, or on the first unlocked viewport. Activating from a locked viewport re-locks it to the new drawing. Locked viewports keep their camera and elements: global hiding keeps their objects visible, and each viewport is filtered by local view.
- **Decorations per viewport.** Text, dimension and other annotation decorations use each viewport's own camera and drawing (`DecoratorData.get_viewport_object_decorators`). Cut fills are drawn only for the active drawing. Local views created for drawings no longer turn off decorations.
- **Activate Model** keeps the annotation collections of locked drawings visible.
- **Unchanged:** with no locked viewports, behaviour is the same as before, including ALT+click "keep viewport position" and quick preview.

### Files changed
- `src/bonsai/bonsai/tool/drawing.py`: `isolate_drawing_objects`, `lock_viewport_to_drawing`, `unlock_viewport_from_drawing`, `set_viewport_local_view`, `exit_viewport_local_view`, `get_drawing_target_area`, `is_viewport_locked_to_drawing`, `is_drawing_local_view`, `get_viewport_camera` and `is_drawing_camera`. Also extracted `get_drawing_filtered_elements` / `get_drawing_visible_objects`, and changed `hide_all_drawing_collections`.
- `src/bonsai/bonsai/tool/blender.py`: `activate_camera(obj, area=None)` leaves local view only where needed. Adds `get_view3d_areas`, and `get_/set_viewport_position` take an `area`.
- `src/bonsai/bonsai/core/drawing.py`, `src/bonsai/bonsai/core/tool.py`: optional `area` passed through `activate_drawing_view`.
- `src/bonsai/bonsai/bim/module/drawing/operator.py`: target viewport in `ActivateDrawingBase`; new `ToggleDrawingViewportLock`.
- `src/bonsai/bonsai/bim/module/drawing/{decoration.py,data.py,ui.py,__init__.py}`: decorations per viewport, the header button, and registration.
- `src/bonsai/test/tool/test_drawing.py`: 9 new Blender-backed tests.

Totals: 10 files, +597 / -51.

## Validation (focused; Blender 5.2.2 LTS headless + ifcopenshell 0.9.0 wheel + Bonsai from this branch)
Environment setup:
- Blender 5.2.2 linux-x64 from download.blender.org.
- Bonsai's bundled wheels installed into Blender's Python (Makefile `BUNDLED_WHEELS`, ifcopenshell==0.9.0).
- The extension is symlinked into `~/.config/blender/5.2/extensions/user_default/bonsai`.
- `src/bonsai` is on `sys.path` through a `.pth` file.

```
cd src/bonsai
BONSAI_TEST_ARGS='-o addopts= -p no:pytest-blender test/tool/test_drawing.py -q -k "LockViewport or UnlockViewport or LockedViewport or WithoutLockedViewports or DecoratingLocked"' blender -b -P runpytest.py
→ 9 passed (new tests; they fail or error on v0.9.0 without the change)
BONSAI_TEST_ARGS='-o addopts= -p no:pytest-blender test/tool/test_drawing.py test/tool/test_blender.py -q' blender -b -P runpytest.py
→ 117 passed
BONSAI_TEST_ARGS='-o addopts= -p no:pytest-blender -p pytest_bdd test/bim/test_feature.py -q -m drawing' blender -b -P runpytest.py
→ 24 passed, 656 deselected   (drawing BDD scenarios incl. "Activate drawing preserves visibility/selection")
python -m pytest -p no:pytest-blender test/core/test_drawing.py -q
→ 41 passed
ruff format --check / ruff check (repo config) on changed files → clean
git am fix.patch on a fresh clone of v0.9.0@f96911c → applies cleanly
```
The new tests cover these cases:
- Lock keeps the camera and elements of its drawing.
- Activating another drawing changes only the unlocked viewport, and each viewport shows only its own wall.
- Activating from a locked viewport re-locks it.
- Locking a viewport left on an inactive drawing camera by ALT+click.
- Unlocking, including when another viewport is still locked.
- Activate Model keeps the locked drawing's annotations.
- With no locks, behaviour is unchanged (hide-based, no local view).
- Annotation decorators per viewport.

### Blender GUI checks for the submitter (not possible headless)
1. Open a project with a plan and a section drawing. Split the 3D viewport into two.
2. Activate the plan with the cursor over viewport A, or from the Drawings panel. Click the new lock icon in viewport A's header. It turns into a pressed lock showing the drawing name.
3. Activate the section from the Drawings panel. Viewport B shows the section. Viewport A stays on the plan, with its own elements, text, dimensions and other annotations.
4. Check that annotation text sizes in A still match A's drawing scale, and that cut fills appear only in the active drawing's viewport.
5. Add an annotation in B. It appears in B.
6. Click the lock in A again. A follows the active (section) drawing.
7. Activate Model. The locked viewport keeps its annotations visible.
8. Optional: take screenshots for the PR.

## Known limitations (documented in PR)
- An element's representation (for example Plan/Body versus Model/Body) is per object. It follows the last activated drawing, including in locked viewports.
- Cut fills (`CutDecorator`) are computed for the active drawing only. Locked viewports showing another drawing skip them.

## Competition
- **PR #9464** (franklincg, opened 2026-09-09, open, no review, "Refs #6432"). It only pins other camera viewports to the previous scene camera. By its own description it does not make visibility or decorations viewport-local, so a pinned plan viewport still loses its elements and annotations when a section is activated.
- **Ours differs.** It adds an explicit, user-controlled lock per viewport ("choose what changes when", as the issue asks). Visibility is per viewport through local view, decorations are per viewport, and Activate Model is handled. It has 9 Blender-backed tests and uses `Closes #6432`.

## Upstream contribution rules (from repo `AGENTS.md`)
- AI-generated changes must say so:
  - a line in the commit body: "Generated with the assistance of an AI coding tool.";
  - a header comment in new AI-generated files;
  - a statement in the PR description.
- The commit in `fix.patch` carries the commit-body line. This patch adds no new files. The PR body below includes the required statement.
- These are the repository's own contribution requirements, not tool branding. Leaving them out is a stated reason for rejection under the upstream policy.
- Other rules: subject ≤ 50 characters in the imperative mood, one issue per PR, `ruff format`/`ruff check`, and tests. All are met.

## How to apply
```
git clone https://github.com/IfcOpenShell/IfcOpenShell && cd IfcOpenShell
git checkout -b bonsai-lock-drawing-viewports origin/v0.9.0
git am /path/to/fix.patch
git push <fork> bonsai-lock-drawing-viewports   # then open PR against v0.9.0
```

## PR title
Bonsai: lock drawings to viewports to see several drawings at once

## PR body (ready to paste)
```
Closes #6432

D&D Phase 1 Item 10 ("Open multiple drawings in viewport"), funded through the OSArch Open Collective project https://opencollective.com/osarch/projects/bonsai-open-multiple-drawings.

## What this does
Activating a drawing used to switch every 3D viewport looking through the scene camera, and the drawing's isolation hid the elements other viewports needed, so it was not possible to keep e.g. a plan in one viewport and a section in another.

- A 3D viewport looking through a drawing camera now shows a lock button in its header. Locking keeps the viewport on its drawing: the drawing camera becomes the viewport's local camera and Blender's local view shows only that drawing's elements and annotations. The header shows the locked drawing's name; clicking again unlocks it and it follows the active drawing again.
- `bim.activate_drawing` targets the viewport it's invoked from, or the first unlocked viewport. Activating from a locked viewport re-locks it to the new drawing. Locked viewports keep their camera and their elements.
- Annotation decorations (text, dimensions, symbols...) are drawn per viewport for the drawing that viewport shows, using that viewport's camera for scale and direction. Cut fills are drawn for the active drawing only. Local views used for drawings don't disable decorations.
- Activate Model keeps annotation collections of locked drawings visible.
- Without locked viewports nothing changes (including ALT+click to keep the viewport position and SHIFT+click quick preview).

Known limitations: an element's representation (e.g. Plan/Body vs Model/Body) is per object and follows the last activated drawing; cut fills are only computed for the active drawing.

## Tests
New Blender-backed tests in `test/tool/test_drawing.py` (lock, activation with locked viewports, re-lock, ALT+click case, unlock, Activate Model, unchanged behaviour without locks, per-viewport decorator data).
- `test/tool/test_drawing.py`, `test/tool/test_blender.py`: 117 passed (Blender 5.2.2, headless)
- `test/bim/test_feature.py -m drawing`: 24 passed
- `test/core/test_drawing.py`: 41 passed
- `ruff format` / `ruff check`: clean

## AI assistance
Per AGENTS.md: the code in this PR was generated with the assistance of an AI coding tool (the commit body says so as well).

## Bounty
This PR implements the OSArch-funded item above. On merge, I'd like to request the bounty payout from the OSArch Open Collective project (bonsai-open-multiple-drawings, USD 285.30); I'll submit the expense there once the steering committee confirms the item as done.
```
