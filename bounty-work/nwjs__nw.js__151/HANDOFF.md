# nwjs/nw.js#151 — Startup Image / Animation support (splash)

| | |
|---|---|
| Issue | https://github.com/nwjs/nw.js/issues/151 (OPEN since 2012-11-07, label `feature-request`, unassigned) |
| Bounty | https://oss.issuehunt.io/r/nwjs/nw.js/issues/151 — IssueHunt **$276** (deposits of $20 on 2018-09-09 and $256 on 2018-09-17; status `funded`, not cancelled) |
| Payout evidence | The IssueHunt repo page for nwjs/nw.js shows **0 rewarded issues / $0 rewarded**, with $2,487 in active deposits across 13 issues. No IssueHunt reward has ever been paid on this repo, so a merge does not guarantee payout. |
| Status | **HANDOFF (source level).** The JS bootstrap logic is validated with a behavioural harness. The C++ part is not compiled and nothing was run inside NW.js, because a Chromium checkout and build does not fit this machine. The build and runtime check is for the submitter (steps below). |
| Submit as | woahwhattheheck: two PRs, one per repo |

## What the issue asks

Show a startup image or animation, configurable in package.json, while the app loads.

## Where nw.js creates the main window

- `nwjs/nw.js` `src/browser/nw_extensions_browser_hooks.cc` `LoadNWAppAsExtensionHook` adds the background script `nwjs/newwin.js` (NW2, the default) or `nwjs/default.js` (legacy NW1, `--disable-features=nw2`) to the app manifest.
- Those two scripts live in nw.js's Chromium fork, **nwjs/chromium.src**, at `chrome/browser/resources/nwjs/`. They map `manifest.window.*` onto `chrome.windows.create` (NW2) or `chrome.app.window.create` (NW1).
- So the feature belongs in the fork's bootstrap scripts, plus the manifest-key plumbing, docs and tests in nw.js.
- Other existing manifest options (`show`, `frame`, `kiosk`, …) are handled in the same place.

## Design

```json
"window": {
  "splash": "splash.png"
}
```

or

```json
"window": {
  "splash": {
    "url": "splash.html",
    "width": 480,
    "height": 270,
    "min_duration": 1500,
    "transparent": false
  }
}
```

- **Splash window:**
  - frameless, not resizable, centered, always on top, not in the taskbar
  - `transparent` turns on `alphaEnabled`
  - sized to `width`/`height`; for an image without a size, the image's natural size (probed with `Image` in the background page); otherwise 400x300
  - an HTML splash allows animations
- **Main window:** created at the same time, hidden.
- **When the main window finishes loading:**
  - NW2 uses the same signal as `nw.Window`'s `loaded` event (`tabs.onUpdated` with `nwstatus == 'complete'`); NW1 uses `contentWindow` `load`.
  - Once loaded, and `min_duration` ms after the splash appeared, the main window is shown (`chrome.windows.update({show: true})` / `appWindow.show()`) and the splash is closed.
- **`show: false`:** the splash closes after load, and the main window stays hidden for the app to `win.show()`.
- **Robustness:**
  - If the main window is closed, or fails to be created, the splash is closed too (even if the splash is created later).
  - If the splash fails to be created, the main window is still shown on load with no delay.
  - Duplicate load events and events for other windows are ignored.
  - A load reported before the main window's create callback is still honoured.
- **No `window.splash`:** both scripts make exactly the same window API calls as before (checked by the harness).
- **Inheritance:** `splash` is added to the non-inherited window attributes, so windows opened from the app never inherit it, and docs and code stay consistent as the code comment requires.
- **Limitation (documented):** the splash appears after the package has been read, so it covers main-window loading but not extraction of a package zipped into the executable. Covering extraction would need a native window before `Package` init.

## Files changed

`fix.patch` → **nwjs/nw.js** `main@ea9ed82763a3fd9e3df5f773793ab13b82d313e2` (1 commit, 12 files, +171/−1):

