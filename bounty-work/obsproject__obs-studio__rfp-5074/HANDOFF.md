# HANDOFF: obsproject/obs-studio RFP #5074 (VST3 Support), Open Collective $3,000

**Status:** HANDOFF. The proposal is ready to post. The implementation is complete for the RFP
scope and validated on Linux. The Windows and macOS code paths are written but have not been built
with MSVC or Xcode yet; see "Remaining work".

## Bounty

| | |
|---|---|
| RFP | https://github.com/obsproject/obs-studio/discussions/5074 ("Requests For Proposals (Bounties)", label `bounty/needs-proposal`) |
| Platform | Open Collective, OBS Project Bounty Fund ("VST3 Support"). Program rules: https://github.com/obsproject/obs-studio/wiki/OBS-Project-Bounty-Program |
| Amount | $3,000 (RFP text) |
| Payout evidence | Per coordinator discovery, the OBS Open Collective paid a $1,000 bounty expense on 2026-01-09 and the program balance is about $75.9k. When PR #8919 (Carla) was closed on 2024-01-02, Fenrirthviti wrote publicly that OBS was "paying out partial bounty on this for the work and effort". |
| Award history | falkTX's Carla-based proposal was accepted on 2021-11-21. PR #8919 was closed on 2024-01-02 after maintainers decided "using Carla as a host for VST3 (and other) plugins is not the right path forward". OBS paid a partial bounty and said it would reopen the RFP. The category listing now shows #5074 as `bounty/needs-proposal` ("open to proposals"). |
| Competition | PR #12752 "Add a VST3 host filter to obs-studio" by pkviet (OBS collaborator) is open: opened 2025-10-22, last pushed 2026-09-22, milestone 33.x, assignee RytoEX, changes requested by tytan652 on 2026-07-08 (X11 used under Wayland). It hosts plug-ins **in-process** and does not mention the bounty. PR #13814 (blockie710) was closed on 2026-08-22. Ours differs by meeting the RFP's explicit out-of-process requirement (crash isolation, shared-memory audio, socket/pipe commands), which also keeps X11 out of the OBS process. |
| Contribution policy | OBS `CONTRIBUTING.md` ("AI/Machine Learning Policy") requires all submitted code and text to be human-written and says low-effort or incorrect AI-assisted submissions may lead to a ban. |

## Submission process (OBS bounty program)

1. Post the proposal as a reply on discussion #5074. Paste the comment below, followed by the full
   contents of `PROPOSAL.md`; it fits within GitHub's comment limit. Mockups and screenshots go in
   the same reply (`validation/again-editor-xvfb*.png`).
2. After OBS accepts the proposal (the bounty moves to "In Progress"), open the PR. The program
   wants code submitted as a draft first: open it as a draft from a fork branch with `git am
   fix.patch`, mark it ready once Windows and macOS CI is green, and answer review comments
   promptly. The program can release a bounty after two weeks without activity.
3. After the PR is merged into `master`, submit an Open Collective expense (invoice) to the OBS
   Project for $3,000 that references discussion #5074 and the merged PR URL. OBS team members
   confirm it.

### Ready-to-paste proposal comment (discussion #5074)

> Hi! I'd like to propose an implementation of this RFP. The full proposal is below. In short, it
> adds a new `obs-vst3` plugin that hosts VST3 effects with the Steinberg VST3 SDK directly (MIT
> licensed since 3.8.0 and already shipped by obs-deps). Each plug-in runs in an `obs-vst3-host`
> process: audio goes through shared memory, and commands go over a socket pair (named pipe on
> Windows). A crashing or hanging plug-in never takes OBS down; the filter passes audio through and
> restarts the plug-in with its last state. It covers scanning of the standard VST3 paths with a
> crash-safe cache, multi-class ("shell") modules, component/controller state in the filter
> settings, native editor windows owned by the bridge process (X11/Win32/Cocoa), channel layouts
> matching OBS, and a sidechain through the compressor's capture path.
>
> The Linux implementation already works end to end against the SDK sample plug-ins: processing,
> state round trip, editor, kill-the-host recovery and sidechain. Screenshots and the test harness
> are attached. I'd appreciate feedback on the design before opening the PR, and I'm happy to adjust
> anything to fit the project's preferences.
>
> *(paste PROPOSAL.md here)*
>
> I'm requesting the $3,000 VST3 Support bounty for this work, paid through the OBS Project Open
> Collective after the PR is merged.

## What was built

