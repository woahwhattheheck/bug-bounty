# Gyroflow #742 / PR #1244: full-application demo

`demo.mp4` is a 2 min 47 s recording of the actual Gyroflow desktop app. The app was built from source on Linux x86_64 and driven under Xvfb. It shows the three items the Algora bounty asks for:

| Time | What happens |
|---|---|
| 0:00–0:27 | App launch. Gyroflow 1.6.3 loads 12,409 lens profiles. |
| 0:27–0:48 | **1. Camera / lens selectors.** In the main Lens profile menu: Camera brand → Apple, Camera model → iPhone 12, Lens model → Wide. The three calibrated submissions for that setup are listed, and Load applies the first one (Calibrated by: Hugo Lonski). |
| 0:48–1:03 | **2. Profile review.** Next loads Sebastijan's submission. *Hide profile locally* removes it from the list, and the replacement row is selected and loaded, so the details panel changes back to Hugo Lonski. *Show hidden profiles* brings it back. Next reaches the hidden row, the button reads *Restore profile*, and Restore un-hides it. |
| 1:03–1:34 | **3. Lens calibrator** (Create new). It has the same brand/model/lens selectors. The generated chessboard clip is opened and *Plain chessboard pattern* is enabled. |
| 1:34–1:55 | Auto calibrate runs the app's OpenCV calibration: reprojection error 0.107, 30 good frames. |
| 1:55–2:04 | **Submission validation.** Export lens profile with *Upload* checked and no camera identity. Upload is refused: "Enter a specific camera brand / camera model / lens model … before uploading." The options are *Save without uploading* or *Cancel*. |
| 2:04–2:19 | Selector path Canon → 1100D → Canon EF 18-55mm (a zoom lens). |
| 2:19–2:28 | Export again. Upload is refused: "Specify the actual focal length used to calibrate this zoom lens before uploading." |
| 2:28–2:36 | Advanced → Focal length checked, 18 mm entered. |
| 2:36–2:47 | Export again. Validation passes and the existing GPLv3 upload prompt appears. **No** is clicked, so the profile is saved locally and **nothing is uploaded** (`evidence/profile_saved_locally_in_demo.json`). |

It is one continuous, unedited capture. Every action is a real X11 input event (xdotool) sent to the running app by `repro/record_demo.sh`. Post-processing was limited to adding a caption bar *below* the screen (nothing is drawn over the app) and scaling to 1280 px wide.

## Source the demo binary was built from (read this first)

**PR head `a89f905d462f23d454454df98f6b9937c3e71d30` cannot show its main window.** Both build modes stop with:

```
qrc:/src/ui/menu/LensProfile.qml:231:5: CameraLensSelector is not a type
qrc:/src/ui/App.qml:176:17: Type Menu.LensProfile unavailable
qrc:/src/ui/main_window.qml:140:13: Type App unavailable
QQmlApplicationEngine failed to load component
```

* `cargo build --profile deploy` (`just deploy`, compiled QML): component types resolve only through `src/ui/components/qmldir`, and the PR did not add `CameraLensSelector` there. Log: `evidence/exact_head_deploy_build_qml_error.txt`.
* `cargo build --release` (`just run`): QML is embedded through the explicit `qrc!` list in `src/resources_qml.rs`, which does not include `CameraLensSelector.qml` or `CameraCatalog.js`. Log: `evidence/exact_head_release_build_qml_error.txt`.
* On `master`, every component is registered in both places.

`fix.patch` adds those three registration lines and changes no behaviour. It is commit `1dd5ad89e4d6ddf3e0b499360892e108869bc7c8` on top of `a89f905d`. **The demo binary was built from `a89f905d` + `fix.patch`, source tree `74e2508f055ac0e4e94bebf7025cfab10bfe3940`.** After `fix.patch` is applied to the PR branch, `git rev-parse HEAD^{tree}` on the new head should print `74e2508f…`. If it does, the video matches that head byte for byte at source level.

## Build provenance

