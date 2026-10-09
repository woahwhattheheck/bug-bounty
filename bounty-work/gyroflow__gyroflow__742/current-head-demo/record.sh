#!/bin/bash
# Scripted, recorded run of the deploy-profile Gyroflow build on Xvfb :142.
# Every action is a real X11 input event (xdotool) into the running application.
# Covers exactly three behaviors that changed after the earlier demo
# (source tree 74e2508f055ac0e4e94bebf7025cfab10bfe3940):
#   A) unbranded camera with a UNIQUE catalog alias auto-prefills the selectors
#   B) unbranded camera with an AMBIGUOUS model stays manual (no auto-select)
#   C) legacy lens_info metadata prefills the lens when lens_type does not match
#   D) zoom focal-range upload validation in the lens calibrator:
#      missing focal length refused, out-of-range focal refused, in-range passes
set -u
EVI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
P=${GYRO_DIR:?set GYRO_DIR}
RUN=$EVI_DIR/run
REC=$RUN/rec
export SHOTS=$RUN/shots
BIN=$P/target/deploy/gyroflow
IN=$RUN/input
CAL=$RUN/input_cal          # calibrator dir: contains ONLY calib.mp4 + calib.gcsv
mkdir -p "$IN" "$CAL" "$REC" "$SHOTS" "$RUN/xdg/config" "$RUN/xdg/data" "$RUN/xdg/cache"
. "$EVI_DIR/drive.sh"

# Stage inputs (make_inputs.sh wrote everything under $IN; isolate calib pair)
mv "$IN/calib.mp4" "$IN/calib.gcsv" "$CAL/" 2>/dev/null || true

# Stop immediately on an invalid synthetic telemetry rate, before costly UI driving.
# Timestamp units are milliseconds because each sidecar declares tscale=0.001.
for gcsv in "$IN"/uniq.gcsv "$IN"/amb.gcsv "$IN"/lensfb.gcsv "$CAL"/calib.gcsv; do
  if ! awk -F, '
    $1 == "t" && $2 == "gx" {
      if (getline <= 0) exit 1
      first = $1
      if (getline <= 0) exit 1
      delta = $1 - first
      found = 1
    }
    END { if (!found || delta < 1 || delta > 20) exit 1 }
  ' "$gcsv"; then
    echo "ABORT: IMU rate below 50 Hz or invalid telemetry: $gcsv" >&2
    exit 1
  fi
done


MARKS=$REC/marks.txt; : > "$MARKS"
Xvfb :142 -screen 0 1600x1000x24 -noreset > "$REC/xvfb.log" 2>&1 &
XVFB=$!
sleep 1.5
ffmpeg -hide_banner -loglevel error -y -f x11grab -draw_mouse 1 -framerate 15 -video_size 1600x1000 -i :142 \
       -c:v libx264 -preset ultrafast -qp 0 "$REC/raw.mkv" &
FF=$!
T0=$(date +%s.%N)
mark() { echo "$(echo "$(date +%s.%N) - $T0" | bc) $*" >> "$MARKS"; }
sleep 1

abort() { echo "ABORT: $*"; mark "ABORT $*"; kill -INT $FF 2>/dev/null; wait $FF 2>/dev/null; exit 1; }
# A solid-black root capture cannot substantiate a GUI acceptance claim.
# ImageMagick is installed by the existing focused evidence workflow.
visible_shot() {
  shot "$1" >/dev/null || abort "screenshot failed: $1"
  local colors
  colors=$(identify -format "%k" "$SHOTS/$1.png") || abort "screenshot unreadable: $1"
  [ "$colors" -ge 8 ] || abort "blank GUI screenshot: $1 ($colors distinct colors)"
  echo "$SHOTS/$1.png"
}

launch() {  # launch <file-or-empty> <tag> <cwd>
  (
    . "$EVI_DIR/env.sh"
    export LD_LIBRARY_PATH=$P/target/deploy:$LD_LIBRARY_PATH
    export DISPLAY=:142 XDG_CONFIG_HOME=$RUN/xdg/config XDG_DATA_HOME=$RUN/xdg/data XDG_CACHE_HOME=$RUN/xdg/cache
    cd "$3" || exit 1
    # A positional video path enters Gyroflow's headless export CLI. Use
    # --open to load the input in the actual QML desktop interface.
    if [ -n "$1" ]; then exec "$BIN" --open "$1"; else exec "$BIN"; fi
  ) > "$REC/app_$2.log" 2>&1 &
  echo $!
}
wait_ready() {  # wait_ready <pid> <logfile>
  local n=0
  until grep -q "Loaded .* lens profiles" "$2" 2>/dev/null; do
    sleep 0.5; n=$((n+1))
    kill -0 "$1" 2>/dev/null || abort "app exited"
    [ $n -gt 360 ] && abort "profiles never loaded"
  done
  grep -q "is not a type" "$2" && abort "QML type error: $(grep 'is not a type' "$2" | head -1)"
}
wait_identifier() {  # wait for telemetry parse (non-fatal, bounded)
  local n=0
  until grep -q "CameraIdentifier" "$1" 2>/dev/null; do
    sleep 0.5; n=$((n+1)); [ $n -gt 60 ] && break
  done
}

mark "env: $(uname -r) $(cat /etc/os-release | head -1 | cut -d'"' -f2) | source $(cd $P && git rev-parse HEAD)"
mark "binary sha256 $(sha256sum $BIN | cut -d' ' -f1)"

