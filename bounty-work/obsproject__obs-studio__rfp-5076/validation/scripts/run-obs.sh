#!/bin/bash
# Local helper: run the validation build of OBS under Xvfb.
# Usage: run-obs.sh <seconds> <logfile> [obs args...]
SECS=$1; LOG=$(realpath -m "$2"); shift 2
W=/home/user/work/clones/obs-scenes-ffmpeg
export HOME=$W/home
export LD_LIBRARY_PATH=$W/prefix/lib:$W/qt/6.11.1/gcc_64/lib
export LIBGL_ALWAYS_SOFTWARE=1
export QT_QPA_PLATFORM=xcb
export OBS_PLUGINS_PATH=$W/plugins
cd /home/user/work/clones/obsproject__obs-studio__scenes/build_scenes/rundir/Release/bin
exec timeout $SECS ./obs --portable --multi "$@" > "$LOG" 2>&1
