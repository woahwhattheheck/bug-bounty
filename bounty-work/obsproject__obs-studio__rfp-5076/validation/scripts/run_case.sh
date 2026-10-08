#!/bin/bash
# Usage: run_case.sh <name>  -- runs OBS with the "Folders Test" collection, screenshots, exits gracefully
NAME=$1
W=/home/user/work/clones/obs-scenes-ffmpeg
E=$W/e2e
export DISPLAY=:97
# keep the main window at the top-left corner so that UI coordinates are stable
sed -i '/^geometry=/d' /home/user/work/clones/obsproject__obs-studio__scenes/build_scenes/rundir/Release/config/obs-studio/user.ini
$W/run-obs.sh 120 $E/$NAME.log --collection "Folders Test" &
for i in $(seq 1 60); do grep -q "Loaded scenes" $E/$NAME.log 2>/dev/null && break; sleep 2; grep -q "Loaded scenes" $E/$NAME.log || xdotool mousemove 1150 645 click 1; done
sleep 4
import -window root $E/$NAME.png
if [ -n "$E2E_ACTIONS" ]; then bash -c "$E2E_ACTIONS"; sleep 2; import -window root $E/$NAME-after.png; fi
pkill -TERM -x obs
for i in $(seq 1 30); do pgrep -x obs >/dev/null || break; sleep 1; done
pgrep -x obs >/dev/null && echo "obs still running" || echo "obs exited"