| Item | Value |
|---|---|
| Host | Ubuntu 24.04.5 LTS container, Linux 6.18 x86_64, 4 vCPU, no GPU (Mesa llvmpipe 25.2.8) |
| Rust | rustc 1.97.0 (2d8144b78 2026-07-07), cargo 1.97.0, `--locked` |
| C/C++ | Ubuntu clang 18.1.3 (libclang for opencv bindings), cmake 3.28.3 |
| Qt | 6.4.3 linux desktop gcc_64 via aqtinstall 3.3.0. This is the version and method in `_scripts/common.just` / `linux.just install-deps`. |
| FFmpeg | `ffmpeg-9.0-linux-clang-gpl-lite` (avbuild), the archive named in `common.just`, from sourceforge.net/projects/avbuild. Tarball sha256 `48595d8b12354cbb2027c85b0da26c0b28c0185ea76d86d11b08dc99b920167b`. |
| MDK (qml-video-rs) | mdk-sdk-linux.tar.xz 0.39.0 (git eed59da), the URL `qml-video-rs` `build.rs` downloads, fetched with curl and passed as `MDK_SDK`. sha256 `8a66c5ab23a5e357511e01ff9d369a68dce6470076303136a619bbe120518479`. |
| OpenCV | 4.12.0 (`49486f61fb25722cbcf586b7f4320921d46fb38e`, official git tag), shared libs, modules core/imgproc/imgcodecs/calib3d/features2d/flann/video, linked through `build.rs`'s non-vcpkg branch. vcpkg's source downloads are not reachable from this container. |
| Other | `libOpenCL.so` → system `libOpenCL.so.1` symlink in the OpenCV lib dir, standing in for `ocl-icd-opencl-dev`. Environment is in `repro/env.sh` (mirrors `common.just`). |
| Build | `cargo build --profile deploy --locked -j4`. The full exact-head build took 13 min 28 s. The incremental rebuild with `fix.patch` took 6 min 46 s. |
| Demo binary | `target/deploy/gyroflow`, sha256 `a5cc17c114258ba65311c8dd26a9a8c1bc3f0c9c39fe1ad6805d9f0e63fba3a4`, version string "Gyroflow 1.6.3 (dev248197)" |
| Exact-head binaries (load failure) | deploy `5ae982181db83a6124f88a9a9ab46d1fe51bc458fc84356307ada3941176bd40` (first build), rebuilt as `a6f9c54d6220e84b8d50d580118d4cf26ee07dd1867bde5b60ce2edb9de0c8a2` for the captured log; the hashes differ because the version string embeds a build stamp (dev2481xx). Release: `13fbf0ded6c2eaeef1e9ef4d7d08d284cfe02a3afdfb998a5660b5ee74a7ec20`. |
| Fixed release binary (validation) | `8ca2d143eeb253189f617deb6d5d3119b5e626a19b4a702e48c532926d068302`. The main window loads with no QML warnings (`evidence/fixed_release_build_main_window.png`). |

## Runtime data

* **Lens profile database:** the upstream `gyroflow/lens_profiles` latest release asset `profiles.cbor.gz` (`__version` 41), sha256 `5b9136697b75ddf9cda20965f17e786b6c8530e3d59109f87505069602e7f676`. Placed where `src/core/build.rs` would download it. The app logs "Loaded 12409 lens profiles".
* **Camera catalogue:** the PR's bundled `resources/camera_catalog.json`. The released profile archive does not contain `__camera_catalog.json` yet (that is lens_profiles#39), so the bundled fallback path is the one exercised.
* **Calibration input:** no camera footage exists in the container, so `evidence/chessboard_generated.mp4` was rendered by `repro/gen_chessboard.py`. It is a 15×9-square plain chessboard seen through a fisheye camera with known intrinsics (fx = fy = 620, k = 0.06/0.012/-0.004/0.0008), 10 s, 1280×720, 30 fps, sha256 `d28fc9227694c311647ca5dc307e1fbe6d4b964eda3a1d018abe06c67c66f6d1`. The app's own calibration recovered fx = 619.82, cx = 639.77, cy = 359.94 with RMS 0.107. This is input data only; every screen in the video is the real application.
* Settings started from empty XDG config/data dirs. Nothing was uploaded and no network write was made.

## Media

| | |
|---|---|
| File | `demo.mp4`, 2,087,729 bytes |
| sha256 | `5d56fccd471717ff63d034400f723c428bae950c56d541a1bee41aa051f0d010` |
| ffprobe | container mov/mp4 (faststart); video h264 High@4.0, yuv420p, 1280×864, 15 fps, 2511 frames; duration 167.400 s; no audio |
| Capture | `ffmpeg -f x11grab -draw_mouse 1 -framerate 15 -video_size 1600x1000 -i :142 -c:v libx264 -preset ultrafast -qp 0` (ffmpeg 6.1.1, Xvfb 21.1.12, xdotool 3.20160805.1) |
| Encode | pad 1600×1080 caption bar → drawtext captions → scale 1280 wide → `libx264 -preset slow -crf 27 -tune stillimage -movflags +faststart` |

## Reproduce

```bash
git clone https://github.com/gyroflow/gyroflow && cd gyroflow
git fetch origin pull/1244/head && git checkout a89f905d462f23d454454df98f6b9937c3e71d30
git am --keep-cr /path/to/fix.patch           # CRLF files; tree must be 74e2508f…
# ext/: Qt 6.4.3 (aqt), ffmpeg-9.0-linux-clang-gpl-lite, mdk-sdk, OpenCV 4.12.0 (see table)
. repro/env.sh && cargo build --profile deploy --locked
Xvfb :142 -screen 0 1600x1000x24 -noreset &
repro/record_demo.sh                           # writes rec/raw.mkv + rec/marks.txt
```

`evidence/demo_step_timestamps.txt` holds the step marks from the recorded run. `evidence/demo_run_app_log_excerpt.txt` holds the app log lines: Qt/Gyroflow version, profiles loaded, OpenCV 4.12.0, calibration RMS.
