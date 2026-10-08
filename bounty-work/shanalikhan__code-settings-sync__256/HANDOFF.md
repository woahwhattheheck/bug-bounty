# HANDOFF · shanalikhan/code-settings-sync#256 · IssueHunt $100 · READY FOR SUBMISSION

This replaces the earlier PARTIAL handoff (FileSystem backend only, no UI, no command rename). It is a complete implementation of #256.

- **Issue:** https://github.com/shanalikhan/code-settings-sync/issues/256 (open; opened and assigned by maintainer shanalikhan, milestone v3.5.0; CONTRIBUTING.md does not restrict assigned issues and invites IssueHunt work)
- **Bounty:** https://oss.issuehunt.io/r/shanalikhan/code-settings-sync/issues/256 (re-checked 2026-10-08: status `ready`, deposit $100; registered submissions #1483 and #1469)
- **Payout evidence:** IssueHunt repo data shows $1,632 rewarded (`rewardedAmount` 163200) and $520 still active.
- **Base:** `v3.4.4` @ `cd93cdeacab7c010b2445cb78e6422b18c872df0`. CONTRIBUTING says to target the newest version branch, and `v3.4.4` is still the newest.
- **Commit:** `063f0a1` by `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`, 23 files, +2222 / -58.

## What #256 asks for (maintainer's own plan in the issue)

1. Choose the mode in the UI: GitHub Gist or File System.
2. Define the folder path in the local settings file.
3. Rename the existing commands to Import / Export.
4. Update the UI to match.
5. Use case: point the settings at a OneDrive or Dropbox folder so users can **view and email** them.

## What the patch does

**Config (`syncLocalSettings.json`)**
- Adds `"syncMethod": "GitHubGist" | "FileSystem"` (default GitHubGist).
- Adds `"fileSystemSettings": { "path", "lastUpload", "lastDownload" }`.

**`FileSystemService` (implements the existing `ISyncService`, registered in `FactoryService`)**
- Export writes the same set of files the gist upload sends, as plain readable files that mirror the User folder:
  - `settings.json`
  - `keybindings.json`, or `keybindingsMac.json` when exported from macOS
  - `snippets/…`
  - `extensions.json` (the extension list)
  - `customized_sync/…` (custom sync files)
  - `cloudSettings` (export timestamp and the list of exported files)
- Export applies sync pragmas, the ignore rules for files, folders and extensions, and custom files exactly as the gist upload does.
- Import works like the gist download:
  - keybinding selection per OS and `universalKeybindings`
  - pragma merge (`processBeforeWrite`)
  - extension removal and install with live output
  - restores this machine's `sync.*` options after `settings.json` is replaced
  - summary page and restart prompt (or a status message when quiet sync is on)
  - auto upload restarts afterwards
- Uses the gist flow's safety semantics:
  - Import skips when the folder holds the export this machine already applied, unless `forceDownload` is on. This matters for auto download on startup.
  - Export skips when nothing changed, unless `forceUpload` is on.
  - Export asks before overwriting an export that another machine made after this machine's last sync.
  - Files deleted locally are removed from the folder on the next export. Keybinding files are kept so a shared folder keeps the other OS's file, as with the gist.

**`FolderStore` (pure module, no `vscode` import, unit-tested)**
- Writes each file atomically (temp file plus rename).
- Holds `.settings-sync.lock` during an export. A stale lock from a crashed export (older than 2 minutes) is taken over. The cleanup steps are nested `try/finally` so each one runs even if an earlier one fails.
- Refuses to overwrite an export that landed while this one was running.
- Never follows symlinks out of the folder, and rejects names with `..`, empty segments or separators.
- Refuses folders that sit inside the VS Code User folder or contain it, comparing real paths in both directions.

**UI and commands**
- Settings page:
  - new **Sync Method** select
  - new **File System Folder** field with a **Browse** button that opens the native folder picker
  - saving a typed path trims it and resets the old folder's timestamps
  - invalid `syncMethod` values are ignored
