# HANDOFF · Dasharo/open-source-firmware-validation#980 · 3mdeb bounty (tier not stated on the issue) · amount to confirm with 3mdeb · READY FOR SUBMISSION (scope: FW_URI part of the issue)

**Issue:** https://github.com/Dasharo/open-source-firmware-validation/issues/980 ("Automate managing firmware binaries in OSFV", open, no assignee, labels "bounty" and "enhancement"; not archived)
**Bounty / platform:** 3mdeb bounty label. The issue carries no tier label, and the coordinator's "tiered" note is not on the page.
**Amount:** to confirm with 3mdeb. Past example per coordinator: $50 for #1219, not verified here.
**Process:** the repo has no bounty or claim documentation (grep for "bounty" across the repo finds nothing). Confirm the claim process with 3mdeb before submitting.

## Scope (what this patch does and does not cover)
The issue asks for: fetching firmware by version (FW_REPO + FW_VERSION) or by direct URL (FW_URI), keeping FW_FILE for local debugging, and caching binaries.
This patch implements the FW_URI part with caching:
- When FW_FILE is unset and FW_URI is set, the regression wrappers fetch the image (http, https or file) and use the cached copy as FW_FILE.
- Cache entries are keyed by the SHA-256 of the full URI, default dir `${FW_CACHE_DIR:-~/.cache/osfv/firmware}`.
- Optional FW_SHA256 pins the image. Mismatches are rejected and never cached.
- FW_FILE behaviour is unchanged.

Not in this patch (remaining plan below): FW_REPO + FW_VERSION resolution (tag-based fetch from the upstream CI or dl.3mdeb.com), cache invalidation, and DMIDECODE auto-parameters tied to version (possibly #632).

## Root cause / change
Testers pass FW_FILE by hand, so they can run the wrong or a stale binary. The regression entry points only accept a local path.
- `scripts/lib/fw_resolve.py` (new): `resolve(uri, cache_dir, expected_sha256)`. Downloads to a temp `.part` file in the cache directory and renames it into place only after the non-empty and optional SHA-256 checks pass. Standard library only.
- `scripts/lib/robot.sh`: new `resolve_fw_file` function, which calls the resolver when FW_FILE is unset and FW_URI is set.
- `scripts/regression.sh`, `scripts/regression-rerun-failed.sh`: call `resolve_fw_file` before the existing FW_FILE check.
- `scripts/lib/test_fw_resolve.py` (new): 7 focused unit tests.

## Files changed
scripts/lib/fw_resolve.py (new), scripts/lib/test_fw_resolve.py (new), scripts/lib/robot.sh (+ function), scripts/regression.sh (+1 call), scripts/regression-rerun-failed.sh (+1 call). 290-line patch.

## Validation (focused only)
```
python3 -m unittest discover -s scripts/lib -p 'test_fw_resolve.py'
  .......
  Ran 7 tests in 0.123s
  OK
bash -n scripts/lib/robot.sh && bash -n scripts/regression.sh && bash -n scripts/regression-rerun-failed.sh   → ok
black --check scripts/lib/fw_resolve.py scripts/lib/test_fw_resolve.py   → 2 files would be left unchanged
# shell path, sourcing robot.sh with a file:// FW_URI
FW_URI=file://<tmp>/bios.rom FW_CACHE_DIR=<tmp>/cache; resolve_fw_file
  FW_FILE=<tmp>/cache/a1546d2b336c2b07/bios.rom   content=rom-bytes
# neither FW_FILE nor FW_URI set
  Error: Environment variable FW_FILE is not set.   → exit 1
```
Not run: a real robot regression against a device (none available). shellcheck is not installed here, so pre-commit's shellcheck was not run.

The 7 unit tests cover: reuse of cache, same file name from two URIs (no collision), failed download leaves no cache entry, empty download rejected, SHA-256 mismatch rejected and not cached, SHA-256 match accepted, unsupported scheme rejected.

## Base / apply
Base: `master` @ 0014f5794bdc89850c2b8b1743beeb77703c6151. Apply: `git am fix.patch` (author woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>). Verified: applies cleanly on the base and the tree matches the branch.

## Competing PRs
- #1256 `scripts: add FW_URI support for regression firmware download` (WuXieSec, OPEN, "Closes #980", last updated Sep 5, 2026, no maintainer reviews). Reviewer Rishet11 reported two defects: different URLs with the same file name reuse the wrong cached bytes, and a failed download can leave a partial file that is later served as a cache hit. This patch fixes both (URI-hash keys, temp file + SHA-256 gate before rename) and has tests for both.
- #1270 `feat: resolve firmware binaries from FW_URI` (Spina7, OPEN, "Closes #980", no reviews). Uses `${FW_CACHE_DIR:-$HOME/.cache/osfv/firmware}` with a FW_VERSION subdirectory. No test for the cache-key or partial-download cases that #1256's reviewer raised.

## PR draft
Title: scripts: resolve FW_URI into a cached FW_FILE for regression runs (#980)

Body:
```
When FW_FILE is not set, the regression wrappers fetch the image named by FW_URI (http, https or file) and use the cached copy as FW_FILE. FW_FILE is unchanged for local images.

The cache is keyed by the SHA-256 of the full URI, so URIs that share a file name never reuse each other's entry. Downloads go to a temp file in the cache directory and are renamed into place only after the optional FW_SHA256 check passes and the file is non-empty. A failed download is never served as a cache hit.

scripts/lib/test_fw_resolve.py covers reuse, URI collisions, failed and empty downloads, SHA-256 mismatch and unsupported schemes.

Scope: FW_URI only. FW_REPO/FW_VERSION resolution is not included.

Validation: python3 -m unittest discover -s scripts/lib -p 'test_fw_resolve.py' (7 tests OK); bash -n on the three shell files; black --check on the two Python files.

Refs #980 (FW_URI part). Requesting the bounty for #980 on merge; amount to be confirmed with 3mdeb.
```

## Remaining plan (for the rest of #980)
1. FW_REPO + FW_VERSION: resolve a release/tag from the upstream CI or dl.3mdeb.com into a URI, then reuse the resolver.
2. Add a `FW_REFRESH=1` option to ignore the cache, and document the cache layout in docs/.
3. Optionally derive DMIDECODE parameters from the version (see #632).
4. Run one regression wrapper against a device or QEMU image in CI.
