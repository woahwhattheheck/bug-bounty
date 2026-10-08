#!/bin/bash
# Launch the exact-head gyroflow release binary on the Xvfb display with isolated settings.
. /home/user/work/gyroflow-demo/env.sh
export DISPLAY=:142
export XDG_CONFIG_HOME=/home/user/work/gyroflow-demo/xdg/config
export XDG_DATA_HOME=/home/user/work/gyroflow-demo/xdg/data
export XDG_CACHE_HOME=/home/user/work/gyroflow-demo/xdg/cache
cd /home/user/work/clones/gyroflow__gyroflow
exec ./target/release/gyroflow "$@"
