# Proposal: VST3 Support (`obs-vst3`), RFP #5074

This proposal answers the "VST3 Support" request for proposals
(https://github.com/obsproject/obs-studio/discussions/5074). It covers every item in the RFP's
"Request For Proposal" section and the feedback maintainers gave on earlier VST3 attempts (#8919,
#12752). The Linux implementation is working and tested. The Windows and macOS code is written
against the documented SDK and platform APIs; it still needs builds and tests on those systems
(see Milestones).

## Summary

`plugins/obs-vst3` adds a **"VST3 Plug-in" audio filter**. Each filter instance runs one VST3
effect in its own **`obs-vst3-host` process**:

- **Audio:** samples go through **shared memory**. A small request/reply record on a **socket pair**
  (a named pipe on Windows) signals each block.
- **Commands:** load, configure, state and editor control use a second channel with length-prefixed
  messages.
- **Crash isolation:** if a plug-in crashes or hangs, OBS keeps running. The filter passes audio
  through unchanged and restarts the plug-in with its last known state.

```
 OBS process                                          obs-vst3-host process (one per filter)
 ┌───────────────────────────────┐                    ┌──────────────────────────────────────┐
 │ VST3Filter (obs_source_info)  │  command channel   │ HostSession (main/UI thread)         │
 │  ├ BridgeClient ──────────────┼──── socketpair ───▶│  ├ PluginInstance (IComponent,       │
 │  │   load/configure/state/UI  │◀─── named pipe ────┤  │   IAudioProcessor, IEditController)│
 │  │                            │                    │  ├ EventLoop (X11 / Win32 / Cocoa)   │
 │  │   process(): copy planes ──┼── shared memory ──▶│  │   + EditorWindow (IPlugFrame,     │
 │  │   ProcessRequest ──────────┼──── audio chan ───▶│  │     Linux::IRunLoop)              │
 │  │   ◀──────── ProcessReply ──┼────────────────────┤  └ audio thread: process() on the    │
 │  ├ SidechainInput (capture cb)│                    │      shared memory planes            │
 │  └ PluginCatalog (scan/cache) │── "--scan" procs ─▶│ ModuleScanner (one process/module)   │
 └───────────────────────────────┘                    └──────────────────────────────────────┘
```

## RFP requirements and how they are met

| RFP requirement | How it is met |
|---|---|
| New plug-in called `obs-vst3` | `plugins/obs-vst3`, registered with `add_core_module(obs-vst3 PLATFORMS WINDOWS MACOS LINUX)`. Source type id `vst3_filter`. |
| Windows, macOS and Linux | Platform code is kept in separate files: `HostProcess_{Posix,Windows}`, `PluginCatalog_{Linux,Windows,macOS}`, `bridge/*_{Posix,Windows}`, `host/{linux,windows,macos}/`. Linux is built and tested. The Windows code compiles cleanly with MinGW-w64 (`-fsyntax-only -Wall -Wextra`). The macOS code is written to AppKit APIs. |
| Use the Steinberg VST3 SDK directly, no JUCE | Only the SDK's `pluginterfaces`, `base` and `public.sdk/source` hosting helpers are used (`Module`, `HostApplication`, `HostProcessData`, `ParameterChanges`, `ConnectionProxy`, `MemoryStream`, the moduleinfo parser). There are no other third-party libraries. |
| Plug-ins run in an external process | The `obs-vst3-host` helper executable (one process per filter instance), plus short-lived `--scan` processes for discovery. |
| Shared memory for audio, pipes/sockets for commands | Audio uses an anonymous shared memory region (memfd on Linux, `shm_open`+unlink on macOS, unnamed file mapping on Windows), inherited by the child. Commands use a socket pair (POSIX) or an overlapped named pipe (Windows). The design follows yabridge and LMMS `VstPlugin`, with per-block request/reply instead of polling. |
| Scan the standard VST3 locations | These follow Steinberg's "Plugin Locations" page. **Linux:** `~/.vst3`, `/usr/lib/vst3`, `/usr/local/lib/vst3` (plus `/usr/lib64/vst3`, `$VST3_PATH`, and `/app/extensions/Plugins/vst3` under Flatpak). **Windows:** `FOLDERID_ProgramFilesCommon\VST3` and `FOLDERID_UserProgramFilesCommon\VST3`. **macOS:** `~/Library`, `/Library` and `/Network/Library` `/Audio/Plug-Ins/VST3`. |
| Shell plug-in support, or a path to it | VST3's equivalent of a "shell" is one module whose factory exports several classes. Every audio effect class becomes its own list entry. The validation uses the SDK's `again.vst3` module, which exports both "AGain VST3" and "AGain SideChain VST3". |
| Effects only | Only `kVstAudioEffectClass` classes are listed, and pure "Instrument" sub-categories are excluded. A plug-in needs an audio input and an audio output bus. Event (MIDI) buses are kept inactive. |
| Sidechain through the compressor's code path | `SidechainInput` follows `compressor-filter.c`: a source chosen by name is attached with `obs_source_add_audio_capture_callback` and buffered in deques, and the same number of frames is popped per block. The plug-in's first `kAux` input bus is enabled with the OBS layout, and mono if the plug-in refuses that. A stereo or surround key is down-mixed for mono sidechain buses. |
| MIDI optional | Out of scope for this proposal. The command channel and `EventList` plumbing leave room to add it later (see Future work). |
| Match the OBS channel count, no remapping or up/down-mix UI | The main input and output buses are set to the speaker arrangement for the OBS layout (mono, stereo, 2.1, 4.0, 4.1, 5.1, 7.1; channel orders match). If a plug-in rejects it, its own arrangement is used. OBS channels the plug-in does not process are passed through untouched; this was verified with a 5.1 OBS layout and the stereo-only AGain. |
| Follow "Tips for Writing a Good Proposal" | Covered in this document: implementation details, data structures and APIs, a UI mockup, the library choice and a time estimate. |

## SDK choice and licensing

- **Licence:** the Steinberg VST3 SDK is **MIT licensed since VST 3.8.0** (Steinberg press release,
  29 Oct 2025). This was verified in `LICENSE.txt` at `steinbergmedia/vst3sdk@9fad977`
  (`v3.8.0_build_66`). The GPLv3/proprietary dual-licence questions raised in this thread in
  2021–2022 no longer apply. MIT is compatible with OBS's GPLv2+. The SDK's copyright notice must
  ship with binaries, and obs-deps already installs it to `licenses/vst3sdk`.
- **Dependency policy:** obs-deps already ships this exact SDK commit for Windows and macOS (as
  sources in `include/vst3sdk`, release 2026-05-21, merged in #13457), so there are no in-tree
  copies or patches, as PatTheMav asked. `cmake/finders/FindVST3SDK.cmake` locates it and lists the
  hosting sources to compile.
- **Linux:** distributions do not package the SDK yet. `VST3SDK_ROOT` can point to an SDK checkout.
  The Flatpak manifest gains a pinned `vst3sdk` module. If the SDK is missing, the plug-in is
  skipped with a status message and configure does not fail.
- **No other libraries:** no JUCE and no Carla. The bridge uses only the SDK, the C++17 standard
  library and the platform APIs (POSIX/Win32/AppKit/Xlib).

## Detailed design

### Processes and IPC (`bridge/`, `BridgeClient`, `HostProcess_*`)

- **Spawning:**
  - **POSIX:** `posix_spawn`. The child's socket ends and the memfd are mapped to descriptors 3, 4
    and 5, and every other descriptor is closed (`addclosefrom_np` on glibc,
    `POSIX_SPAWN_CLOEXEC_DEFAULT` on macOS).
  - **Windows:** `CreateProcessW` with `PROC_THREAD_ATTRIBUTE_HANDLE_LIST`, so only the two pipe
    ends and the file mapping are inherited. The child joins a job object with
    `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, so it dies together with OBS.
- **Protocol** (`BridgeProtocol.hpp`):
  - **Commands:** `Hello` (version handshake), `LoadPlugin`, `Configure`, `SetState`, `GetState`,
    `ShowEditor`, `HideEditor`, `Shutdown`, plus `ScanModule` in scan mode.
  - **Replies:** every reply starts with a status and an error string. Messages are bounds-checked
    by `MessageReader`.
- **Shared memory layout:**
  - **Header:** a 64-byte aligned `SharedAudioHeader` (magic, version, capacities). The bridge
    publishes lock-free atomics in it: `editorOpen`, `latencySamples`, `editCount`,
    `processedBlocks`.
  - **Audio:** 3 × 8 planes × 1024 float samples (input, sidechain, output), about 96 KiB per
    instance.
- **Audio path:**
  - `filter_audio` try-locks the filter's bridge pointer, so it never waits on a reload.
  - It copies planes into shared memory in chunks of at most 1024 frames (async sources deliver
    arbitrary sizes) and sends a 16-byte `ProcessRequest`.
  - It waits at most **500 ms** for the 8-byte `ProcessReply`, then copies the output back.
  - Measured on Linux: about **33 µs per 1024-frame block** round trip (the block itself lasts
    21.3 ms). Processing is synchronous, so the bridge adds **no latency** beyond the plug-in's own.
- **Failure handling:**
  - A timeout, EOF or write error marks the bridge dead and kills the process, and audio passes
    through.
  - `video_tick` queues a UI-thread restart: up to 3 attempts, 2 s apart, after which a "Restart
    Plug-in" button is shown.
  - The restart restores the last known state. That state is refreshed one second after the last
    edit in the plug-in editor and on every save.

### Hosting (`host/PluginInstance`, `HostSession`, `ComponentHandler`, `ParameterQueue`)

- **Instantiation:**
  - `VST3::Hosting::Module::create`, then `IPluginFactory3::setHostContext(HostContext)`.
  - Create `IComponent` → `initialize` → `IAudioProcessor`. Single-component plug-ins are detected
    with an `IEditController` cast. Otherwise the controller class is created and initialized, and
    both sides are connected through `ConnectionProxy` (the SDK's recommendation).
  - The controller is synchronized with `setComponentState`.
- **Configuration**, in the order the VST3 spec requires: `setBusArrangements` → read back the
  arrangements → `setupProcessing` (kRealtime, kSample32, max 1024, OBS rate) → `activateBus` (main
  in/out plus aux if the sidechain is used; event buses off) → `setActive(true)` →
  `HostProcessData::prepare` → `setProcessing(true)` → `getLatencySamples`.
- **Threads:** one audio thread per bridge runs `process()`, and the main thread runs everything
  else, matching the SDK's UI-thread rules.
  - **Editor to processor:** `IComponentHandler::performEdit` queues the change in a `ParameterQueue`
    (`try_lock` only on the audio side), and the processor receives it through `IParameterChanges`
    in the next block.
  - **Processor to controller:** output parameter changes go back to the controller on the main
    thread through `setParamNormalized`; this is how meters such as AGain's VU update.
  - **Restart requests:** `restartComponent(kLatencyChanged | kIoChanged | kReloadComponent)`
    deactivates and reconfigures the processor and publishes the new latency.
- **Process context:** sample rate, a running sample position, system time, and a fixed tempo of
  120 BPM in 4/4.

### State save/restore

- **Save:** `IComponent::getState` and `IEditController::getState` (the latter only for split
  component/controller plug-ins) are written to `MemoryStream`s. They are stored **base64 encoded**
  in the filter settings as `component_state` and `controller_state`, together with `state_plugin`
  (the `<class id>|<module path>` they belong to).
- **Restore** happens on create and plug-in reload: `IComponent::setState` →
  `IEditController::setComponentState` → `IEditController::setState`. State is only applied to the
  plug-in it was saved from.
- **Validation:** a state written in settings is applied, `save()` returns it unchanged, a second
  instance built from the saved settings behaves the same, and an edit made in the GUI shows up in
  the next save.

### Editor windows

The editor is a native top-level window owned by the bridge process. This avoids embedding windows
across processes, which macOS does not allow. It also means the OBS process never uses X11 for
plug-in UIs, which was the change request on #12752 (Wayland sessions use XWayland only inside the
bridge).

- **Linux:**
  - `EventLoopX11` is a `poll()` loop over the command channel, the X11 connection, the descriptors
    registered by the plug-in and its timers.
  - `RunLoopLinux` implements `Steinberg::Linux::IRunLoop`. It is returned both from the
    `IPlugFrame` and, as VST 3.8's VSTGUI requires, from the host context
    (`IHostApplication::queryInterface`).
  - Registered handlers are also called on every 16 ms idle tick, because toolkits buffer X events
    in their own connection. The SDK's editorhost does the same by polling continuously.
  - `EditorWindowX11` creates the window (WM_DELETE_WINDOW, `_NET_WM_NAME`, fixed-size hints for
    non-resizable views) and attaches it with `kPlatformTypeX11EmbedWindowID`. It handles
    `resizeView` and calls `onSize`, and applies `checkSizeConstraint` and `onSize` on user resizes.
  - The display is opened lazily, so processing works without a display server.
- **Windows:**
  - `EventLoopWin32` is a message loop. A reader thread posts commands to a message-only window,
    which keeps commands flowing during modal loops. A `WM_TIMER` drives the idle tick.
  - The process is per-monitor-DPI-aware v2 and the UI thread is OLE-initialized.
  - `EditorWindowWin32` attaches with `kPlatformTypeHWND`, sizes the window with
    `AdjustWindowRectExForDpi`, and handles `IPlugViewContentScaleSupport` and `WM_DPICHANGED`.
- **macOS:**
  - `EventLoopCocoa` is an `NSApplication` with the accessory activation policy. Commands are read
    on a background thread and dispatched to the main queue, which AppKit also services in tracking
    loops.
  - `EditorWindowCocoa` is an `NSWindow` attached with `kPlatformTypeNSView`.
  - The helper has its own entitlements (`disable-library-validation`,
    `allow-unsigned-executable-memory`) so third-party plug-ins can load under the hardened runtime.

### Scanning and caching (`PluginCatalog`)

- **When:** a background scan starts at module load. The "Rescan Plug-ins" button runs a full
  rescan.
- **What is found:** `.vst3` bundles and legacy single-file modules, recursing at most four levels
  into vendor folders.
- **Each new or changed module** is inspected by `obs-vst3-host --scan <path>` with a 30 s timeout.
  `moduleinfo.json` is used when present (no binary load), otherwise the module factory is loaded.
  A crash or hang while scanning only fails that module.
- **Cache:** results are stored in `obs_module_config_path("plugin-cache.json")`, keyed by path
  and a content fingerprint (file count, size and newest mtime inside the bundle), so unchanged
  modules are never loaded again. Failures are cached too.
- **Missing plug-ins:** a plug-in that is configured but not found stays in the list as
  "<name> (not found)", so settings are never lost.
- **Future:** x86_64-only plug-ins on Apple Silicon could later be bridged by launching a
  universal `obs-vst3-host` under Rosetta (`arch -x86_64`). The process boundary already allows it.

### Sample rate and block size

- **Sample rate:** the rate from `obs_get_audio_info` is passed to `setupProcessing`.
- **Block size:** `maxSamplesPerBlock` is 1024, matching `AUDIO_OUTPUT_FRAMES`. Larger async blocks
  are split into chunks, and smaller ones are processed as they arrive.
- **Validation:** 64, 480, 1024, 1500 and 4096-frame blocks all process bit-exactly.

### Properties UI (mockup of the implemented filter properties)

```
┌ Filters for "Mic/Aux" ───────────────────────────────────────────────┐
│ VST3 Plug-in       [ AGain SideChain VST3 (Steinberg Media Tech…) ▼] │
│                    [ Open Plug-in Interface ]                        │
│ Sidechain Source   [ Desktop Audio                                ▼] │  ← only for plug-ins with an aux input
│                    Plug-in latency: 0 samples (0.0 ms)               │
│                    [ Rescan Plug-ins ]                               │
└──────────────────────────────────────────────────────────────────────┘
```

- **Editor buttons:** "Close Plug-in Interface" replaces the open button while the editor is
  visible.
- **Errors:** the status line shows them in the error style, for example a crashed host or a load
  failure. A "Restart Plug-in" button appears in that case.
- **Strings:** all strings are in `data/locale/en-US.ini`.
- **Screenshots:** the plug-in editor runs in the bridge process. These were captured under Xvfb
  during validation: `validation/again-editor-xvfb.png` (state restored, gain -12.04 dB) and
  `again-editor-xvfb-after-edit.png` (after dragging the slider, gain -5.11 dB; the processed gain
  changed accordingly).

### Build system

- **Targets:**
  - `obs-vst3` (MODULE).
  - `obs-vst3-host` (an executable in `host/`, installed with the other OBS helper executables
    through `set_target_properties_obs` and found at runtime with `os_get_executable_path_ptr`).
  - `obs-vst3-bridge` (an OBJECT library shared by both).
  - `obs-vst3-sdk` (a static library built from `VST3SDK_HOSTING_SOURCES`, with warnings off for
    the third-party code).
- **Style:** C++17. The OBS sources build warning-free under OBS's `-Wall -Wextra -Werror` flags.
  Formatting uses clang-format 22.1.3 and gersemi 0.25 as required by `build-aux/run-*`, and
  `format-manifest.py --check` passes.
- **Per platform:**
  - **Windows/macOS:** `find_package(VST3SDK 3.8 REQUIRED)`, from obs-deps.
  - **Linux:** optional. The plug-in is skipped with a status message if the SDK is missing.
  - **macOS:** ARC is enabled for the SDK's `module_mac.mm` and the host's `.mm` files. The helper
    inherits the universal architecture settings.

## Testing plan

1. **Automated harness** (`validation/vst3-filter-test.cpp`, run by `run-validation.sh`; done on
   Linux). It drives the real `vst3_filter` through public libobs APIs with headless libobs
   (OpenGL on Xvfb so `video_tick` runs) and the SDK's AGain samples. It covers:
   - scanning, caching and type-level properties
   - the out-of-process load
   - bit-exact processing at default and restored gain
   - state round trip (save, then a second instance)
   - variable block sizes
   - the 5.1 passthrough of unprocessed channels
   - the editor opening and closing on X11, with screenshots
   - a GUI edit that changes the processed audio and the saved state
   - `SIGKILL` of the host: OBS keeps running, audio passes through, and the host restarts with
     state
   - sidechain mixing through the capture path
   - no leftover processes

   The host also ran under valgrind memcheck with this harness. That found and fixed a
   use-after-free at process exit. No errors remain in the host's own code; two `writev`
   uninitialised-byte reports remain inside libxcb/cairo, from the plug-in's own rendering.
2. **Windows:** an MSVC build in CI (obs-deps SDK), the harness ported to WASAPI-free headless
   libobs, and manual tests in OBS with TDR Nova, Valhalla Supermassive, FabFilter (if available),
   iZotope RX Voice De-noise, and the SDK samples. Covered cases: HiDPI editors on mixed-DPI
   monitors, kill-the-host recovery, and Flatpak-equivalent paths in `%LOCALAPPDATA%`.
3. **macOS:** a universal build in CI, a signed-build test of the helper entitlements, editors on
   Retina screens, AU-free plug-ins (Valhalla, TDR, Airwindows Consolidated VST3), and the
   quarantine/notarization behaviour of the helper.
4. **Linux:** Ubuntu and Flatpak builds with Airwindows Consolidated, LSP, x42 and Surge XT FX,
   under both an X11 and a Wayland session (editors through XWayland).
5. **Regression checks:** the existing `obs-vst` (VST2) plug-in is untouched. Scene collections
   without `obs-vst3` load unchanged.

## Milestones and timeline

| Milestone | Content | Estimate |
|---|---|---|
| M1 (done) | Linux implementation: bridge, hosting, scanning and cache, state, X11 editor, sidechain, crash recovery, harness, formatting | done |
| M2 | Windows: MSVC build in CI, fixes from real builds, plug-in matrix, DPI handling | 1–1.5 weeks |
| M3 | macOS: universal build, entitlements and signing, AppKit editor verification, optional Rosetta bridging | 1–1.5 weeks |
| M4 | Flatpak: build with the pinned SDK module (or an obs-deps-buildstream element), extension paths | 2–3 days |
| M5 | Review iterations until merge into `master` | as needed; review comments answered within a few days |

## Differences from earlier attempts

- **#8919 (Carla):** maintainers decided Carla was not the way forward. This proposal uses only the
  Steinberg SDK plus its own bridge (about 7,000 lines of C++ for the module, IPC and host on
  all three platforms). There are no submodules or extra dependencies.
- **#12752 (in-process host, open):** the RFP asks for plug-ins to run in an external process.
  This proposal does that, which gives crash isolation and keeps X11 out of the OBS process under
  Wayland. The settings format (`plugin`, base64 state) and the properties are deliberately simple,
  so a migration or merge path between the two is straightforward if maintainers want one.

## Future work (not part of the bounty scope)

- **MIDI:** route OBS-provided MIDI (from a future MIDI source API) to the plug-in's event input
  bus through an `EventList`.
- **Wayland:** native Wayland editors once VST 3.8's Wayland preview (`IWaylandHost`) is adopted by
  plug-ins.
- **Parameters:** expose plug-in parameters as OBS properties (or hotkeys) through
  `IEditController::getParameterInfo`.
- **Real-time priority:** raise the bridge's audio thread priority (MMCSS on Windows, time
  constraint policy on macOS).
