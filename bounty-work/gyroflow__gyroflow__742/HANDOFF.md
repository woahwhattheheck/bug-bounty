# HANDOFF · gyroflow/gyroflow#742 via PR #1244 · Algora $500

**Status: HANDOFF.** Help-request deliverable for the existing carrier PR. It contains:

- `demo.mp4`: the full-app demo
- `DEMO.md`: provenance
- `fix.patch`: a blocking registration bug fix that PR #1244 needs before the demo applies to its head

| | |
|---|---|
| Issue | https://github.com/gyroflow/gyroflow/issues/742 ("Refactor lens profile handling"), open, :gem: Bounty |
| Bounty | Algora, $500. https://algora.io/gyroflow/bounties lists #742 $500 (7 claims), #45 $500 and #150 $200 as open, with a "Completed" count of 2 (payout evidence for the org). |
| Carrier | https://github.com/gyroflow/gyroflow/pull/1244 by @woahwhattheheck. Open, 4 commits, head `a89f905d462f23d454454df98f6b9937c3e71d30` (re-read 2026-10-08), no reviews yet. Body already contains `/claim #742` and the payment request, and says the demo video is pending. Companion data PR gyroflow/lens_profiles#39. |
| Work order | Slack C0BU51F1PL3 ts 1791430109.891379 (SWE2-GYROFLOW742-FULLAPP-DEMO-R1) |
| Base | PR head `a89f905d` (merge-base with upstream master `77b49409f6016d17e58e88d6a0914616bee6296e`) |

## Finding: PR head does not load the main window

I built the full app at `a89f905d` (Qt 6.4.3, ffmpeg 9.0, OpenCV 4.12.0, MDK 0.39.0, rustc 1.97) and ran it under Xvfb. The UI fails in **both** build modes:

```
qrc:/src/ui/menu/LensProfile.qml:231:5: CameraLensSelector is not a type
qrc:/src/ui/App.qml:176:17: Type Menu.LensProfile unavailable
qrc:/src/ui/main_window.qml:140:13: Type App unavailable
QQmlApplicationEngine failed to load component
```

Root cause: the new component is not registered.
- `cargo build --profile deploy` (`just deploy`, used for releases) compiles QML and resolves component types only via `src/ui/components/qmldir`. The PR has no `CameraLensSelector` line there.
- `cargo build --release` (`just run`) embeds QML via the explicit `qrc!` list in `src/resources_qml.rs`. `CameraLensSelector.qml` and `CameraCatalog.js` are missing from that list.
- On `master`, every `src/ui/components/*.qml` is in both lists, so this regression comes from the PR.

The earlier PR validation used a standalone Qt fixture that loaded the QML from disk, so it could not catch this. A maintainer running `just run` or `just deploy` on the current head gets an empty window.

## Fix (`fix.patch`)