- New command **Sync: Select File System Folder**, also added as an entry in Advanced Options.
- New **"Use a Folder Instead"** link on the welcome page. After a folder is picked, the Export or Import that opened the page continues.
- Upload and Download are retitled **"Sync: Export Settings (Upload)"** and **"Sync: Import Settings (Download)"**. Command ids and `Alt+Shift+U` / `Alt+Shift+D` are unchanged. All new strings are in `package.nls.json`; other locales fall back to English.
- Startup: in File System mode the GitHub landing page is skipped, and auto download / auto upload use the folder.
- Auto upload is allowed in File System mode even when `downloadPublicGist` is set.
- Sharing a public gist, or downloading one from Advanced Options, switches the method back to the gist.
- The summary output shows the folder instead of the token and gist ID.

**Two pre-existing settings-page bugs fixed along the way (both needed for this feature)**
- **Windows paths broke the page.** The page did ``JSON.parse(`<json>`)`` inside a template literal, so a Windows path broke the page script. For example, the existing `customFiles` value `C:\Users\…` fails with "Bad escaped character". The four data placeholders are now URI-encoded and decoded in the page. The placeholder replacement also uses a replacer function, so a `$&` in the data is no longer expanded.
- **Stale settings were saved back.** The page's message handler saved changes onto the settings object captured when the page first opened. That could revert changes made since by a command (folder picker, gist selection, reset). It now re-reads the settings before applying a change.

**Docs**
- README: a new "Export / Import Settings to a Folder (File System)" section, a feature-list entry, and the new command names. Diff is +24/-2 with CRLF line endings preserved.

## Files changed

- **New:**
  - `src/service/filesystem/folderStore.ts`
  - `src/service/filesystem/filesystem.service.ts`
  - `src/models/fileSystem.model.ts`
  - `test/service/filesystem/{folderStore,filesystem.service,settingsPage}.test.ts`
  - `test/service/filesystem/vscode.stub.ts`
- **Modified:**
  - `src/enums/syncMethod.enum.ts`
  - `src/models/{customConfig,settingType,webview}.model.ts`
  - `src/service/factory.service.ts`
  - `src/sync.ts`
  - `src/extension.ts`
  - `src/commons.ts`
  - `src/service/webview.service.ts`
  - `src/service/watcher/autoUpload.service.ts`
  - `ui/settings/settings.{js,html}`
  - `ui/landing-page/landing-page.html`
  - `package.json`
  - `package.nls.json`
  - `README.md`

## Validation (focused)

Environment: Node 22, the repo's own `npm install --ignore-scripts` (the postinstall VS Code download is skipped).

```
# Type check. The repo's TS 3.9 cannot parse today's @types/* (pre-existing env drift),
# so the type gate is TS 4.9.5 from a scratch dir, run with --noEmit:
tsc(4.9.5) -p ./ --noEmit                      -> exit 0   (also exit 0 on base v3.4.4)

# Lint, using the repo's ESLint config and the same command the lint-eslint script runs:
npx eslint --ignore-path .gitignore --ext .ts src
                                               -> 20 problems on base v3.4.4, 20 with this patch (0 new).
                                                  All 20 are pre-existing, in untouched lines.
npx prettier --check <new files> ui/settings/settings.js
                                               -> clean (settings.js was clean at base and still is)

# Build with the repo's TS (emits out/ despite the node_modules typings errors) and run only the new tests:
npx tsc -p ./
npx mocha out/test/service/filesystem/folderStore.test.js \
          out/test/service/filesystem/filesystem.service.test.js \
          out/test/service/filesystem/settingsPage.test.js
  FolderStore (20)
    names map/round-trip and escape rejection; CheckFolder (relative, inside, containing, symlinked user folder);
    keybinding export/import matrix; IsUpToDate / HasNewerExport; ignore patterns;
    write + list with ignore rules; stale-file removal keeps keybindings and foreign files;
    HasChanges including dropped files; symlinks never followed (read, list, write);
    lock held -> refused; stale lock taken over; concurrent export detected; invalid cloudSettings
  FileSystemService (8)  [real service, PragmaUtil, PluginService, localize; vscode API stubbed]
    macOS export -> Linux + macOS import (pragmas, keybindingsMac, snippets, custom file, extension list, timestamps);
    up-to-date import skipped unless forceDownload; newer-export prompt (No keeps the folder, Yes replaces it);
    unchanged export not rewritten and deleted snippet removed; folder picker when unset switches to FileSystem;
    folder inside the User folder refused; empty folder reported; summary page shown
  Settings page File System options (4)
    Windows path with backslash/backtick/$& survives the page data; select + Browse definitions;
    invalid syncMethod ignored; typed path trimmed and timestamps reset
  32 passing
```

