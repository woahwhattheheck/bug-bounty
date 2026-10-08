#!/usr/bin/env bash
# Focused validation of plugins/obs-vst3 (Linux). Builds only libobs, libobs-opengl,
# obs-vst3 and obs-vst3-host, plus this harness, then runs the harness under Xvfb
# against the VST3 SDK's AGain sample plug-in.
#
# Environment:
#   OBS_SRC     obs-studio checkout with the patch applied
#   OBS_BUILD   CMake build directory (configured, see HANDOFF.md)
#   VST3SDK     vst3sdk v3.8.0 checkout (with submodules)
#   SDK_BUILD   build directory of the SDK samples (contains VST3/Release/again.vst3)
set -euo pipefail

OBS_SRC=${OBS_SRC:?}
OBS_BUILD=${OBS_BUILD:?}
SDK_BUILD=${SDK_BUILD:?}
HERE=$(cd "$(dirname "$0")" && pwd)
RUNDIR="$OBS_BUILD/rundir/RelWithDebInfo"

cmake --build "$OBS_BUILD" --target libobs libobs-opengl obs-vst3 obs-vst3-host -j"$(nproc)"

g++ -std=c++17 -O1 -g -Wall -o "$RUNDIR/bin/vst3-filter-test" "$HERE/vst3-filter-test.cpp" \
    -I"$OBS_SRC/libobs" -I"$OBS_BUILD/config" -I"$OBS_BUILD/libobs" \
    -L"$RUNDIR/lib" -l:libobs.so.30 -lX11 -lpthread -Wl,-rpath,"$RUNDIR/lib"

CONFIG_DIR=$(mktemp -d)
export VST3_PATH="$SDK_BUILD/VST3/Release"
export LD_LIBRARY_PATH="$OBS_BUILD/libobs-opengl:$RUNDIR/lib"

run() {
    xvfb-run -a -s "-screen 0 1280x800x24" "$RUNDIR/bin/vst3-filter-test" \
        "$RUNDIR/lib/obs-modules/core/obs-vst3.so" "$RUNDIR/share/obs/obs-modules/core/obs-vst3" \
        "$CONFIG_DIR" "$RUNDIR/share/obs/libobs/" "$@"
}

echo "=== stereo ==="
run stereo --editor "$HERE/again-editor-xvfb.png"
echo "=== 5.1 (cached scan) ==="
run 5.1
rm -rf "$CONFIG_DIR"
