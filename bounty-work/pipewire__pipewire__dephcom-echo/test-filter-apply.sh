#!/usr/bin/env bash
# Headless end-to-end check for filter.want / filter.apply handling in
# pipewire-pulse.
#
# Starts a private pipewire + wireplumber + pipewire-pulse from a meson build
# directory, creates a null "speakers" sink and a null "mic" source, then runs
# a paired playback + record stream (media.role=phone, filter.want=echo-cancel)
# with pacat/parec and checks that:
#   1. pipewire-pulse auto-loads module-echo-cancel with the two masters,
#   2. both streams are routed through the echo-cancel sink/source,
#   3. the echo-cancel nodes are linked to the real devices,
#   4. a stream with filter.suppress=echo-cancel is left alone,
#   5. the module is unloaded again once the streams are gone.
#
# usage: test-filter-apply.sh <pipewire-source-dir> [<builddir>]
set -u

SRC=${1:?pipewire source dir}
BUILD=${2:-$SRC/builddir}
WORK=$(mktemp -d)
export XDG_RUNTIME_DIR=$WORK/run
export PIPEWIRE_RUNTIME_DIR=$XDG_RUNTIME_DIR
export PULSE_RUNTIME_PATH=$XDG_RUNTIME_DIR/pulse
export PULSE_SERVER=unix:$PULSE_RUNTIME_PATH/native
export XDG_CONFIG_HOME=$WORK/config
export XDG_STATE_HOME=$WORK/state
export HOME=$WORK
mkdir -p "$XDG_RUNTIME_DIR" "$PULSE_RUNTIME_PATH" "$XDG_CONFIG_HOME" "$XDG_STATE_HOME"
chmod 700 "$XDG_RUNTIME_DIR"

export PIPEWIRE_CONFIG_DIR=$BUILD/src/daemon
export SPA_PLUGIN_DIR=$BUILD/spa/plugins
export SPA_DATA_DIR=$SRC/spa/plugins
export PIPEWIRE_MODULE_DIR=$BUILD/src/modules
export LD_LIBRARY_PATH=$BUILD/src/pipewire
export PATH=$BUILD/src/daemon:$BUILD/src/tools:$PATH
export PIPEWIRE_LOG_SYSTEMD=false
export DISABLE_RTKIT=1
# no D-Bus session in the container
unset DBUS_SESSION_BUS_ADDRESS

PIDS=()
cleanup() {
	for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done
	wait 2>/dev/null
	rm -rf "$WORK"
}
trap cleanup EXIT

FAIL=0
check() { # check <description> <command...>
	local desc=$1; shift
	if "$@"; then echo "PASS: $desc"; else echo "FAIL: $desc"; FAIL=1; fi
}
wait_for() { # wait_for <timeout-s> <command...>
	local t=$1; shift
	for _ in $(seq $((t * 10))); do "$@" && return 0; sleep 0.1; done
	return 1
}

PIPEWIRE_DEBUG=${PIPEWIRE_DEBUG:-2} pipewire > "$WORK/pipewire.log" 2>&1 & PIDS+=($!)
wait_for 10 test -S "$XDG_RUNTIME_DIR/pipewire-0" || { echo "pipewire did not start"; cat "$WORK/pipewire.log"; exit 1; }
wireplumber > "$WORK/wireplumber.log" 2>&1 & PIDS+=($!)
PIPEWIRE_DEBUG=${PULSE_DEBUG:-3} pipewire-pulse > "$WORK/pipewire-pulse.log" 2>&1 & PIDS+=($!)
wait_for 10 pactl info > /dev/null 2>&1 || { echo "pipewire-pulse did not start"; cat "$WORK/pipewire-pulse.log"; exit 1; }

# real devices: a null sink "speakers" and a null source "mic"
pw-cli create-node adapter '{ factory.name=support.null-audio-sink node.name=speakers media.class=Audio/Sink object.linger=true audio.position=[FL FR] priority.session=2000 }' > /dev/null
pw-cli create-node adapter '{ factory.name=support.null-audio-sink node.name=mic media.class=Audio/Source/Virtual object.linger=true audio.position=[MONO] priority.session=2000 }' > /dev/null
wait_for 10 sh -c 'pactl list short sinks | grep -q speakers && pactl list short sources | grep -qw mic' || { echo "devices missing"; exit 1; }
pactl set-default-sink speakers
pactl set-default-source mic
sleep 1

