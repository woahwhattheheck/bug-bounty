# HANDOFF: obsproject/obs-studio RFP #5076 (Scene Organization Tools), Open Collective $2,500

**Status:** HANDOFF. The proposal (`PROPOSAL.md`) is ready to post, and the implementation
(`fix.patch`, three commits) is complete for the RFP scope. It builds warning-free with `-Werror`
and has been validated on Linux (unit test, end-to-end runs of the real `obs` binary under Xvfb,
and a frontend API test plugin). Windows and macOS have no platform-specific code in this change
but have not been built here; see "Remaining work".

## Bounty

| | |
|---|---|
| RFP | https://github.com/obsproject/obs-studio/discussions/5076 (dodgepong, 2021-08-05; requirements extended by jp9000 2021-09-02) |
| Platform | Open Collective, OBS Project Bounty Program. Rules: https://github.com/obsproject/obs-studio/wiki/OBS-Project-Bounty-Program |
| Amount | $2,500 (raised from the original amount by jp9000 on 2021-09-02) |
| Payout evidence | The OBS Open Collective paid a $1,000 bounty expense on 2026-01-09 (coordinator discovery). |
| RFP status | Fenrirthviti (maintainer), 2026-01-07: "This RFP is still considered open and active." No proposal has been accepted. |
| Earlier proposals in the thread | Programatic (2021, separate JSON file; jp9000 objected to the separate file), Azeirah (2021, search + colors, then folders), cg2121 (2022, idea only), TheLostShip (2023, ImGui code that does not fit OBS), singhvishalkr (2026-05-16; Fenrirthviti replied on 2026-05-24: "This proposal reads extremely AI-generated, and we are not accepting any AI-generated submissions."). |
| Competing PRs | None found for scene folders (PR searches for "scene folder", "scene tree", "scene groups", "5076"). |
| Related open PR | #13622 "frontend: Clean up and adjustments to SceneTree" (Warchamp7, opened 2026-07-04, approved by RytoEX and PatTheMav, "Ready For Merge" on the 33.1 tracker). It refactors the same `SceneTree.cpp`/`.hpp` (grid recalculation, eventFilter, deferred `scenesReordered`). After it merges, this patch's `SceneTree` changes need a rebase; see "Remaining work". |

## Contribution policy facts (for the submitter)

- On this RFP, maintainer Fenrirthviti stated on **2026-05-24**: "we are not accepting any
  AI-generated submissions" (in reply to another proposal).
- `CONTRIBUTING.md` ("AI/Machine Learning Policy") says that "All text and content submitted to our
  project, which includes code, descriptions, issues, and comments, must be **human written**". It
  also says that low-effort or incorrect submissions created with the aid of such tools may lead to
  a ban.
- The OBS pull request template (obsproject/.github `pull_request_template.md`) requires the human
  submitter to disclose AI/LLM tooling use. It states that authors who do not follow this guidance
  "or lie will be permanently banned from the project".
- The proposal text, code, commit messages and PR text in this directory were produced by an AI
  agent. The submitter handles these requirements, for example by writing the proposal and PR text
  in their own words and reviewing the code. The PR draft below fills in the template's AI
  disclosure line truthfully.

## Submission process (as documented by the OBS bounty program)

1. Post the proposal as a reply on discussion **#5076**. The program asks for mockups for UI
   changes; use the `screenshots/` (all taken from the working build).
2. The program's flow: the OBS team refines and accepts one proposal (status "In Progress"). The
   implementation is then submitted as a draft PR in obsproject/obs-studio. The draft is marked
   ready when complete, and review feedback is answered. The program can release a bounty after two
   weeks without commits or interaction.
3. After the PR is merged into `master`, submit an Open Collective expense (invoice) for $2,500 to
   the OBS Project / OBS Project Bounty Program, referencing RFP #5076 and the merged PR URL. OBS
   team members confirm it, and the Open Source Collective pays out.

### Ready-to-paste proposal comment (discussion #5076)

> Hi! I'd like to propose an implementation of the Scene Organization Tools RFP. The full proposal
> is below. In short, it adds collapsible folders to the Scenes dock. Folders are purely
> organizational: they are not sources, the scene enumeration functions keep returning every scene
> in dock order, and nothing changes in libobs.
>
> For the file format I followed jp9000's comments. `scene_order` is still written as the complete
> flat list, folder membership is per-scene metadata in each scene's private settings, and the
> folder list (name, collapsed state, position) goes in a new `scene_folders` key that older
> versions ignore. An older OBS loads every scene in the same order, and if it re-saves the
> collection, the folders come back when the collection is opened in a newer version again.
>
> It covers create/rename/remove, collapse/expand (indicator, double-click, keyboard), drag and drop
> into, out of and between folders (list and grid mode), "Move to Folder" in the context menu,
> undo/redo, multiview, studio mode and hotkey behavior, accessibility descriptions, en-US strings,
> and six `obs_frontend_*scene_folder*` API functions with a `SCENE_FOLDERS_CHANGED` event.
>
> I have a working implementation against current master, tested on Linux. The screenshots below
> are from that build. I'd appreciate feedback on the UX and the file format before opening the PR,
> and I'm happy to adjust anything.
>
> *(paste PROPOSAL.md here; attach the images from `screenshots/`)*
>
> I'm requesting the $2,500 Scene Organization Tools bounty for this work, paid through the OBS
> Project Open Collective after the PR is merged.

