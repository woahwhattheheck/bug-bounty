# HANDOFF: IfcOpenShell/IfcOpenShell#6427 (Bonsai: type text with Enter, Tab, bold, italic)

| | |
|---|---|
| Issue | https://github.com/IfcOpenShell/IfcOpenShell/issues/6427 ("D&D Phase 1 Item 06 - Edit text using tab, enter etc", open, labels Bonsai + PR Proposed, unassigned) |
| Bounty | Open Collective project **bonsai-edit-text-using-tab-ent**: https://opencollective.com/bonsai-edit-text-using-tab-ent |
| Program | OSArch D&D Phase 1 projects: https://opencollective.com/osarch/projects (forum proposal: https://community.osarch.org/discussion/2640/drawings-documentation-donation-proposal) |
| Amount | **$92.50 USD** available (balance 9250 cents, $100 raised), checked 2026-10-08 with the OC GraphQL API |
| Fiscal host | Open Source Collective (`opensource`) |
| Status | HANDOFF: ready for submission |
| Base | `v0.9.0` (default branch) @ `f96911ce5cca7c31b963226108329ee43e57b4c8` |
| Patch | `fix.patch`: one commit, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>` |

## Payout evidence (OSArch on Open Collective)
- #258895: **$316.12 PAID 2025-07-25** to an external developer (eduardo-luiz-schilling) for the "Convert BlenderBIM SVG into Intelligent DXF" project.
- #218797: $831.25 PAID 2024-09-04 (andrej730). #178374 and #166758: PAID 2023 (yorik).
- Nothing found showing OSArch merging funded work and then not paying.
- Project rule from the OC page: "the steering committee will act as the arbiter to determine when the project is done and when the funds should be distributed". The page also asks developers to "ping us at the [GitHub issue] and share your intentions", so the submitter should comment on #6427 with the PR link.

## What the issue asks for, and what already exists on v0.9.0
The issue asks for Tab, Enter and so on directly in text annotations ("a regular user doesn't want [\n]"), bold and italic (perhaps as markup), and editing several texts at once.
- Already upstream: markdown bold, italic, links and bullets in the SVG writer (`parse_markdown_it`), and multi-edit through `bim.copy_text_to_selection`.
- Still missing: there was no way to type a line break or a tab. The Text panel field is single-line, so users had to type `\n`. Real line breaks and tabs also printed wrongly. Verified on v0.9.0 by generating a drawing with this literal:
  ```
  First line\n\tIndented  twice\n\n**Bold** end\n1. kept\n# kept   (second literal: "Second literal")
  ```
  Unpatched output: the indentation and the double space are gone. The blank line is lost. "Bold end", "kept" and "kept" all land on the same line as "Indented twice", and the "1." and "#" are dropped. The second literal is drawn at `dy=1em`, on top of line 2. The causes are in `parse_markdown_it`: paragraphs separated by a blank line get no break, an indented line becomes a code block and is dropped, and ordered lists and headings lose their markers. The markdown branch also ignored `line_number`, and the plain branch counted `<text>` tags instead of lines.

## Root cause and change
1. **Typing directly in the viewport** (new `bim.edit_text_in_viewport`, "Type Text In Viewport"):
   - A modal operator edits a literal in place, and the viewport decorator draws the live text with a `|` caret.
   - Keys: Enter = new line, Tab = tab, Backspace/Delete (Ctrl = by word), arrows, Home/End (Ctrl = whole text), Ctrl+V = paste, Ctrl+B / Ctrl+I = toggle markdown bold/italic on the word at the caret (or insert an empty pair to type into).
   - Ctrl+Enter or left click saves through the existing `bim.edit_text`. Esc or right click restores the original value. Middle mouse, wheel and trackpad keep navigating the viewport. AltGr characters (for example `@` on many layouts) still type.
   - Entry points: Alt+T in the Annotation tool (listed as "Type Text" next to "Edit Text"), a "Type Text In Viewport" button in the Text panel, and a per-literal button while editing in the panel. If the panel was already in edit mode, it stays open after the modal ends.
2. **Printing what was typed** (`svgwriter.py`):
   - `parse_markdown_lines()` parses each printed line on its own.
   - Only bullets and inline formatting are interpreted. Headings, quotes, numbered lists, horizontal rules and code fences are escaped so their characters print as typed.
   - Indentation, tabs (4-column stops) and runs of spaces become non-breaking spaces, which neither SVG nor markdown collapses.
   - Both the real line break and the legacy `\n` escape start a new line.
   - The markdown branch moved into `create_markdown_text_tag()`, which offsets by `line_number` and returns its line count. Following literals no longer overlap, and the plain branch now counts lines.
3. **Viewport preview** (`decoration.py`): splits on both line-break forms, expands tabs, and draws the caret while typing.
4. Pure-Python logic (edit buffer, key mapping, whitespace and markdown helpers) lives in the new `bim/module/drawing/text_editing.py`, so it can be tested without a UI.

Files: `bim/module/drawing/{text_editing.py (new), svgwriter.py, decoration.py, operator.py, ui.py, workspace.py, __init__.py}`, `test/bim/module/drawing/test_text_editing.py` (new).

## Validation (focused)
Blender 5.2.2 headless, with the Bonsai extension enabled from this tree and ifcopenshell 0.9.0. pytest ran inside Blender with `-p no:pytest-blender`, the equivalent of `make test-bim` / `make test-tool` limited to these files:
```
pytest test/bim/module/drawing/test_text_editing.py -v
  -> 32 passed in 0.34s
     (edit buffer and keys, emphasis toggling, whitespace and markdown escaping, SVG tspans and line offsets,
      caret display, plus an end-to-end test: create project -> drawing -> TEXT annotation with a
      multiline/tab literal + second literal -> bim.edit_text -> IFC write/read round trip -> bim.create_drawing
      -> asserts the printed tspans: 0em "First line", 1em indent + "Indented", 3em "Bold", 4em "1. kept", 5em "Second literal")
