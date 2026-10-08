#!/bin/bash
# UI actions on the Scenes dock (coordinates from the case1 screenshot, rows are 28px high)
E=/home/user/work/clones/obs-scenes-ffmpeg/e2e
drag() { # x1 y1 x2 y2
	xdotool mousemove $1 $2 sleep 0.3 mousedown 1 sleep 0.3
	for i in 1 2 3 4 5 6 7 8; do
		xdotool mousemove $(( $1 + ($3 - $1) * i / 8 )) $(( $2 + ($4 - $2) * i / 8 )) sleep 0.15
	done
	xdotool sleep 0.5 mouseup 1 sleep 1
}
# 1. expand "Components" with its arrow
xdotool mousemove 14 231 sleep 0.5 mousedown 1 sleep 0.2 mouseup 1 sleep 1
import -window root $E/case2-step1-expand.png
# 2. drag "Ending" onto the "Empty Folder" header
drag 60 315 90 175
import -window root $E/case2-step2-drop-into-folder.png
# 3. drag "BRB" above "Starting Soon"
drag 40 231 40 52
import -window root $E/case2-step3-reorder.png
# 4. undo, then redo the reorder
xdotool mousemove 700 300 click 1 sleep 0.5 key ctrl+z sleep 1
import -window root $E/case2-step4-undo.png
xdotool key ctrl+y sleep 1
import -window root $E/case2-step5-redo.png
# 5. collapse "Gameplay" (contains the current scene)
xdotool mousemove 14 119 sleep 0.5 mousedown 1 sleep 0.2 mouseup 1 sleep 1
import -window root $E/case2-step6-collapse.png