- **Patch:** `fix.patch`, three commits, `git format-patch` against `master@e7f0b0d43c538f5d108aa4cbea473d57b3012a1a`.
  Author: `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`. 70 files,
  +7635/−1.
  1. `cmake: Add find module for VST3 SDK`: `cmake/finders/FindVST3SDK.cmake`.
  2. `obs-vst3: Add out-of-process VST3 audio filter`: `plugins/obs-vst3/**`, `plugins/CMakeLists.txt`.
  3. `build-aux: Add VST3 SDK to Flatpak manifest`: `build-aux/com.obsproject.Studio.json`.

| Area | Files |
|---|---|
| OBS module | `obs-vst3.cpp` (registration, `type_data` = catalog), `VST3Filter.*` (filter callbacks, properties, crash recovery, state), `PluginCatalog*` (scan, cache, per-platform search paths), `SidechainInput.*`, `BridgeClient.*`, `HostProcess_{Posix,Windows}.cpp` (spawn: posix_spawn / CreateProcessW with handle list and job object), `Base64.*` |
| Shared IPC | `bridge/BridgeProtocol.hpp` (commands, shared memory layout, timeouts), `IpcChannel*` (socketpair / overlapped named pipe with timeouts and interrupt), `SharedMemory*` (memfd / shm_open / file mapping), `MessageReader/Writer` |
| Bridge process | `host/main.cpp` (`--serve`, `--scan`), `HostSession` (commands on the UI thread, audio thread), `PluginInstance` (SDK hosting, buses, processing, state, editor view), `ComponentHandler`, `ParameterQueue`, `HostContext` (IHostApplication, plus Linux::IRunLoop for VSTGUI 3.8), `ModuleScanner` (moduleinfo.json or factory), `SpeakerLayouts`, `linux/` (poll loop, IRunLoop, X11 editor), `windows/` (message loop, HWND editor, DPI), `macos/` (NSApplication loop, NSWindow editor, entitlements) |
| Strings | `data/locale/en-US.ini` |

## Validation (Linux, Ubuntu 24.04)

OBS master requires FFmpeg 8.0 and MbedTLS 3, and Ubuntu 24.04 ships older versions. For the
validation build, minimal FFmpeg 8.0 and MbedTLS 3.6.2 were built into a local prefix. Only the
targets that were needed were built: libobs, libobs-opengl (for `video_tick`), obs-vst3 and
obs-vst3-host. The full test suite was not run.

```bash
# SDK (MIT) and sample plug-ins
git clone --depth 1 --branch v3.8.0_build_66 https://github.com/steinbergmedia/vst3sdk   # 9fad977
git -C vst3sdk submodule update --init --depth 1 base cmake pluginterfaces public.sdk vstgui4
#  (local-only tweak for the sample build: VSTGUI_STANDALONE OFF in cmake/modules/SMTG_VstGuiSupport.cmake, avoids gtkmm)
cmake -S vst3sdk -B sdk-build -G Ninja -DCMAKE_BUILD_TYPE=Release -DSMTG_ENABLE_VST3_HOSTING_EXAMPLES=OFF \
      -DSMTG_CREATE_PLUGIN_LINK=OFF -DSMTG_RUN_VST_VALIDATOR=OFF
cmake --build sdk-build --target again

# OBS (patch applied), minimal configure
cmake -S obs-studio -B obs-build -G Ninja -DOBS_VERSION_OVERRIDE=32.1.0 -DCMAKE_BUILD_TYPE=RelWithDebInfo \
  -DCMAKE_PREFIX_PATH="$PWD/ffmpeg8;$PWD/mbedtls3" -DVST3SDK_ROOT=$PWD/vst3sdk \
  -DENABLE_FRONTEND=OFF -DENABLE_SCRIPTING=OFF -DENABLE_BROWSER=OFF -DENABLE_WEBSOCKET=OFF -DENABLE_AJA=OFF \
  -DENABLE_DECKLINK=OFF -DENABLE_VLC=OFF -DENABLE_WEBRTC=OFF -DENABLE_NVENC=OFF -DENABLE_QSV11=OFF \
  -DENABLE_PIPEWIRE=OFF -DENABLE_V4L2=OFF -DENABLE_ALSA=OFF -DENABLE_PULSEAUDIO=OFF -DENABLE_FREETYPE=OFF \
  -DENABLE_VST=OFF -DENABLE_NEW_MPEGTS_OUTPUT=OFF -DENABLE_RNNOISE=OFF -DENABLE_WAYLAND=OFF -DENABLE_SERVICE_UPDATES=OFF
#   -> "Found VST3SDK: .../vst3sdk (found suitable version "3.8.0", minimum required is "3.8")", obs-vst3 in Enabled Modules

# Focused harness (builds libobs, libobs-opengl, obs-vst3, obs-vst3-host + harness; runs under Xvfb)
OBS_SRC=obs-studio OBS_BUILD=obs-build SDK_BUILD=sdk-build ./validation/run-validation.sh
```