pytest test/bim/module/drawing/ test/tool/test_drawing.py test/bim/test_feature.py \
  -k "test_text_editing or segment_clipping or gizmo or text or literal or create_drawing or annotation"
  -> 98 passed, 731 deselected in 5.82s   (existing text, annotation and create-drawing regressions included)
ruff format --check / ruff check on all touched files -> clean
git am fix.patch on a clean v0.9.0 checkout -> applies, identical tree
```
STEP round trip: newline and tab are written as `\X2\000A0009\X0\` and read back unchanged.

### Blender-runtime checks for the submitter (interactive UI; modal keyboard events cannot run headless)
1. Annotation tool, select a TEXT annotation, press **Alt+T**. Type `Hello`, Enter, Tab, `world`. The viewport shows two lines with a caret, and the status bar shows line and column.
2. Put the caret on `world`, press Ctrl+B, and check it becomes `**world**`. Ctrl+Enter saves. Create the drawing: the SVG shows the second line indented and bold.
3. Alt+T again, type something, press Esc. The text goes back to its previous value.
4. While typing, middle-mouse orbit and wheel zoom still work. Left click finishes.
5. Text panel: the "Type Text In Viewport" button works. In panel edit mode, the per-literal type button edits that literal and the panel stays in edit mode afterwards.

## Competition
- **#9686 (BIMvoice, open, unreviewed, v0.9.0)**: "real multiline entry". It opens the literal in a separate Blender Text Editor window with an "Apply Text" button. It does not change `svgwriter.py`, so real line breaks still go through the old markdown path: blank lines are lost, lines starting with "1." or "#" are dropped or merged, indentation and tabs collapse, and multiline literals overlap. It also has no bold/italic entry.
- Ours goes further: typing happens in the viewport itself, which is what the issue literally asks for, and the printed SVG keeps line breaks, blank lines, tabs and indentation. It also fixes the multi-literal overlap, with an end-to-end test.
- Possible textual overlap: #9686 edits the same `ui.py` lines (literal row in `draw_text_editing_ui`) and `decoration.py` line. If it merges first, a trivial rebase is needed.
- BIMvoice has 113 merged PRs in the repo, so maintainers do merge outside contributors.
- Earlier closed PR #8799 (v0.8.0) was replaced by #9686.

## AI-disclosure requirement (upstream rule)
`AGENTS.md` at the repo root requires a note in the commit body, a header comment in new files, and a statement in the PR description whenever code is AI-generated. The patch carries the repo's exact wording ("Generated with the assistance of an AI coding tool." / "This file was generated with the assistance of an AI coding tool."), and the PR body below includes it. Competing PRs (#9686, #9330) include the same disclosure.

## How to apply
```
git clone https://github.com/IfcOpenShell/IfcOpenShell && cd IfcOpenShell
git checkout -b bonsai-6427-type-text origin/v0.9.0
git am /path/to/fix.patch
```

## Ready-to-paste PR
**Title:** `Bonsai: type text annotations in the viewport with Enter, Tab, bold and italic`

**Body:**
```
Closes #6427 (OSArch D&D Phase 1 Item 06 - Edit text using tab, enter etc).