Commit `1dd5ad89e4d6ddf3e0b499360892e108869bc7c8` on top of `a89f905d`, author woahwhattheheck, message `fix(ui): register CameraLensSelector so the main window loads` (Refs #742). Resulting source tree: `74e2508f055ac0e4e94bebf7025cfab10bfe3940`.

| File | Change |
|---|---|
| `src/ui/components/qmldir` | `+CameraLensSelector 1.0 CameraLensSelector.qml` |
| `src/resources_qml.rs` | `+"src/ui/components/CameraCatalog.js",` `+"src/ui/components/CameraLensSelector.qml",` |

3 insertions, no behaviour change. With the fix, every `src/ui/**/*.qml|js` is in the `qrc!` list and every component `.qml` is in `qmldir`; the same comparison against master shows no gaps.

Apply on the PR branch:
```bash
git checkout work/camera-lens-catalog-742      # head a89f905d
git am --keep-cr fix.patch                     # both files use CRLF; plain `git am` strips CRs and fails
git rev-parse HEAD^{tree}                      # expect 74e2508f055ac0e4e94bebf7025cfab10bfe3940
# (`git apply fix.patch` gives the same tree; verified both ways)
```

## Validation (focused; no test suites run)

| Command | Result |
|---|---|
| `cargo build --release --locked` at `a89f905d`, run under Xvfb | main window fails, log above (`evidence/exact_head_release_build_qml_error.txt`) |
| `cargo build --profile deploy --locked` at `a89f905d` (13 min 28 s full), run under Xvfb | same failure (`evidence/exact_head_deploy_build_qml_error.txt`) |
| `cargo build --release --locked` at `1dd5ad89` (incremental, 1 min 33 s), run | main window loads, 0 QML warnings, "Loaded 12409 lens profiles", selector UI visible (`evidence/fixed_release_build_main_window.png`) |
| `cargo build --profile deploy --locked` at `1dd5ad89` (incremental, 6 min 46 s), scripted run | main window, selectors, review, calibrator and validation all work. That is the recorded demo. |
| list check: `comm` of `src/ui/**/*.qml|js` vs `qrc!` list, and components `*.qml` vs `qmldir` | no missing entries after the fix (and none on master) |

## Demo (`demo.mp4`; details in `DEMO.md`)

Recording facts: one continuous, unedited take of the real app, driven by xdotool X11 input. Built with `--profile deploy` from tree `74e2508f` = `a89f905d` + `fix.patch`.

| | |
|---|---|
| Format | h264 High@4.0, yuv420p, 1280×864, 15 fps, 167.4 s, 2,087,729 B |
| sha256 | `5d56fccd471717ff63d034400f723c428bae950c56d541a1bee41aa051f0d010` |

Content:
1. **Selectors (0:27).** Apple → iPhone 12 → Wide lists 3 calibrated submissions; Load.
2. **Review (0:48).** Next; Hide profile locally (the replacement loads); Show hidden profiles; Restore.
3. **Calibrator + submission validation (1:03).** Real OpenCV calibration of a generated chessboard clip (RMS 0.107). Export with upload checked:
   - With no identity, the upload is refused with 3 messages.
   - With Canon 1100D + Canon EF 18-55mm (a zoom) and no focal length, the upload is refused.
   - After setting 18 mm, validation passes and the GPLv3 prompt appears. "No" saves locally and **nothing is uploaded**.

The calibration clip is generated input data (`repro/gen_chessboard.py`, known intrinsics fx = 620; the app recovered 619.8) and is labelled as such. The app itself is the full build. No fixture or harness appears in the video.

The video corresponds to the PR **after** `fix.patch` is pushed. It is not exact head `a89f905d`, which cannot render the UI. The caption bar in the video and DEMO.md both say this.

## Steps for the original-author publisher

1. Push `fix.patch` to `woahwhattheheck:work/camera-lens-catalog-742`, then check `HEAD^{tree}` = `74e2508f…`.
2. Attach `demo.mp4` to PR #1244: drag it into the PR body or a comment to get a `github.com/user-attachments/...` URL, or link the raw file on this branch.
3. Update the PR body:
   - Replace "The required full-application demo video remains pending."
   - Replace "A full desktop application build and native video-preview demonstration have not been run."
   - Use the block below in their place.

### Ready-to-paste PR body section (replaces the pending-demo text and the claim block)

```markdown
## Demo

Full desktop application on Linux x86_64 (Xvfb), built with `cargo build --profile deploy --locked` from this branch (source tree `74e2508f`): DEMO_LINK

- 0:27 Camera brand → model → lens selectors list the calibrated submissions for the chosen setup; Load applies one
- 0:48 Profile review: Next, Hide profile locally (the replacement row is loaded), Show hidden profiles, Restore
- 1:03 Lens calibrator with the same selectors; chessboard calibration in the app (RMS 0.107)
- 1:55 Upload validation: a missing brand/model/lens and then a zoom lens without its focal length are refused; with 18 mm set, the existing GPLv3 upload prompt appears ("No" saves the profile locally)

The latest commit registers `CameraLensSelector` in `src/ui/components/qmldir` and `src/resources_qml.rs` (with `CameraCatalog.js`). Without it the main window did not load ("CameraLensSelector is not a type") in both `just run` and `just deploy` builds.

## Contribution claim

Closes #742

/claim #742

I am claiming this implementation under @woahwhattheheck and requesting the Algora bounty payment for #742 on merge. Please confirm the assignment and the reward settlement.
```

## Competition

Algora shows 7 claims on #742. Our PR #1244 is the carrier, and this delivery fixes a load failure in it that would otherwise block review. Other claimants' PRs were not re-audited in this pass.

## Non-blocking observations (not changed)

- **Brand list case duplicates.** The brand list shows case variants as separate brands (ARRI/Arri, ASUS/Asus, AKASO/Akaso, BETAFPV/BetaFPV). `CameraCatalog.build` keys brands by the exact string from catalogue and profile records. A case-insensitive merge would tidy this.
- **No type-ahead in long dropdowns.** Gyroflow's `ComboBox` has no type-ahead, and the brand list has 257 entries, so reaching later brands means scrolling.

## Environment notes

- Expensify `node_modules` was not removed: another agent was actively running `tsc`/`eslint` in it.
- Build dirs for this lane are cleaned after delivery.
- No upstream writes were made: no PR, comment, push, claim or upload, and no network write from the app.
