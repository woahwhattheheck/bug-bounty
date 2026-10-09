# Current-head focused demo — PR #1244 / issue #742

This directory holds the inputs, driver and (after the run) outputs of a
focused cloud execution of the real Gyroflow desktop application at the live
PR #1244 head. It complements — and does not replace — `../demo.mp4`, which was
recorded from source tree `74e2508f055ac0e4e94bebf7025cfab10bfe3940` and remains
the earlier full demonstration.

Target head at dispatch time: `122d742e0b80cfcde7dda436969953056985998d`
(work/camera-lens-catalog-742). The workflow fails closed if the checked-out
commit differs.

## Scope — only behaviors that changed after `74e2508f`

| Segment | Changed behavior | Input | Expected evidence |
|---|---|---|---|
| A | Unbranded camera prefill resolves a **unique** model alias (`217fda1`) | `uniq.mp4` + `uniq.gcsv`: `vendor` empty, `id` `Alpha 7 IV` | Selectors auto-fill Camera brand `Sony`, Camera model `ILCE-7M4` |
| B | Unbranded camera prefill refuses an **ambiguous** model (`122d742`) | `amb.mp4` + `amb.gcsv`: `vendor` empty, `id` `a77` (Sony + apeman) | Brand stays unchosen; model appears as manual "Other" text `a77`; no auto-selection |
| C | Legacy `lens_info` fallback prefill (`26212bc`, `07567f8`, `94c0637`) | `lensfb.mp4` + `lensfb.gcsv`: Canon EOS 1100D, `lens_type` `Telemetry default` (no catalog match), `lens_info` `Canon EF-S 18-55mm f/3.5-5.6 IS II` | Lens combo prefilled with the catalog label matched via `lens_info`, not `lens_type` |
| D | Zoom focal-range upload validation (`fb490a0`, `b76eee9`) | Lens calibrator, generated chessboard clip, identity prefilled to Canon EOS 1100D + EF-S 18-55mm zoom | Export refused without focal length; refused at 200 mm ("outside the documented range"); GPLv3 consent at 55 mm ("No" saves locally, nothing uploaded) |

The six previously accepted core regressions and other accepted groups are
deliberately not rerun.

## How the metadata reaches the app (no harness, no fixture)

Each input is a real playable MP4 plus a same-basename `.gcsv` sidecar — the
format documented at docs.gyroflow.xyz. Opening the MP4 makes
`controller.load_telemetry` ask `telemetry-parser` for input parsers; a plain
ffmpeg MP4 has no native telemetry, so the parser finds `<name>.gcsv` next to
it. `GyroflowGcsv` yields `vendor` -> camera brand, `id` -> camera model and the
remaining two-column header rows as `Metadata` JSON, which
`camera_identifier.rs` maps to `lens_type` -> `lens_model`, `lens_info` ->
`lens_info`, `focal_length`, etc. `LensProfile.qml`/`LensCalibrate.qml` receive
it as `additional_data.camera_identifier` in the normal `telemetry_loaded`
signal — the same production path as a camera file. The app log prints the
`CameraIdentifier` debug dump for each segment.

## Files

- `../../DEMO.md` — prior full demo provenance (unchanged)
- `drive.sh`, `env.sh`, `find.py`, `gen_chessboard.py` — adapted from `../repro/`
- `make_inputs.sh` — renders the chessboard clip and writes the four `.gcsv` files
- `record.sh` — one continuous Xvfb+x11grab capture, xdotool input only
- `run/` — created by the workflow: `raw.mkv`, `marks.txt`, `shots/*.png`,
  `app_*.log`, `input_sha256.txt`, `result.json`, saved profile JSON
- `../../.github/workflows/gyroflow742-head-demo.yml` — manual-dispatch workflow

## Money state

No award or payment is verified for issue #742. This directory records evidence
of behavior in the existing original-author PR only.