ec_modules() { pactl list short modules | grep -c module-echo-cancel; }
stream_device() { # stream_device sink-inputs|source-outputs <app-name> -> device name
	local kind=$1 app=$2 dev idx
	if [ "$kind" = sink-inputs ]; then
		idx=$(pactl -f json list sink-inputs | python3 -c "import json,sys; print(next((str(s['sink']) for s in json.load(sys.stdin) if s['properties'].get('application.name')=='$app'), ''))")
		pactl list short sinks | awk -v i="$idx" '$1==i {print $2}'
	else
		idx=$(pactl -f json list source-outputs | python3 -c "import json,sys; print(next((str(s['source']) for s in json.load(sys.stdin) if s['properties'].get('application.name')=='$app'), ''))")
		pactl list short sources | awk -v i="$idx" '$1==i {print $2}'
	fi
}

dev_is() { [ "$(stream_device "$1" "$2")" = "$3" ]; }
n_ec_is() { [ "$(ec_modules)" = "$1" ]; }

echo "== baseline: no filter request"
pacat --playback --raw --client-name=plain-play --property=media.role=music /dev/zero & PLAIN=$!; PIDS+=($PLAIN)
sleep 2
check "plain stream plays on speakers" test "$(stream_device sink-inputs plain-play)" = speakers
check "no echo-cancel loaded for plain stream" test "$(ec_modules)" = 0
kill $PLAIN; wait $PLAIN 2>/dev/null

echo "== single stream with filter.want=echo-cancel (no pair yet)"
pacat --playback --raw --client-name=voip-play --property=media.role=phone --property=filter.want=echo-cancel /dev/zero & PLAY=$!; PIDS+=($PLAY)
sleep 2
check "unpaired stream stays on speakers" test "$(stream_device sink-inputs voip-play)" = speakers
check "no echo-cancel loaded without a paired stream" test "$(ec_modules)" = 0

echo "== paired record stream with filter.want=echo-cancel"
parec --raw --client-name=voip-rec --property=media.role=phone --property=filter.want=echo-cancel > /dev/null & REC=$!; PIDS+=($REC)
check "module-echo-cancel auto-loaded" wait_for 10 n_ec_is 1
pactl list short modules | grep module-echo-cancel
check "playback routed to speakers.echo-cancel" wait_for 10 dev_is sink-inputs voip-play speakers.echo-cancel
check "record routed to mic.echo-cancel" wait_for 10 dev_is source-outputs voip-rec mic.echo-cancel
echo "-- links"
pw-link -l | sed 's/^/   /'
check "echo-cancel playback feeds speakers" sh -c 'pw-link -l | grep -A3 "^echo-cancel-playback" | grep -q "|-> speakers:"'
check "echo-cancel capture reads mic" sh -c 'pw-link -l | grep -A3 "^mic:capture" | grep -q "|-> echo-cancel-capture:"'

echo "== stream with filter.suppress=echo-cancel is not filtered"
pacat --playback --raw --client-name=voip-suppressed --property=media.role=phone --property=filter.want=echo-cancel --property=filter.suppress=echo-cancel /dev/zero & SUP=$!; PIDS+=($SUP)
sleep 2
check "suppressed stream stays on speakers" test "$(stream_device sink-inputs voip-suppressed)" = speakers
kill $SUP; wait $SUP 2>/dev/null

echo "== second call from the same group reuses the loaded filter"
parec --raw --client-name=voip-rec2 --property=media.role=phone --property=filter.want=echo-cancel > /dev/null & REC2=$!; PIDS+=($REC2)
check "second record stream routed to mic.echo-cancel" wait_for 10 dev_is source-outputs voip-rec2 mic.echo-cancel
check "still exactly one module-echo-cancel" test "$(ec_modules)" = 1
kill $REC2; wait $REC2 2>/dev/null

echo "== streams end -> filter is unloaded"
kill $PLAY $REC; wait $PLAY $REC 2>/dev/null
check "module-echo-cancel unloaded when unused" wait_for 20 n_ec_is 0
check "echo-cancel nodes removed" sh -c '! pactl list short sinks | grep -q echo-cancel'

if [ $FAIL != 0 ]; then
	echo "---- pipewire-pulse log (filter lines)"
	grep -i "filter\|echo" "$WORK/pipewire-pulse.log" | tail -60
	echo "RESULT: FAIL"
	exit 1
fi
echo "RESULT: PASS"
