#!/bin/bash
# Generates the focused demo inputs:
#  - one real playable 10 s 720p30 chessboard clip (rendered input data)
#  - four same-basename .gcsv sidecars so the app's normal telemetry path
#    (telemetry-parser GyroflowGcsv -> controller.load_telemetry ->
#    CameraIdentifier -> additional_data.camera_identifier -> selector prefill)
#    produces exactly the metadata each segment needs.
set -euo pipefail
EVI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IN="$EVI_DIR/run/input"
mkdir -p "$IN"

python3 "$EVI_DIR/gen_chessboard.py" | ffmpeg -hide_banner -loglevel error -y \
  -f rawvideo -pix_fmt rgb24 -s 1280x720 -r 30 -i - \
  -c:v libx264 -pix_fmt yuv420p -crf 20 "$IN/base.mp4"
sha256sum "$IN/base.mp4"
for n in uniq amb lensfb calib; do cp "$IN/base.mp4" "$IN/$n.mp4"; done

python3 - "$IN" <<'PY'
import sys

IN = sys.argv[1]

# 120 IMU rows @ 90 ms (tscale 0.001) -> ~10.8 s of gyro+accel samples.
def rows():
    out = []
    for i in range(120):
        t = i * 90
        gx = 18.0 * ((i % 9) / 4.0 - 1.0)
        gy = 12.0 * ((i % 7) / 3.0 - 1.0)
        gz = 6.0 * ((i % 5) / 2.0 - 1.0)
        ax = 0.05 * ((i % 6) / 2.5 - 1.0)
        ay = -0.04 * ((i % 8) / 3.5 - 1.0)
        az = 0.98 + 0.01 * (i % 3)
        out.append(f"{t},{gx:.3f},{gy:.3f},{gz:.3f},{ax:.4f},{ay:.4f},{az:.4f}")
    return "\n".join(out) + "\n"

COMMON_TAIL = "tscale,0.001\norientation,XYZ\nt,gx,gy,gz,ax,ay,az\n" + rows()

def write(name, *hdrs):
    with open(f"{IN}/{name}.gcsv", "w", encoding="utf-8", newline="\n") as f:
        f.write("GYROFLOW IMU LOG\n")
        f.write("version,1.3\n")
        for k, v in hdrs:
            f.write(f"{k},{v}\n")
        f.write(COMMON_TAIL)

# Segment A: unbranded camera, model is a UNIQUE catalog alias
# ("Alpha 7 IV" -> sony/ilce-7m4) -> selector must auto-fill Sony / ILCE-7M4.
write("uniq",
      ("id", "Alpha 7 IV"),
      ("vendor", ""))

# Segment B: unbranded camera, model is an AMBIGUOUS catalog name
# ("a77" -> both sony/a77 and apeman/A77) -> selector must NOT auto-select;
# model stays manual ("Other" + text field).
write("amb",
      ("id", "a77"),
      ("vendor", ""))

# Segment C: branded camera, lens_type does NOT match the catalog while
# legacy lens_info does -> lens selector must fall back to lens_info.
# Canon EOS 1100D -> mount Canon EF-S -> "Canon EF-S 18-55mm f/3.5-5.6 IS II".
write("lensfb",
      ("vendor", "Canon"),
      ("id", "EOS 1100D"),
      ("lens_type", "Telemetry default"),
      ("lens_info", "Canon EF-S 18-55mm f/3.5-5.6 IS II"))

# Segment D (calibrator upload validation): same camera, lens resolves to the
# 18-55mm zoom label so the documented range is 18-55 mm.
write("calib",
      ("vendor", "Canon"),
      ("id", "EOS 1100D"),
      ("lens_info", "Canon EF-S 18-55mm f/3.5-5.6 IS II"))
PY

sha256sum "$IN"/*.gcsv "$IN"/*.mp4 > "$IN/input_sha256.txt"
cat "$IN/input_sha256.txt"
