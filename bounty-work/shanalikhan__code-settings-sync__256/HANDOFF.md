# HANDOFF · shanalikhan/code-settings-sync#256 · IssueHunt $100 · PARTIAL (HOLD, do not submit as-is)

**Issue:** https://github.com/shanalikhan/code-settings-sync/issues/256 (open, assigned to maintainer shanalikhan; CONTRIBUTING.md does not block assigned issues)
**Bounty:** https://oss.issuehunt.io/r/shanalikhan/code-settings-sync/issues/256 (status ready, deposit $100)
**Repo payout evidence:** IssueHunt repo data shows rewardedAmount $1,632 (163200 cents). Master history: 35 of the last 44 merge commits (400-commit window) are external PRs, so the maintainer merges outside work.
**Repo state:** not archived. Base branch for PRs per CONTRIBUTING is the version branch `v3.4.4`.

## Scope decision
The maintainer asked for: Gist/File System mode selection in the UI, renaming upload/download to Import/Export, a folder path in the local settings file, and UI updates. This patch implements only the storage backend and the switch:
- `fileSystemPath` in syncLocalSettings.json (CustomConfig) selects the FileSystem method.
- Upload exports the syncable user files into that folder; download imports them back.
- Gist behavior is unchanged when no folder is set.

It does not implement the UI or command rename, extension install on import, the summary page, custom files outside the User folder, lock-file handling, or forceDownload semantics. Competing PR #1483 covers more of this (see below), so this patch is a fallback. Submit only if #1483 is closed or stalls, or complete the remaining plan first.

## Root cause / change
No file-system backend exists. `ISyncService` already abstracts sync methods, and `FactoryService` maps `SyncMethod` values to services, so the new method plugs in there.
- `src/service/filesystem/filesystem.service.ts` (new): `FileSystemService implements ISyncService`. Export uses `FileService.ListFiles` with the existing ignore rules and writes files at the same relative paths. Import walks the folder, applies the same supported-extension and ignore rules, guards against path escape, and copies into `USER_FOLDER`.
- `src/enums/syncMethod.enum.ts`: adds `FileSystem`.
- `src/service/factory.service.ts`: registers `FileSystemService`.
- `src/models/customConfig.model.ts`: adds `fileSystemPath = ""`.
- `src/sync.ts`: `selectSyncMethod()` picks FileSystem when `fileSystemPath` is set, otherwise GitHubGist. Used by upload and download.
- `test/service/filesystem/filesystem.service.test.ts` (new): export filtering, import round trip, unconfigured no-op, IsConfigured.

## Files changed
src/enums/syncMethod.enum.ts, src/models/customConfig.model.ts, src/service/factory.service.ts, src/sync.ts, src/service/filesystem/filesystem.service.ts, test/service/filesystem/filesystem.service.test.ts (248 insertions, 4 deletions)

## Validation (focused only)
```
cd /home/user/work/clones/shanalikhan__code-settings-sync && git checkout fix/issue-256
npm install --ignore-scripts          # postinstall (VS Code binary download) skipped on purpose
npx tsc -p ./                          # only node_modules/@types/lodash syntax errors (TS 3.9.10 vs newer typings, pre-existing env issue); project sources: 0 errors
npx mocha out/test/service/filesystem/filesystem.service.test.js
  FileSystemService
    ✓ exports supported settings files and skips ignored ones
    ✓ imports exported files into another user folder
    ✓ does nothing when no folder is configured
    ✓ reports configured only when the folder exists
  4 passing (37ms)
npx eslint src/service/filesystem/filesystem.service.ts src/sync.ts src/service/factory.service.ts test/service/filesystem/filesystem.service.test.ts  → exit 0
npx prettier --check <touched files>  → all touched files pass (src/models/customConfig.model.ts was already not prettier-clean at base; only the one-line addition was made)
```
Not run: the VS Code extension-host suite (needs a VS Code download). tslint is not installed in this environment. The repo's `.eslintrc.yml` is what was used.

## Base / apply
Base: `origin/v3.4.4` @ cd93cdeacab7c010b2445cb78e6422b18c872df0 (`git log` head of the v3.4.4 branch at fetch time)
Apply: `git am fix.patch` (author woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>). Verified: applies cleanly on the base and the tree matches the branch.

## Competing PRs
- #1483 `feat: add filesystem settings import and export` (AIVensk, OPEN, base v3.4.4, 2 commits, addresses #256). Reviewer woahwhattheheck requested nested `finally` cleanup in `FileSystemStore.write`. More complete than this patch (it has a store with lock handling).
- #1469 `feat: add local filesystem sync service` (landeqiming666, OPEN, base master, "Related to" #256). No maintainer response.

## PR draft (for use only if submitted; scope is partial, so use Refs, not Closes, unless the remaining plan is done)
Title: feat(sync): add file system sync method for a settings folder (#256)

Body:
```
Adds a FileSystem sync method next to GitHubGist. When fileSystemPath is set in syncLocalSettings.json, upload exports the syncable user settings files into that folder and download imports them back. The gist path is unchanged when no folder is configured.

Export and import reuse FileService.ListFiles and the existing ignoreUploadFiles/ignoreUploadFolders/supportedFileExtensions rules.

Not included yet (see remaining plan): UI mode selection, the Import/Export command rename, extension install on import, summary page, custom files outside the User folder.

Validation: npx tsc -p ./ (project sources clean), npx mocha out/test/service/filesystem/filesystem.service.test.js (4 passing), eslint clean on touched files.

Refs #256. Claim on IssueHunt after merge: https://oss.issuehunt.io/r/shanalikhan/code-settings-sync/issues/256
Requesting the IssueHunt payout for #256 when this merges.
```

## Remaining plan (to make this a complete #256)
1. Settings UI: add a File System option and folder picker to the settings webview; persist via SetCustomSettings.
2. Rename the commands to Import/Export per the maintainer's list, keeping the existing command ids as aliases.
3. Extension list on export and install/uninstall on import (reuse GistService logic via shared helpers).
4. Custom files (customFiles map) and the summary page.
5. Lock-file behavior and forceDownload/forceUpload semantics for the folder path.
6. Compare against #1483 and merge the best parts of both.
