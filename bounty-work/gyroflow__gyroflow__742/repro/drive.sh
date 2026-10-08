# Helper functions for driving the real Gyroflow window on the Xvfb display.
export DISPLAY=:142
SHOTS=/home/user/work/gyroflow-demo/shots
mkdir -p "$SHOTS"

shot() {  # shot <name>  -> PNG of the whole virtual screen
    import -window root "$SHOTS/$1.png" 2>/dev/null
    echo "$SHOTS/$1.png"
}
click() {  # click <x> <y> [button]
    xdotool mousemove --sync "$1" "$2" sleep 0.25 click "${3:-1}"
}
move() { xdotool mousemove --sync "$1" "$2"; }
wheel() {  # wheel <x> <y> <up|down> <n>
    local b=5; [ "$3" = up ] && b=4
    xdotool mousemove --sync "$1" "$2" click --repeat "$4" --delay 60 "$b"
}
typetext() { xdotool type --delay 45 "$1"; }
key() { xdotool key "$@"; }
pause() { sleep "${1:-1}"; }
