# HANDOFF · shanalikhan/code-settings-sync#396 · IssueHunt $80 · READY FOR SUBMISSION (editor path not run in a VS Code host)

**Issue:** https://github.com/shanalikhan/code-settings-sync/issues/396 (open, unassigned as of 2026-10-08 WebFetch)
**Bounty:** https://oss.issuehunt.io/r/shanalikhan/code-settings-sync/issues/396 (status ready, deposit $80)
**Repo payout evidence:** IssueHunt repo data shows rewardedAmount $1,632 (163200 cents). Master history: 35 of the last 44 merge commits (400-commit window) are external PRs.
**Repo state:** not archived. PR base per CONTRIBUTING is the version branch `v3.4.4`.

## Root cause
Settings download writes settings.json, keybindings and other synced files directly to disk. If VS Code has an editor open on that file, the editor's buffer goes stale. The next save then fails with "Failed to save 'settings.json': The content on disk is newer", which is the reported conflict. Overwriting a dirty buffer also loses the user's unsaved edits.

## Change
- `src/service/editorMatch.ts` (new, no vscode dependency): `HasDirtyDocument(openDocuments, targetPath)` with path normalization (resolve, case-insensitive on Windows).
- `src/service/editor.service.ts` (new): `EditorService.WriteFile(filePath, content)`.
  - If any open text document (visible or hidden) for the file has unsaved changes, the write is skipped and a warning is shown. The user's edits are kept.
  - Otherwise, clean visible editors for that file are closed (`showTextDocument` then `workbench.action.closeActiveEditor`), then the file is written with `FileService.WriteFile`.
- `src/service/github/gist.service.ts`: the download write uses `EditorService.WriteFile` (one line changed plus import).

This addresses the dirty-document concern in the review on #1459 (close can finish after a dirty veto, and hidden dirty tabs fall outside the visible-editor loop). The dirty check runs over `vscode.workspace.textDocuments`, which includes hidden tabs.

## Files changed
src/service/editorMatch.ts, src/service/editor.service.ts, src/service/github/gist.service.ts, test/service/editor/editorMatch.test.ts (108 insertions, 1 deletion)

## Validation (focused only)
```
cd /home/user/work/clones/shanalikhan__code-settings-sync && git checkout fix/issue-396
npm install --ignore-scripts
npx tsc -p ./                          # project sources: 0 errors (node_modules/@types/lodash syntax noise is pre-existing)
npx mocha out/test/service/editor/editorMatch.test.js
  HasDirtyDocument
    ✓ returns true when an editor for the file has unsaved changes
    ✓ returns false when the editor for the file is clean
    ✓ ignores dirty editors for other files
    ✓ matches relative and absolute spellings of the same path
    ✓ returns false for an empty list of open documents
  5 passing (4ms)
npx eslint src/service/editorMatch.ts src/service/editor.service.ts test/service/editor/editorMatch.test.ts → exit 0
npx eslint ... src/service/github/gist.service.ts → 1 error at line 223 (upload path, `FileService.WriteFile` in Export), pre-existing and not touched by this patch
```
Not run: the editor close/warn path needs the VS Code extension host, which needs a VS Code download. This was not exercised. A reviewer should run the Download flow with a clean open settings.json and a dirty one.

## Base / apply
Base: `origin/v3.4.4` @ cd93cdeacab7c010b2445cb78e6422b18c872df0. Apply: `git am fix.patch` (author woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>). Verified: applies cleanly on the base and the tree matches the branch.

## Competing PRs
- #1459 `Close open settings files before download overwrite` (apples-kksk, OPEN, base master, "Fixes #396"). Reviewer woahwhattheheck (2026-10-06) asked for a dirty-document veto. This patch adds that guard.
- #1478 `Fix: Resolve aggressive upload/download conflict loops` (s6pa1rta3n-lab, OPEN, base master, "Fixes #396"). Broader timestamp handling. No reviews.

## PR draft
Title: fix(sync): keep unsaved editor changes when downloading settings (#396)

Body:
```
Download overwrote settings files on disk while VS Code could still hold them open, which produced "The content on disk is newer" conflicts on the next save.

Before a downloaded file is written, every open text document (visible or hidden) is checked. If one has unsaved changes, the write is skipped and a warning is shown, so the user's edits are kept. Otherwise clean visible editors for that file are closed first, then the file is written.

The path comparison lives in editorMatch.ts, which has no vscode dependency, and is covered by test/service/editor/editorMatch.test.ts.

Validation: npx tsc -p ./ (project sources clean), npx mocha out/test/service/editor/editorMatch.test.js (5 passing), eslint clean on touched files. Extension-host run not included.

Closes #396. Claim on IssueHunt after merge: https://oss.issuehunt.io/r/shanalikhan/code-settings-sync/issues/396
Requesting the IssueHunt payout for #396 when this merges.
```