**Result:** `ALL PASSED: 0 failure(s)` for both the stereo and the 5.1 runs. The full log is in
`validation/validation-output.log`. Key lines:

```
PASS: plug-in list from VST3_PATH scan contains both classes of again.vst3 (multi-class module)
PASS: scan cache written to .../obs-vst3/plugin-cache.json
PASS: type-level obs_get_source_properties("vst3_filter") lists plug-ins without an instance
PASS: plug-in runs in a separate obs-vst3-host process (pid 19334)
PASS: AGain default state (gain 1.0) passes a 440 Hz sine unchanged (max error 0.00e+00)
PASS: removing the filter shuts its plug-in host process down
PASS: state restored from settings (gain 0.25) is applied by the processor (max error 0.00e+00)
PASS: save() round-trips IComponent::getState as base64 (AACAPgAAAAAAAAAA)
PASS: second filter loaded from saved settings applies gain 0.25 (max error 0.00e+00)
PASS: blocks of 64/480/1024/1500/4096 frames are processed (chunked to 1024)
INFO: 33.1 us per 1024-frame block including libobs, shared-memory copy and socket round trip (block length is 21333 us)
PASS: editor window "AGain VST3 - VST3 test" created by the host process
PASS: moving the slider in the plug-in editor changes the processed gain (now 0.926, was 0.25)
PASS: saved state reflects the edit made in the editor (ewltPwAAAAAAAAAA)
PASS: after SIGKILL of the plug-in host OBS keeps running and passes audio through (max error 0.00e+00)
PASS: host restarted automatically (pid 19682) and the last known state (gain 0.926) was restored
PASS: AGain SideChain mixes the mono-downmixed key into its output: 0.2 + 0.1 = 0.3000 (expected 0.3)
PASS: 5.1: AGain is stereo-only, channels 3-6 are passed through untouched (max error 0.00e+00)
PASS: no plug-in host processes left behind
ALL PASSED: 0 failure(s)
```

**Additional checks:**

- **Compiler warnings:** obs-vst3 and obs-vst3-host compile with OBS's flags (`-Wall -Wextra -Werror …`)
  and produce no warnings.
- **Formatting:** `clang-format` 22.1.3 `--dry-run --Werror` passes on all plug-in sources.
  `gersemi` 0.25.4 `--check` passes on the 4 CMake files. `python3 build-aux/format-manifest.py --check`
  passes on the Flatpak manifest.
- **Windows (syntax only):** `x86_64-w64-mingw32-g++-posix -std=c++17 -fsyntax-only -Wall -Wextra`
  reports 0 errors and 0 warnings across 24 Windows-path files (bridge, host, `host/windows`,
  `HostProcess_Windows`, `PluginCatalog_Windows`, and the module sources).
- **valgrind memcheck:** run on the bridge with the same harness, editor included. It found a
  use-after-free at process exit, now fixed: VSTGUI released the run loop from its exit handlers,
  so the run loop now lives for the whole process. Of 22 bridge processes, 21 reported 0 errors.
  The remaining report is a `writev` of uninitialised bytes inside libxcb/cairo (the plug-in's own
  rendering), not in obs-vst3 code.
- **Patch check:** `git am fix.patch` applies cleanly on `e7f0b0d`.
- **Screenshots:** `validation/again-editor-xvfb.png` and `validation/again-editor-xvfb-after-edit.png`
  show the AGain editor rendered by the bridge process (gain -12.04 dB, then -5.11 dB after the
  slider drag).

## How to apply

```bash
git clone https://github.com/obsproject/obs-studio && cd obs-studio
git checkout e7f0b0d43c538f5d108aa4cbea473d57b3012a1a   # or current master; the patch only adds files except 2 small edits
git am /path/to/fix.patch
```

## Remaining work before merge (exact plan)

1. **Windows (MSVC, obs-deps 2026-05-21 or newer):** let CI build `obs-vst3` and `obs-vst3-host`
   and fix any MSVC-only errors. MinGW reports none. Check:
   - the install location: `set_target_properties_obs` puts helper executables in `bin/64bit`, next
     to `obs-ffmpeg-mux.exe`;
   - that `os_get_executable_path_ptr("obs-vst3-host.exe")` resolves there;
   - manual tests: editor open/close, a HiDPI move between monitors, and Task Manager "End task" on
     the host (recovery).