## What was built

- **Patch:** `fix.patch`, three commits from `git format-patch` against
  `master@e7f0b0d43c538f5d108aa4cbea473d57b3012a1a`, author
  `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`. 24 files, +2544/−63.
  Commit 1 only adds a standalone model and its test. The state after commit 2 was also built on
  its own with `-Werror`.
  1. `frontend: Add scene tree layout model`: `frontend/models/SceneTreeLayout.{hpp,cpp}` (no Qt):
     layout build/flatten, `scene_folders` (de)serialization, undo snapshot JSON, plus
     `test/cmocka/test_scene_tree_layout.cpp` and its `CMakeLists.txt` entry.
  2. `frontend: Add folders to the Scenes dock`: changes in `SceneTree` (folder rows, collapse,
     drag/drop in list and grid mode, keyboard, move up/down, layout apply), `SceneRenameDelegate`
     (indicator painting, indentation, editor placement), a new `widgets/OBSBasic_SceneFolders.cpp`
     (load/save, private-settings sync, context menus, rename/remove, undo), and folder-awareness in
     `OBSBasic_Scenes.cpp`, `OBSBasic_SceneCollections.cpp`, `OBSBasic_SceneItems.cpp`,
     `OBSBasicTransform.cpp`, `OBSStudioAPI.cpp` (`obs_frontend_get_scenes` skips folder rows), and
     21 en-US strings.
  3. `obs-frontend-api: Add scene folder functions`: `obs_frontend_get_scene_folder_names`,
     `obs_frontend_get_scene_folder`, `obs_frontend_get_scene_folder_scenes`,
     `obs_frontend_add_scene_folder`, `obs_frontend_remove_scene_folder`,
     `obs_frontend_set_scene_folder`, `OBS_FRONTEND_EVENT_SCENE_FOLDERS_CHANGED` (appended, ABI-safe),
     and docs in `docs/sphinx/reference-frontend-api.rst`.
- **File format:** see PROPOSAL.md §3. Collections without folders are written exactly as before.
- **Design:** the dock stays a `QListWidget` (keeps grid mode and the more than 60 places in the
  frontend that use `ui->scenes`). Folder headers are extra rows, and membership is a per-row flag
  normalized by `SceneTree::UpdateFolders()`.

## Validation (Linux, Ubuntu 24.04)

Environment: master CI targets Ubuntu 26.04, and master needs FFmpeg ≥ 8.0 and a newer Qt than
24.04 ships. For local validation only (none of this is in the patch):
- FFmpeg 8.0 was built from source into a private prefix.
- Qt 6.11.1 (the obs-deps version) was installed with `aqtinstall`.
- `-DCMAKE_PROJECT_INCLUDE=validation/scripts/local-minimal-build.cmake` built only the modules the
  frontend needs to start (rtmp-services, obs-ffmpeg, obs-x264, obs-transitions); browser,
  websocket and the other plugins were left out.

```sh
cmake -S . -B build_scenes -G Ninja -DOBS_VERSION_OVERRIDE=33.0.0 -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_PREFIX_PATH="<qt-6.11.1>/gcc_64;<ffmpeg-8.0-prefix>" -DENABLE_CORE_MODULES=OFF \
  -DENABLE_SCRIPTING=OFF -DENABLE_WHATSNEW=OFF -DENABLE_WAYLAND=OFF -DENABLE_PULSEAUDIO=OFF \
  -DENABLE_PORTABLE_CONFIG=ON -DCMAKE_PROJECT_INCLUDE=<validation/scripts/local-minimal-build.cmake>
ninja -C build_scenes obs-studio libobs-opengl rtmp-services obs-ffmpeg obs-x264 obs-transitions
```
→ `[122/122] Linking CXX executable frontend/obs`. The build uses `-Werror` and finished with no
warnings, for both the final state and the state after commit 2.

