#!/bin/bash
# Scripted, recorded run of the exact-head Gyroflow deploy build on Xvfb :142.
# Every action is a real X11 input event (xdotool) into the running application.
set -u
. /home/user/work/gyroflow-demo/drive.sh
P=/home/user/work/clones/gyroflow__gyroflow
REC=/home/user/work/gyroflow-demo/rec
BIN=$P/target/deploy/gyroflow
rm -rf "$REC"; mkdir -p "$REC/input" "$REC/xdg/config" "$REC/xdg/data" "$REC/xdg/cache"
cp /home/user/work/gyroflow-demo/chessboard_generated.mp4 "$REC/input/"
MARKS=$REC/marks.txt; : > "$MARKS"

# Recording starts before the app is launched.
ffmpeg -hide_banner -loglevel error -y -f x11grab -draw_mouse 1 -framerate 15 -video_size 1600x1000 -i :142 \
       -c:v libx264 -preset ultrafast -qp 0 "$REC/raw.mkv" &
FF=$!
T0=$(date +%s.%N)
mark() { echo "$(echo "$(date +%s.%N) - $T0" | bc) $*" >> "$MARKS"; }
sleep 1

mark "launch"
(
  . /home/user/work/gyroflow-demo/env.sh
  export LD_LIBRARY_PATH=$P/target/deploy:$LD_LIBRARY_PATH
  export DISPLAY=:142 XDG_CONFIG_HOME=$REC/xdg/config XDG_DATA_HOME=$REC/xdg/data XDG_CACHE_HOME=$REC/xdg/cache
  cd "$REC/input" && exec "$BIN"
) > "$REC/app.log" 2>&1 &
APP=$!
abort() { echo "ABORT: $*"; kill -INT $FF; kill $APP 2>/dev/null; exit 1; }
n=0; until grep -q "Loaded .* lens profiles" "$REC/app.log" 2>/dev/null; do sleep 0.5; n=$((n+1)); kill -0 $APP 2>/dev/null || abort "app exited"; [ $n -gt 240 ] && abort "profiles never loaded"; done
grep -q "is not a type" "$REC/app.log" && abort "QML type error: $(grep 'is not a type' "$REC/app.log" | head -1)"
pause 4
mark "app ready"

# 1. Camera / lens selectors in the main lens-profile menu
mark "STEP1 selectors"
click 170 530; pause 1.5          # Camera brand
click 60 528;  pause 1.5          # Apple
click 170 595; pause 1.5          # Camera model
click 62 173;  pause 1.5          # iPhone 12
click 170 660; pause 1.5          # Lens model
click 48 837;  pause 2            # Wide -> calibrated submissions for this setup
click 170 703; pause 2.5          # show the submissions list
key Escape;    pause 1
click 138 744; pause 2.5          # Load
click 95 127;  pause 2            # collapse Video information so profile details are visible

# 2. Profile review: Next, Hide, Show hidden, Restore
mark "STEP2 review"
click 204 455; pause 2.5          # Next -> second submission loaded
mark "hide"
click 90 496;  pause 3            # Hide profile locally -> replacement row selected and loaded
mark "show hidden"
click 29 535;  pause 2.5          # Show hidden profiles
click 204 455; pause 2.5          # Next -> the hidden submission (button reads Restore profile)
click 90 496;  pause 2.5          # Restore profile

# 3. Calibrator: submission validation
mark "STEP3 calibrator"
click 232 617                     # Create new -> Lens calibrator window
n=0; until xdotool search --onlyvisible --name "Lens calibrator" >/dev/null 2>&1; do sleep 0.5; n=$((n+1)); [ $n -gt 60 ] && abort "calibrator window did not open"; done
pause 3
W=$(xdotool search --onlyvisible --name "Lens calibrator" | head -1)
xdotool windowsize "$W" 1440 920 windowmove "$W" 80 40; pause 2
click 175 58;  pause 1.5          # expand Video information
click 250 103; pause 2.5          # Open file
xdotool mousemove --sync 640 422 sleep 0.4 click --repeat 2 --delay 120 1   # chessboard clip
pause 5
click 175 58;  pause 1.5          # collapse Video information
click 249 720; pause 1.5          # Advanced
wheel 250 600 down 40; pause 1.5
click 109 925; pause 1.5          # Plain chessboard pattern
wheel 250 400 up 60; pause 1.5
move 264 345; pause 0.5; xdotool click 1   # Auto calibrate
mark "auto calibrate"
move 900 900
n=0; until grep -q "rms:" "$REC/app.log"; do sleep 0.5; n=$((n+1)); [ $n -gt 600 ] && abort "calibration did not finish"; done
pause 3
mark "calibrated"

mark "validation: no identity"
click 249 714; pause 2            # Export lens profile (upload checked)
click 1047 673; pause 4           # accept file name -> validation warning
click 897 591; pause 1.5          # Cancel

mark "select Canon 1100D zoom lens"
click 250 172; pause 1.5          # Camera brand
wheel 250 600 down 20; pause 1.5
for i in 1 2 3 4 5; do
  shot find_brand >/dev/null
  read -r cx cy sc < <(python3 -I /home/user/work/gyroflow-demo/find.py "$SHOTS/find_brand.png" /home/user/work/gyroflow-demo/shots/tpl_canon.png 95 150 415 960)
  if [ "$(echo "$sc < 150" | bc)" = 1 ]; then break; fi
  wheel 250 600 down 4; pause 1
done
echo "canon at $cx $cy score $sc" >> "$MARKS"
click "$cx" "$cy"; pause 1.5      # Canon
click 250 237; pause 1.5          # Camera model
click 132 308; pause 1.5          # 1100D
click 250 302; pause 1.5          # Lens model
click 160 339; pause 2            # Canon EF 18-55mm

mark "validation: zoom without focal length"
click 249 714; pause 2            # Export lens profile
click 1047 673; pause 4           # -> zoom lens needs a focal length
click 897 577; pause 1.5          # Cancel

mark "set focal length"
wheel 250 600 down 40; pause 1.5
click 109 710; pause 1.5          # Focal length
click 320 751; pause 0.5; key ctrl+a; typetext "18"; key Return; pause 2

mark "validation passes"
click 249 242; pause 2            # Export lens profile
click 1047 673; pause 4           # -> validation passes: GPLv3 upload consent
click 836 591; pause 4            # No = save locally, nothing uploaded
mark "end"

kill -INT $FF; wait $FF
kill $APP 2>/dev/null; wait $APP 2>/dev/null
echo RECORD_DONE