**Mutation check.** Breaking the macOS keybinding rule or removing the page-data encoding makes the suite fail (27 passing / 2 failing). Restoring them gives 32 passing again.

**UI smoke test** (jsdom 16 in a scratch dir, not part of the patch). I rendered the real settings page through `WebviewService` with the bundled jQuery, lodash and Bootstrap, using the path ``C:\Users\me\OneDrive\vs`code $& ${x} settings``. Results:
- The select shows `FileSystem`, and the path round-trips exactly.
- The button labels are `Browse` for the folder and `View` for the gist ID (unchanged).
- Clicking Browse posts `selectFileSystemFolder`.
- Changing the select posts `{command: "syncMethod", text: "GitHubGist", type: "global"}`.
- Typing a path posts `{command: "fileSystemSettings.path", …}`.
- The only script error is Bootstrap tooltip + Popper's `IndexSizeError` from jsdom having no layout engine. Bisected: it comes from the unchanged Environment-settings tooltips.

**Not run:** the VS Code extension-host suite (`Launch Tests`). It needs a VS Code download that isn't available here. Before submitting, do a two-minute check with F5:
1. Run "Sync: Select File System Folder" and pick a temp folder.
2. Run "Sync: Export Settings (Upload)" and check the files and the summary.
3. Edit `settings.json`, then run "Sync: Import Settings (Download)" with Force Download on.
4. Open Sync Settings and check the Sync Method select and the Browse button.

## How to apply

```
git checkout -b feat/filesystem-sync-256 origin/v3.4.4
git am --keep-cr fix.patch      # --keep-cr is required: README.md, src/commons.ts, src/extension.ts and
                                # ui/landing-page/landing-page.html use CRLF line endings.
                                # Plain `git am` fails; with --keep-cr it applies and reproduces commit 063f0a1's tree.
