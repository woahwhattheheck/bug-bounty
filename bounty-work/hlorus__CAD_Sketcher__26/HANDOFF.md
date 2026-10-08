# HANDOFF · hlorus/CAD_Sketcher#26 · Open Collective ~$100 (label "Bounty - Small") · READY FOR SUBMISSION (scope: writer + test; Blender operator is a follow-up)

**Issue:** https://github.com/hlorus/CAD_Sketcher/issues/26 ("Add integration with IFC", open, no assignee, not archived; labels "Bounty - Small", "feature request")
**Bounty / platform:** Open Collective, collective `cadsketcher` (https://opencollective.com/cadsketcher). Host: Open Source Collective.
**Amount:** about $100 per the coordinator's tier note. Not confirmed on the platform. The label links to a bounty board that I could not open.

**Payout evidence (checked 2026-10-08):**
- The collective page lists an approved $100 expense on Oct 6, 2026 ("Add scale preference for dimension line width (#143)", Maintenance and Development). That is a feature expense, not a labelled bounty.
- The coordinator's note says 4 payouts in Aug–Sep 2026. The page I could read shows only Oct 2026 entries (3 visible), so I could not verify the 4 payouts. Confirm with the payer before relying on this.
- The page has no bounty section or bounty rules.

## Scope (proposed and implemented)
The issue asks for IFC integration and a more generic, add-on-agnostic interface, with no specific requirements. The concrete minimal scope:
1. An optional-dependency writer that takes closed 2D loops from a sketch and writes IFC4 `IfcArbitraryClosedProfileDef` (AREA) entities through IfcOpenShell.
2. The addon must not require IfcOpenShell. Importing the module is safe without it. The writer raises `IfcOpenShellMissing` when the package is absent.
3. Loop validation: drop a repeated closing point, reject non-finite coordinates and loops with fewer than three distinct points.

Not in this patch (follow-up): a Blender operator that collects a sketch's closed loops (needs bpy and the sketch loop helpers) and an UI entry point. Those cannot be run here because Blender is not installed.

## Root cause / change
No IFC export exists. The change is new code only, with no edits to existing modules.
- `utilities/ifc_export.py` (new): `is_available()`, `closed_loop_points()`, `add_arbitrary_profile()`, `write_profiles()`. `utilities/__init__.py` is empty, so the module stays bpy-free.
- `testing/test_ifc_export.py` (new): 3 loop-validation tests (no ifcopenshell needed) and 1 write/re-open round-trip test that is skipped when ifcopenshell is missing. It uses the repo's relative-import style, so it runs inside the Blender CI harness.

## Files changed
utilities/ifc_export.py, testing/test_ifc_export.py (2 new files, about 110 lines)

## Validation (focused only)
```
python3 -m venv ifcenv && ifcenv/bin/pip install ifcopenshell ruff     # ifcopenshell 0.9.0
# copied the two files into a scratch package CAD_Sketcher/{utilities,testing} (Blender not available here)
ifcenv/bin/python -m unittest -v CAD_Sketcher.testing.test_ifc_export
  test_rejects_fewer_than_three_distinct_points ... ok
  test_rejects_non_finite_coordinates ... ok
  test_strips_repeated_closing_point ... ok
  test_round_trip_writes_arbitrary_closed_profile ... ok
  Ran 4 tests ... OK
python3 -m unittest CAD_Sketcher.testing.test_ifc_export   # system python, no ifcopenshell
  Ran 4 tests ... OK (skipped=1)
ifcenv/bin/ruff format --check <2 files>  → 2 files already formatted
ifcenv/bin/ruff check <2 files>           → All checks passed!
```
Not run: the full Blender suite (`blender --background --python ./scripts/ci_run_tests.py`), because Blender is not installed here.

## Base / apply
Base: `master` @ 0fe66ce7a64cf5e50891d39947f0cd2743b66115 (HEAD of the shallow clone at fetch time). Apply: `git am fix.patch` (author woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>). Verified: applies cleanly on the base and the tree matches the branch.

## Competition
None. No open PRs referencing #26 were found, and no fleet TAKE was found in Slack for #26 in the last 7 days.

## PR draft
Title: feat(ifc): export closed sketch loops as IFC profile definitions (#26)

Body:
```
Adds utilities/ifc_export.py, which writes closed 2D loops as IFC4 IfcArbitraryClosedProfileDef (AREA) entities through ifcopenshell.

ifcopenshell is optional. The module imports without it, and only the writer needs it.

closed_loop_points() drops a repeated closing point and rejects non-finite coordinates and loops with fewer than three distinct points.

testing/test_ifc_export.py covers loop validation, and a write/re-open round trip that is skipped when ifcopenshell is missing.

Not included: a Blender operator that exports a sketch's loops. This is the next step.

Fixes #26. Claim on Open Collective after merge: https://opencollective.com/cadsketcher
Requesting the bounty payout for #26 when this merges.
```

## Remaining plan
1. Add a sketch-to-loop helper that returns a closed loop from a sketch's curves (in sketch coordinates).
2. Add a `FILE > Export > IFC profiles` operator that calls `write_profiles()` and reports `IfcOpenShellMissing` in the UI.
3. Run the Blender suite in CI to confirm the relative import under the addon package.