**1. Unit test** (`test/cmocka/test_scene_tree_layout.cpp`; `test/cmocka` is not wired into the
top-level CMake on master, so it was compiled directly):
```sh
g++ -std=c++17 -Wall -Wextra -Werror -I frontend -I libobs -I build_scenes/config \
  test/cmocka/test_scene_tree_layout.cpp frontend/models/SceneTreeLayout.cpp \
  -L build_scenes/libobs -lobs -lcmocka -o test_scene_tree_layout && ./test_scene_tree_layout
```
→ `[  PASSED  ] 8 test(s).` (`validation/unit-test-output.txt`): flat order/positions, save→load
round trip, collection without folders, older version loads every scene, older-version re-save
keeps folders, older-version reorder, invalid folder data, undo serialization.

**2. End-to-end, real `obs` under Xvfb** (`validation/scripts/run_case.sh`, inputs and outputs in
`validation/e2e/`):

| Case | What | Result |
|---|---|---|
| case1 | Load a collection with 3 folders (one collapsed, one empty), then save on exit (SIGTERM) | `scene_order`, `scene_folders` and every scene's private settings are byte-for-byte equal to the input. The log lists the folders (`- folder 'Gameplay'` …). Screenshot 01. |
| case2 | xdotool: expand "Components", drag "Ending" onto "Empty Folder", drag "BRB" to the top, Ctrl+Z, Ctrl+Y, collapse "Gameplay" | Saved order `BRB, Starting Soon, Game, Game + Cam, Ending, Webcam Frame, Alerts`. Folders: Gameplay collapsed pos 2, Empty Folder pos 4, Components pos 5. `Ending.scene_folder = "Empty Folder"`. Screenshot 02. |
| case3 | case2 output with `scene_folders` removed (what an older OBS writes back) | All 3 folders were rebuilt from private settings at the same positions (expanded), and `scene_folders` was written again. |
| case4 | Legacy collection without folders | `scene_order` and all private settings unchanged, and no `scene_folders` key was written. |
| case5 | Context menus: Move to Folder → New Folder…, inline rename, remove an empty folder + undo, remove a non-empty folder (confirmation), delete a scene inside a folder + undo, grid mode | All behaved as designed. Saved JSON: `Intro{Starting Soon}`, Game, Game + Cam (moved out when "Live" was removed), Empty Folder, BRB, `Components{…}`, Ending. Screenshots 03–07. |
| case8 | Grid mode: drag the "Ending" tile next to "Game" | Saved `Ending.scene_folder = "Gameplay"`, order `…, Game, Ending, Game + Cam, …`. Screenshot 08. |
| case7 | Open the windowed multiview | The multiview window opens with the scene grid (from `obs_frontend_get_scenes()`, dock order), and the program scene's cell is highlighted. Scene names are not drawn because the text plugin was not built, so per-cell identity was not checked visually. |

**3. Frontend API** (`validation/scripts/scene-folder-api-test.c`, loaded via `OBS_PLUGINS_PATH`,
log in `validation/frontend-api-test-log.txt`):
- All six functions return the expected values, including the duplicate-add and
  missing-folder cases.
- `obs_frontend_get_scene_names()` returns only scenes.
- `OBS_FRONTEND_EVENT_SCENE_FOLDERS_CHANGED` fired 5 times for 5 changes.
- `obs_frontend_set_current_scene("Alerts")` (the same path as a scene hotkey) expanded the
  collapsed "Components" folder. Screenshot 09.

**4. Formatting:** `clang-format 22.1.8 --dry-run -Werror` (the version CI uses) passes on all
changed C/C++ files. `gersemi 0.25.4 --check` (the CI version) passes on all changed CMake files.

**5. Patch applies cleanly:** `git am fix.patch` on a clean `e7f0b0d` checkout gives tree
`0c68f49e9768b3dc1d5347745f1e4764daf7e5e8`, which is identical to the branch.

## How to apply

```sh
git clone https://github.com/obsproject/obs-studio && cd obs-studio
git checkout -b scene-folders e7f0b0d43c538f5d108aa4cbea473d57b3012a1a   # or current master
git am /path/to/fix.patch
```

## Remaining work

1. **Windows/macOS CI and a manual pass.** There is no platform code, but the painting (QStyle +
   theme stylesheet) and the macOS rename shortcut (Return) should be checked with the Yami and
   System themes.
2. **Rebase onto PR #13622** if it merges first. It rewrites the grid part of `SceneTree.cpp`
   (moves the grid calculation out of `resizeEvent`, removes `eventFilter` and the deferred
   `scenesReordered`). In this patch, `resizeEvent`, `RepositionGrid` and the grid branch of
   `dropEvent` need to adopt its new grid function, and the `GetVisibleItems()` logic carries over
   unchanged. Trying the PR's commits on `e7f0b0d` showed that the PR itself needs a rebase onto
   current master (its "Restore selection restriction" commit conflicts).
3. **The maintainers' answers** to PROPOSAL.md §11: auto-expand vs. highlight, a toolbar button,
   and where the unit test belongs.