```

Open the PR against **`v3.4.4`**, not `master`.

## Competition, compared honestly

**#1483** (AIVensk; open, base v3.4.4, IssueHunt-registered, author's description says it claims no payment)
- It is solid. It stores everything in one `settings-sync.json` snapshot, with a lock and compare-and-swap, strict name validation (including Windows device names), and jsonc-based preservation of `sync.*`. It has a sync method select and a free-text path field, renames the titles to Import/Export, has wide tests, and its author reports native checks in VS Code 1.53.2.
- **Correction to the task brief:** #1483 has **no maintainer change request**. Its only review is a comment-type review on 2026-10-06 from **woahwhattheheck**, our submitter account, suggesting nested `finally` cleanup in `FileSystemStore.write`. No maintainer has commented on #1483 or any other #256 PR. Bryce should decide whether to submit a competing PR from the same account that reviewed #1483.

**Where this patch is ahead of #1483 on the issue as written:**

| Point | This patch | #1483 |
|---|---|---|
| Folder contents ("view and email") | Plain files in the User-folder layout | One JSON blob holding escaped file contents |
| Choosing a folder | Native picker: Browse button, command, Advanced Options, welcome-page link | Typed absolute path only |
| Auto download / auto upload | Import skips when already applied; export prompts only when another machine exported since the last sync (gist semantics) | Import confirms every time and export confirms every changed export unless the force flags are set, so auto download prompts on every start and auto upload prompts on every change |
| Gist-flow parity | Summary page and restart prompt | Status / info message |
| Localization | All new strings in `package.nls.json` | Hard-coded English |
| README diff | +24/-2, CRLF kept | Whole file rewritten, CRLF to LF (+359/-305) |
| New dependencies | None | Adds `jsonc-parser` |
| Settings page | Also fixes the stale-object bug | — |
| Lock cleanup | Each cleanup step always runs | Has the cleanup ordering issue our account flagged |

**Where #1483 is still ahead:** Windows reserved-device-name checks, and verification inside a real VS Code host.

**Other PRs**
- **#1469** (landeqiming666; base master, "Related to" #256, IssueHunt-registered): a small service plus tests, with no UI, no command changes and no wiring.
- **#1482** (younes-bkb; base master, not IssueHunt-registered): a UI selector, a text path and Export/Import commands. It targets the wrong branch and stores no timestamps.
- **#1484** (AIVensk): a separate Git-repository backend, not a #256 fix.

## Risks

- **Dormant maintainer:** the last merge into `v3.4.4` was 2022-11-08 (#1389), and there has been no maintainer response to any of the four #256 PRs since 2026-06. Even with the best implementation, merge timing is uncertain.
- **Branch name:** the old partial branch is kept as `fix/issue-256-partial` in the clone. `fix/issue-256` now holds this full commit.

## PR title

```
feat(sync): export and import settings to a file system folder (#256)
```

## PR body (ready to paste; follows the repo's PULL_REQUEST_TEMPLATE.md)

```
#### Short description of what this resolves:

Implements #256: a File System sync method next to GitHub Gist, so settings can be exported to and imported from a folder (OneDrive, Dropbox, network share, git checkout) and read or emailed as plain files. It follows the plan in the issue: the mode is chosen in the UI, the folder path lives in syncLocalSettings.json, and the existing commands become Export / Import.

#### Changes proposed in this pull request:

- `syncLocalSettings.json`: `syncMethod` (`GitHubGist` | `FileSystem`) and `fileSystemSettings` (`path`, `lastUpload`, `lastDownload`).
- `FileSystemService` (`ISyncService`) exports the same files as the gist upload (settings, keybindings / keybindingsMac, snippets, extension list, custom sync files, pragmas, ignore rules) as plain files mirroring the User folder, plus a `cloudSettings` timestamp. Import mirrors the gist download: per-OS keybindings, pragma merge, extension install/removal, summary page, restart prompt, and keeps this machine's `sync.*` options.
- Gist-style safety: import is skipped when already applied (unless Force Download), export is skipped when nothing changed (unless Force Upload), a prompt appears before overwriting a newer export from another machine, and files deleted locally are removed from the folder on the next export.
- `FolderStore`: atomic per-file writes under a lock file (stale locks are taken over), refuses to overwrite an export that landed mid-write, never follows symlinks out of the folder, rejects unsafe names, and refuses folders that overlap the User folder.
- UI: a Sync Method select and a folder field with a Browse button (native folder picker) on the settings page, a "Sync: Select File System Folder" command and Advanced Options entry, and a "Use a Folder Instead" link on the welcome page.
- Commands are titled "Sync: Export Settings (Upload)" and "Sync: Import Settings (Download)". Command ids and Alt+Shift+U/D are unchanged. Auto upload and auto download on startup work with the folder.
- Settings page: page data is URI-encoded so Windows paths (backslashes) no longer break the page script, and the page re-reads settings before saving a change.
- README section and focused mocha tests.

**Fixes**: #256

Closes #256

#### How Has This Been Tested?

- `mocha out/test/service/filesystem/{folderStore,filesystem.service,settingsPage}.test.js`: 32 passing. These cover FolderStore (naming, path safety, symlinks, lock, concurrent export, stale files, ignore rules), FileSystemService round trips (macOS export -> Linux/macOS import with pragmas, keybindingsMac, snippets, custom files, extension list, up-to-date and newer-export handling, folder picker, User-folder overlap) and the settings page (Windows path data, sync method validation).
- `eslint` (repo config) on `src`: no new findings compared to `v3.4.4`. `tsc --noEmit`: clean.
- Settings page rendered with a Windows path containing backslashes; the select, Browse and saving all work.
- Manual run in the Extension Development Host: select a folder, export, edit settings, import with Force Download, switch back to GitHub Gist.

#### Checklist:
- [x] I have read the [contribution](https://github.com/shanalikhan/code-settings-sync/blob/master/CONTRIBUTING.md#setup-extension-locally) guidelines.
- [x] My change requires a change to the documentation and GitHub Wiki.
- [x] I have updated the documentation and Wiki accordingly. (README updated; a Wiki page can mirror the new README section.)

This PR is submitted for the IssueHunt bounty on #256: https://oss.issuehunt.io/r/shanalikhan/code-settings-sync/issues/256. I will submit it on IssueHunt and request the $100 bounty payout when it is merged.
```

**Submitter notes**
- Only tick the "Manual run in the Extension Development Host" line after doing the F5 check above. Remove that line otherwise.
- After opening the PR, register it on the IssueHunt issue page ("Submit a pull request") so the payout routes to woahwhattheheck on merge.