# ---------- Segment A: unbranded UNIQUE alias -> auto prefill ----------
mark "segA launch uniq.mp4 (vendor empty, id=Alpha 7 IV)"
APP=$(launch "$IN/uniq.mp4" A "$IN")
wait_ready $APP "$REC/app_A.log"
wait_identifier "$REC/app_A.log"
pause 6
visible_shot segA_loaded
click 95 127; pause 2            # collapse Video information
shot segA_selectors              # expect: brand=Sony, model=ILCE-7M4 prefilled
move 170 500; wheel 170 500 down 12; pause 1; shot segA_lower
mark "segA done"
kill $APP 2>/dev/null; wait $APP 2>/dev/null

# ---------- Segment B: unbranded AMBIGUOUS model -> stays manual ----------
mark "segB launch amb.mp4 (vendor empty, id=a77 -> Sony + apeman)"
APP=$(launch "$IN/amb.mp4" B "$IN")
wait_ready $APP "$REC/app_B.log"
wait_identifier "$REC/app_B.log"
pause 6
visible_shot segB_loaded
click 95 127; pause 2
shot segB_selectors              # expect: brand empty, model 'a77' as manual Other text
mark "segB done"
kill $APP 2>/dev/null; wait $APP 2>/dev/null

# ---------- Segment C: lens_info fallback prefill ----------
mark "segC launch lensfb.mp4 (Canon EOS 1100D, lens_type unmatched, lens_info=EF-S 18-55 IS II)"
APP=$(launch "$IN/lensfb.mp4" C "$IN")
wait_ready $APP "$REC/app_C.log"
wait_identifier "$REC/app_C.log"
pause 6
visible_shot segC_loaded
click 95 127; pause 2
shot segC_selectors              # expect: lens combo = Canon EF-S 18-55mm f/3.5-5.6 IS II
mark "segC done"
kill $APP 2>/dev/null; wait $APP 2>/dev/null

# ---------- Segment D: calibrator + zoom focal-range validation ----------
mark "segD launch (calibrator, calib.mp4 + calib.gcsv)"
APP=$(launch "" D "$CAL")
wait_ready $APP "$REC/app_D.log"
pause 4
click 95 127; pause 2            # collapse Video information (empty anyway)
shot segD_main
click 232 617                    # Create new -> Lens calibrator window
n=0; until xdotool search --onlyvisible --name "Lens calibrator" >/dev/null 2>&1; do sleep 0.5; n=$((n+1)); [ $n -gt 80 ] && abort "calibrator window did not open"; done
pause 3
W=$(xdotool search --onlyvisible --name "Lens calibrator" | head -1)
xdotool windowsize "$W" 1440 920 windowmove "$W" 80 40; pause 2
click 175 58;  pause 1.5          # expand Video information
click 250 103; pause 2.5          # Open file -> file list (only calib.mp4)
shot segD_openfile
xdotool mousemove --sync 640 422 sleep 0.4 click --repeat 2 --delay 120 1
pause 5
wait_identifier "$REC/app_D.log"
click 175 58;  pause 1.5          # collapse Video information
shot segD_prefilled               # selector: Canon / EOS 1100D / EF-S 18-55 IS II
click 249 720; pause 1.5          # Advanced
wheel 250 600 down 40; pause 1.5
click 109 925; pause 1.5          # Plain chessboard pattern
wheel 250 400 up 60; pause 1.5
shot segD_before_autocalibrate
move 264 345; pause 0.5; xdotool click 1   # Auto calibrate
pause 3; shot segD_after_autocalibrate
mark "segD auto calibrate"
move 900 900
n=0; until grep -q "rms:" "$REC/app_D.log"; do sleep 0.5; n=$((n+1)); [ $n -gt 600 ] && abort "calibration did not finish"; done
pause 3
shot segD_calibrated
mark "segD calibrated rms $(grep -o 'rms: [0-9.]*' "$REC/app_D.log" | head -1)"

mark "segD export1: zoom without focal length"
click 249 714; pause 2            # Export lens profile (upload checked)
click 1047 673; pause 4           # accept file name -> validation refuses
shot segD_err_nofocal             # "Specify the actual focal length used to calibrate this zoom lens"
click 897 577; pause 1.5          # Cancel (validation-warning dialog button row)

mark "segD focal=200 (outside 18-55)"
wheel 250 600 down 40; pause 1.5
click 109 710; pause 1.5          # Focal length checkbox
click 320 751; pause 0.5; key ctrl+a; typetext "200"; key Return; pause 2
shot segD_focal200
click 249 242; pause 2            # Export again (panel scrolled: button at top of view)
click 1047 673; pause 4
shot segD_err_range               # "outside the selected zoom lens's documented range"
click 897 577; pause 1.5          # Cancel

mark "segD focal=55 (inside 18-55)"
click 320 751; pause 0.5; key ctrl+a; typetext "55"; key Return; pause 2
shot segD_focal55
click 249 242; pause 2            # Export again (panel still scrolled)
click 1047 673; pause 4
shot segD_gpl_prompt              # GPLv3 upload consent -> validation passed
click 836 591; pause 4            # No = save locally, nothing uploaded
shot segD_saved
mark "segD done end"

kill -INT $FF; wait $FF 2>/dev/null
kill $APP 2>/dev/null; wait $APP 2>/dev/null
kill $XVFB 2>/dev/null

# Collect artifacts
find "$RUN/xdg" -name "*.gyroflow" -o -name "*.json" 2>/dev/null | while read -r f; do
  case "$f" in *camera_presets*|*metadata*|*lens_profiles*) cp "$f" "$REC/saved_$(basename "$f")" ;; esac
done
mark "RECORD_DONE"
echo RECORD_DONE