| File | Change |
|---|---|
| `src/common/shell_switches.{h,cc}` | `kmSplash = "splash"` |
| `src/browser/nw_extensions_browser_hooks.cc` | add `switches::kmSplash` to `MergeManifest`'s non-inherited attributes |
| `docs/References/Manifest Format.md` | `### splash` section, plus an entry in the non-inherited list |
| `test/sanity/manifest-splash/` | HTML splash test: checks splash size, `min_duration`, and that the main window is shown afterwards |
| `test/sanity/manifest-splash-image/` | 240x135 PNG test: auto-size together with `"show": false` |

`chromium.src.patch` → **nwjs/chromium.src** `main@a9e894609983e4bfd5d1d8753da0b063e02b3ef4` (1 commit):

| File | Change |
|---|---|
| `chrome/browser/resources/nwjs/newwin.js` | NW2 splash (+150/−3) |
| `chrome/browser/resources/nwjs/default.js` | NW1 splash (+124/−3) |

`splash_harness.js` is validation only and not part of either patch.

## Validation run here

```bash
node --check chrome/browser/resources/nwjs/newwin.js && node --check chrome/browser/resources/nwjs/default.js
# syntax OK

git show a9e89460:chrome/browser/resources/nwjs/newwin.js > newwin.orig.js
git show a9e89460:chrome/browser/resources/nwjs/default.js > default.orig.js
node splash_harness.js newwin.js default.js newwin.orig.js default.orig.js
# 18 checks passed: 14 NW2 + 4 NW1
```

The harness runs both scripts in a vm sandbox with a mocked `chrome.windows` / `chrome.tabs` / `chrome.app.window`, `Image` and a fake clock. It covers:

- parity with the original files on 8 manifests without a valid splash
- that the main window is created hidden and with the splash's window options
- `min_duration` timing to the millisecond
- `show: false`
- image auto-size, partial size, image error, `transparent`, and invalid numbers
- load events that arrive early, duplicated, or from another window
- main window closed early, main window create failure, and splash create failure

Other checks:

```bash
python3 -m py_compile test/sanity/manifest-splash/test.py test/sanity/manifest-splash-image/test.py   # OK
python3 -m json.tool test/sanity/manifest-splash*/package.json                                         # OK
file test/sanity/manifest-splash-image/splash.png   # PNG image data, 240 x 135
git am fix.patch               # on nw.js main@ea9ed827: clean, tree identical to the fix branch
git am chromium.src.patch      # on chromium.src main@a9e89460: clean, tree identical
```

**Not run here:** the C++ compile (three lines that mirror the existing `kmShow` and `kmVisibleOnAllWorkspaces` constants and list entries) and the two sanity tests inside a built NW.js.

## Submitter build and runtime check

1. Check out the nw.js build per `docs/For Developers/Building NW.js.md`, with nwjs/chromium.src `main` in `src/` and nw.js `main` in `src/content/nw`.
2. Apply `chromium.src.patch` in `src/` and `fix.patch` in `src/content/nw`.
3. Build: `ninja -C out/nw nwjs chromedriver`.
4. Run the tests:
   ```bash
   CHROMEDRIVER=out/nw/chromedriver python3 src/content/nw/test/sanity/manifest-splash/test.py
   CHROMEDRIVER=out/nw/chromedriver python3 src/content/nw/test/sanity/manifest-splash-image/test.py
   ```
5. Manually run `out/nw/nw src/content/nw/test/sanity/manifest-splash`. Expect a 320x180 blue splash for about 4 s, then the main window. Repeat with `--disable-features=nw2` for the NW1 path.

## Competition

- **PR #8383** (shailendra-codes, opened 2026-09-03, open, no reviews, "Fixes #151"):
  - It adds a single file, `patch/splash-screen-support.patch`. That file is a malformed pseudo-diff against functions that don't exist in nw.js (`Package::ParseWindowConfig`, `WindowConfig`), with typos such as `splsh_image`, `GelInteger` and `scr/`.
  - It changes no code, docs or tests.
  - Ours implements the feature in the real window-creation path, with docs, tests and a validated bootstrap.