Text annotations can now be typed directly in the viewport:

- New "Type Text In Viewport" operator (`bim.edit_text_in_viewport`): Alt+T in the Annotation tool, a button in the
  Text panel, and a per-literal button while editing in the panel.
- Enter starts a new line, Tab inserts a tab, Backspace/Delete/arrows/Home/End work (Ctrl = by word / whole text),
  Ctrl+V pastes, Ctrl+B / Ctrl+I toggle markdown bold / italic on the word at the caret.
- Ctrl+Enter or left click saves (through `bim.edit_text`), Esc or right click cancels. Viewport navigation keeps working.
  The viewport draws a caret and the status bar shows line and column.

Printed drawings now keep what was typed. Each line of a literal is parsed on its own, so:
- blank lines are kept (previously "A\n\nB" printed "AB" on one line),
- indentation, tabs and repeated spaces are kept as non-breaking spaces (previously collapsed, and an indented line
  became a markdown code block and disappeared),
- lines starting with "1.", "#", ">" or "---" print as typed (previously the markers were dropped and lines merged),
- the older `\n` escape still works, including next to bold/italic,
- a literal following a multiline literal no longer overlaps it (the markdown branch ignored `line_number`).

Multi-edit was already possible with "Copy Text To Selection", and bold/italic markup was already supported when printing.

Tests: `test/bim/module/drawing/test_text_editing.py` (32 tests, including an end-to-end drawing with a multiline,
tabbed, bold literal and a second literal). Existing drawing/text/annotation tests and the BDD text and create-drawing
scenarios pass. ruff format/check clean.

AI disclosure (per AGENTS.md): this contribution (code, tests and this description) was generated with the assistance
of an AI coding tool.

Bounty: this implements the OSArch-funded Open Collective project "Bonsai: Edit text using tab, enter etc"
(https://opencollective.com/bonsai-edit-text-using-tab-ent). I'm claiming that project's bounty and request the payout
to me through an Open Collective expense once this is merged.
```

## Open Collective payout steps (after merge)
1. Comment on #6427 with the PR link and a note that you are implementing this project (the OC page asks developers to "ping us at the issue"). Ask the OSArch steering committee (theoryshaw / Ryan Schultz is the D&D organiser) to confirm completion.
2. Sign in to Open Collective as the submitter (woahwhattheheck profile, with a PayPal or bank payout method set up).
3. Open https://opencollective.com/bonsai-edit-text-using-tab-ent/expenses/new (or the project page, then **Submit Expense**).
4. Choose **Invoice**. Description: `IfcOpenShell PR #<PR number>: Bonsai type text in viewport (D&D Phase 1 Item 06, issue #6427)`. Amount: **$92.50 USD**, the project balance, or the amount the steering committee confirms. Add the merged PR URL as the reference.
5. Choose the payout method and submit. OSArch approves and Open Source Collective pays out. Reply to any questions on the expense thread.