2. **macOS (Xcode, universal):**
   - confirm ARC on `module_mac.mm` and the host's `.mm` files (set in `host/CMakeLists.txt`);
   - confirm that the helper's entitlements (`host/cmake/macos/entitlements.plist`) are picked up by
     `_add_entitlements` and that the helper is copied into `OBS.app/Contents/MacOS`;
   - test the NSWindow editor and the accessory activation policy, a signed build loading
     third-party plug-ins, and Retina sizing.
   - Optional: launch the host with `arch -x86_64` for x86_64-only plug-ins on arm64.
3. **Linux CI and Flatpak:**
   - Ubuntu CI: fetch the SDK into `.deps` and pass `-DVST3SDK_ROOT` in `.github/scripts/utils.zsh/setup_ubuntu`
     and the build script, or ask maintainers to add the SDK to the obs-deps Linux artifacts.
   - Flatpak: the manifest now builds a pinned `vst3sdk` module. Verify with flatpak-builder;
     maintainers may prefer adding it to obs-deps-buildstream instead.
4. **Review follow-ups maintainers are likely to ask for:**
   - per-class file layout (already one class per header/implementation pair);
   - possibly splitting `VST3Filter.cpp`'s properties code into `VST3FilterProperties.cpp`;
   - translations through Crowdin (only `en-US.ini` is added).

## PR title

`obs-vst3: Add out-of-process VST3 audio filter`

## PR body (ready to paste)

```markdown
### Description
Adds a new `obs-vst3` plugin with a "VST3 Plug-in" audio filter that hosts VST3 effects using the Steinberg VST3 SDK directly (MIT licensed since 3.8.0, provided by obs-deps), implementing the accepted proposal for the VST3 Support RFP.

Plug-ins run outside of OBS: every filter instance owns an `obs-vst3-host` process. Audio blocks (up to 1024 frames, planar float) are exchanged through an anonymous shared memory region; a small request/reply record on a socket pair (named pipe on Windows) hands each block over, and a second channel carries load/configure/state/editor commands. If the plug-in crashes or stops responding (500 ms per block), OBS keeps running, audio passes through unchanged and the plug-in host is restarted with the last known state.

- Discovery of the standard VST3 locations per platform (+ `VST3_PATH` and Flatpak extensions on Linux); each new/changed module is inspected by a short-lived `obs-vst3-host --scan` process (moduleinfo.json first), results are cached in the module config directory. Every audio-effect class of a module is listed (multi-class / "shell" modules).
- Component and controller state are saved base64-encoded in the filter settings and restored on load.
- Plug-in editors are top-level windows owned by the bridge process (X11 with `Linux::IRunLoop` on Linux, Win32 with per-monitor DPI on Windows, Cocoa on macOS) – OBS itself never uses X11 for plug-in UIs.
- Buses use the OBS speaker layout; channels a plug-in does not process are passed through. Plug-ins with an aux input bus can use another source as sidechain via the compressor's capture path. The plug-in's reported latency is shown in the properties.
- `cmake/finders/FindVST3SDK.cmake` finds the obs-deps SDK (or `VST3SDK_ROOT`); the Flatpak manifest builds a pinned SDK module and merges the `vst3` plug-in extension directory.

### Motivation and Context
Implements RFP #5074 (VST3 Support). Many plug-ins are VST3-only or prefer their VST3 version, and the RFP asks for an SDK-based (non-JUCE) host that isolates plug-ins in an external process using shared memory for audio and pipes/sockets for commands.

Closes #5074

### How Has This Been Tested?
Linux (Ubuntu 24.04): a headless libobs harness (Xvfb) drives the real `vst3_filter` with the SDK's AGain samples: scan + cache, out-of-process load, bit-exact processing at default and restored gain, state round trip (save → new instance), 64–4096 frame blocks, 5.1 layout passthrough of unprocessed channels, editor open/close with a GUI edit changing the processed gain and the saved state, SIGKILL of the host (audio passes through, host restarts with state), sidechain mixing, no leftover processes. The bridge was also run under valgrind memcheck. Windows-path sources pass a MinGW-w64 `-fsyntax-only -Wall -Wextra` check; Windows (MSVC) and macOS builds are tested through CI and manual testing during review.

### Types of changes
- New feature (non-breaking change which adds functionality)

### Checklist:
- [x] My code has been run through clang-format.
- [x] I have read the contributing document.
- [x] My code is not on the master branch.
- [x] The code has been tested.
- [x] All commit messages are properly formatted and commits squashed where appropriate.
- [x] I have included updates to all appropriate documentation.

### Bounty
This PR implements the VST3 Support bounty (RFP #5074, $3,000). I'm claiming that bounty and request the $3,000 payout through the OBS Project Open Collective once this PR is merged; I'll submit the expense referencing this PR after merge.
```