## PR draft (open as a draft after the proposal is accepted)

**Title:** `frontend: Add scene folders to the Scenes dock`

**Body:**

```markdown
### Description
Adds collapsible folders to the Scenes dock, as proposed for the Scene Organization Tools RFP
(#5076). Folders are purely organizational: they are not sources, have no hotkeys, transitions or
filters, and the scene enumeration functions keep returning every scene in dock order.

- Add, rename (F2 / inline), and remove folders from the context menu. Removing a folder keeps its
  scenes at the same position.
- Collapse/expand with the theme's expand indicator (the same one used by Sources dock groups), by
  double-clicking, with Left/Right, or with "Expand/Collapse All Folders". Works in list and grid
  mode.
- Drag and drop scenes onto, into, out of, and between folders. Folders move with their scenes.
  "Move to Folder" in the scene context menu, including "New Folder…".
- Move Up/Down/Top/Bottom move scenes within their folder, and move folders as a whole.
- A scene that becomes current inside a collapsed folder (hotkey, studio mode, API) expands it.
- "Show Folder Scenes in Multiview" toggles all scenes of a folder.
- All folder edits and drag reordering are undoable. Undoing a scene removal restores the scene
  into its folder.
- Accessibility descriptions for folder rows and the scenes inside them.
- Frontend API: `obs_frontend_get_scene_folder_names`, `obs_frontend_get_scene_folder`,
  `obs_frontend_get_scene_folder_scenes`, `obs_frontend_add_scene_folder`,
  `obs_frontend_remove_scene_folder`, `obs_frontend_set_scene_folder` and
  `OBS_FRONTEND_EVENT_SCENE_FOLDERS_CHANGED` (documented).

File format, backward compatible:
- `scene_order` still holds every scene in dock order.
- Folder membership is stored per scene in private settings (`scene_folder`).
- The folder list is stored in a new `scene_folders` key.

As a result, older versions load every scene in the same order, and folders survive a re-save by
an older version. Collections without folders are written exactly as before.

(screenshots)

### Motivation and Context
Implements the Scene Organization Tools RFP: https://github.com/obsproject/obs-studio/discussions/5076
Closes #5076

This PR is the implementation of the accepted proposal for the OBS Project "Scene Organization
Tools" bounty ($2,500). I'm claiming this bounty: once this PR is merged, I will submit an Open
Collective expense to the OBS Project referencing #5076 and this PR, and I'm requesting the bounty
payout at that point.

### How Has This Been Tested?
- Unit test `test/cmocka/test_scene_tree_layout.cpp` (8 cases): save/load round trip, collections
  without folders, collections loaded or re-saved by older versions, and invalid data.
- Ubuntu 24.04 (Qt 6.11.1, FFmpeg 8.0), with the real `obs` binary and scripted collections:
  - load/save round trip;
  - expand, drag into a folder, reorder, undo, redo, collapse;
  - a collection re-saved without `scene_folders`;
  - a legacy collection (unchanged on save);
  - new folder from "Move to Folder", rename, remove (with confirmation), deleting a scene inside a
    folder and undoing it;
  - grid mode drag;
  - windowed multiview.
- A test plugin calling all new frontend API functions and checking the new event and that
  `obs_frontend_get_scenes()` never returns folders.
- clang-format 22 and gersemi checks pass.

### Types of changes
- New feature (non-breaking change which adds functionality)
- Documentation (a change to documentation pages)

### Checklist:
- [x] I have read the [**contributing** document](https://github.com/obsproject/obs-studio/blob/master/CONTRIBUTING.md).
- [x] My code has been run through [clang-format](https://github.com/obsproject/obs-studio/blob/master/.clang-format).
- [x] My code follows the project's [**style guidelines**](https://github.com/obsproject/obs-studio/blob/master/CODESTYLE.md)
- [x] My code is not on the master branch.
- [x] My code has been tested.
- [x] All commit messages are properly formatted and commits squashed where appropriate.
- [x] I have included updates to all appropriate documentation.

- [x] I have used AI tooling in the creation of this PR
```

## Files in this directory

- `fix.patch`: three commits (`git am`).
- `PROPOSAL.md`: the full RFP response.
- `screenshots/01…09-*.png`: taken from the working build under Xvfb (Yami theme).
- `validation/unit-test-output.txt`, `validation/frontend-api-test-log.txt`.
- `validation/e2e/*.json`: inputs and outputs. case2, case5, case6 and case8 use
  `case1-input.json` as their input.
- `validation/scripts/`: `make_collection.py`, `run_case.sh`, `case2_actions.sh`, `run-obs.sh`,
  `local-minimal-build.cmake` (local build helper only), `scene-folder-api-test.c`.