- No fleet collision (Slack checked 2026-10-08).

## Notes for the submitter

- Open two PRs that link to each other: nwjs/chromium.src (bootstrap scripts) and nwjs/nw.js (docs, tests, constant; `Fixes #151`). The nw.js PR only works with the chromium.src change.
- nw.js's contributing guide asks contributors to add their name and email to `AUTHORS`. Add that line before opening the PR if you want it.
- No AI-contribution policy was found in nw.js's CONTRIBUTING or docs.
- After opening the nw.js PR, submit it on the IssueHunt issue page ("Submit pull request") so it is eligible for the reward.

## #1151 assessment: prebuilt for ARM devices ($285, IssueHunt)

This is release infrastructure outside the repo, not a code change in it.

- The issue (2013) asks for official ARM builds, originally for Raspberry Pi and other 32-bit ARMv7 boards.
- nw.js now ships official arm64 builds. The README links Linux arm64 and macOS arm64 downloads for v0.117.0. `https://dl.nwjs.io/v0.117.0/nwjs-v0.117.0-linux-arm64.tar.gz` and `...-win-arm64.zip` both return 206.
- In-repo support for this is already merged:
  - "node: add arm64 linux cross-compile support"
  - "node: win cross compile for arm64"
  - "[tools] ARM macOS package support"
  - "Update binary packaging to support ARM builds"
  - `tools/package_binaries.py` takes `--arch`, and `tools/aws_uploader.py` maps `winarm` builders.
- What is missing is 32-bit ARM. `nwjs-v0.117.0-linux-arm.tar.gz` and `...-linux-armv7.tar.gz` return 404. Adding them means a new armv7 builder on the nw.js buildbot and upload pipeline, which lives outside this repo, plus whatever Chromium and Node cross-compile fixes that builder turns up.
- So there is no meaningful in-repo patch. A maintainer could also treat the issue as resolved by the arm64 builds.
- The only possible in-repo edit is a README Windows arm64 download link, which does not address the bounty.

## PR drafts

### nwjs/chromium.src

Title: `nwjs: show an optional splash window while the main window loads`

~~~markdown
Companion to nwjs/nw.js#<nw.js PR number>, which adds docs and tests. Implements the `window.splash` manifest field requested in nwjs/nw.js#151.

`window.splash` is the path/URL of a page or image, or `{url, width, height, min_duration, transparent}`. When it is set, `nwjs/newwin.js` (NW2) and `nwjs/default.js` (NW1):
- open a frameless, centered, always-on-top splash window that is not in the taskbar (an image without a size is sized to the image; otherwise 400x300)
- create the main window hidden
- once the main window has loaded (the same signal as the `loaded` event) and `min_duration` ms have passed, show the main window (unless `show` is false) and close the splash
- close the splash if the main window is closed or fails to be created; if the splash fails, the main window is shown on load as usual

Without `window.splash` both scripts make exactly the same window calls as before.
~~~

### nwjs/nw.js

Title: `Add window.splash manifest field for a startup splash`

~~~markdown
Fixes #151

Adds a `window.splash` manifest field: a page or image shown in a small frameless window while the main window loads. Afterwards the main window is shown and the splash is closed.

```json
"window": { "splash": { "url": "splash.html", "width": 480, "height": 270, "min_duration": 1500 } }
```

- The window bootstrap change is in nwjs/chromium.src#<fork PR number> (`chrome/browser/resources/nwjs/newwin.js` and `default.js`)
- `splash` is a new manifest key constant and is not inherited by windows opened from the app
- Documented in `docs/References/Manifest Format.md`
- Sanity tests: `test/sanity/manifest-splash` (HTML splash, size, min_duration, main window shown afterwards) and `test/sanity/manifest-splash-image` (image auto-size with `"show": false`)

IssueHunt: https://oss.issuehunt.io/r/nwjs/nw.js/issues/151. This PR is submitted there for the funded bounty, and I'd appreciate the IssueHunt reward being released to me when it is merged. Thanks!
~~~
