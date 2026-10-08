# HANDOFF · Dasharo/open-source-firmware-validation#320 · Open Collective (3mdeb) $51-$100 · READY FOR SUBMISSION

**Issue:** https://github.com/Dasharo/open-source-firmware-validation/issues/320 ("Remove regression-qemu.sh script", open, label `bounty-easy`, milestone OSFV release v0.3.0)
**Bounty / platform:** 3mdeb bounty program, https://3mdeb.com/bug-bounty/ . Payouts go through the 3mdeb Open Collective, https://opencollective.com/3mdeb_com
**Amount:** easy tier, $51-$100, per the program page. The issue text does not state a figure, so the award inside the tier is set by 3mdeb.
**Payout evidence:** Open Collective expense "Dasharo bug bounty payout for issue #1219 (PR #148 merged)", 2026-04-15, EUR 50.00, status Paid, from the 3mdeb_com collective. This shows 3mdeb pays merged Dasharo bounty PRs through Open Collective.

## Assignment (claim step for the submitter)
#320 is assigned to PLangowski. The program page says a maintainer assigns the contributor, and an assignee with no update or commit for one month may be unassigned. The last commit by PLangowski on `main` is 820edbd (2025-03-19). Submitter: comment on #320 asking for assignment, and link the PR in that comment.

## Issue summary
The issue asks for a single regression entry point: "All platforms should use a single regression.sh script." `scripts/regression-qemu.sh` is a separate QEMU-only wrapper that runs eight suites, with its own copy of the environment setup and suite list. Every other regression run goes through `scripts/regression.sh`.

## Root cause / change
`regression-qemu.sh` is the only regression entry point that bypasses `regression.sh`. A QEMU run needs no `FW_FILE` or `DEVICE_IP`, so `regression.sh` could not run it as is.
- `scripts/regression.sh`: new `run_qemu_regression` function with the same eight suites in the same order, the same defaults (`RTE_IP=127.0.0.1`, `SNIPEIT_NO=no`) and the same FIXME-commented `reset-to-defaults.robot` entry. It runs when `CONFIG=qemu`, before the `FW_FILE` and `DEVICE_IP` checks. Extra arguments are forwarded to each robot run. Any other `CONFIG` value takes the existing full-regression path unchanged.
- `scripts/regression-qemu.sh`: deleted. `git grep` on `main` finds no reference to it in `.github/`, `scripts/`, `docs/` or `README.md`.
- `docs/qemu.md`: documents the unified command, `CONFIG=qemu ./scripts/regression.sh`.

## Files changed
- `scripts/regression.sh` (+38)
- `scripts/regression-qemu.sh` (deleted, -38)
- `docs/qemu.md` (+8)
Total: 3 files changed, 46 insertions(+), 38 deletions(-).

## Validation (focused only)
No robot suite file was touched, so no `robot --dryrun` was needed. Commands and results:

1. `bash -n scripts/regression.sh` → exit 0, no output.
2. Behaviour comparison with a stub `robot` on `PATH`, fixed `RUN_DATE`, scratch `LOGS_DIR`, `ALLOW_DIRTY=1`:
   - `bash scripts/regression-qemu.sh` on `main` 0014f57 → 8 robot invocations, exit 0.
   - `CONFIG=qemu bash scripts/regression.sh` on the fix branch → 8 robot invocations, exit 0.
   - `diff` of the two invocation sequences, with log paths normalised → no differences ("IDENTICAL robot invocation sequence: 8 invocations").
3. `env -u FW_FILE -u DEVICE_IP CONFIG=novacustom-nuc_box-125H bash scripts/regression.sh` → `Error: Environment variable FW_FILE is not set.`, exit 1 (unchanged full path).
4. `env -u FW_FILE -u DEVICE_IP CONFIG=qemu bash scripts/regression.sh` → exit 0, 8 invocations (QEMU needs no firmware file).
5. `CONFIG=qemu bash scripts/regression.sh -- -L DEBUG` → exit 0, `-L DEBUG` present in 8 of 8 invocations (arguments forwarded).
6. `git apply --check fix.patch` on `main` 0014f5794bdc89850c2b8b1743beeb77703c6151 → applies cleanly.

Not run: a live QEMU robot run (no QEMU/OSFV testbed in this container). `shellcheck` is not installed here, so it was not run.

## Base / apply
Base: `main` @ 0014f5794bdc89850c2b8b1743beeb77703c6151 (the default branch of Dasharo/open-source-firmware-validation).
Apply: `git am fix.patch`. Author: woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>.

## Competing PRs
- No open PR for #320 (PR search for "320 regression-qemu": 0 open, 3 closed, one unrelated merged PR from 2024).
- #1280 "fix: fold qemu regression into main wrapper" (tzh476): closed without merge on 2026-07-16. The author's closing comment: "Closing this to respect the current ownership and avoid unsolicited overlap." It takes the same direction as this patch.
- #1273 "ci: run qemu regression through shared script" (BryanGM12): closed on 2026-08-26 by deleting the head branch, with no reviews. It also changes QEMU platform capability flags. This patch does not change any platform flag.

## PR draft
Title:
```
scripts: Run QEMU regression through regression.sh (#320)
```

Body:
```
Fold the QEMU suite list from scripts/regression-qemu.sh into scripts/regression.sh behind CONFIG=qemu and remove the separate script, so every platform runs through one regression entry point.

The QEMU path runs the same eight suites in the same order, keeps the previous defaults (RTE_IP=127.0.0.1, SNIPEIT_NO=no), and needs neither FW_FILE nor DEVICE_IP. Other CONFIG values take the unchanged full path. Extra arguments are forwarded to each robot run. docs/qemu.md documents the command:

    CONFIG=qemu ./scripts/regression.sh

Validation:
- bash -n scripts/regression.sh
- With a stub robot on PATH, the robot invocation sequence of the old script and of CONFIG=qemu scripts/regression.sh is identical (8 runs).
- Without CONFIG=qemu, FW_FILE is still required (exit 1 when unset).

Closes #320

Claim: #320 (3mdeb bounty-easy, Open Collective 3mdeb_com). Requesting the bounty payout for #320 through the 3mdeb Open Collective on merge.
```

## Payout steps (Open Collective, after merge)
Program: https://3mdeb.com/bug-bounty/ . Collective: https://opencollective.com/3mdeb_com
1. After the PR merges and closes #320, open https://opencollective.com/3mdeb_com and sign in with the payout account.
2. Click "Submit expense".
3. Title: "Dasharo bug bounty payout for issue #320 (PR #<number> merged)". This matches the #1219 expense title.
4. Amount: the figure 3mdeb confirms inside the easy tier ($51-$100), in the currency 3mdeb confirms. The #1219 precedent was EUR 50.00.
5. In the description, give the PR URL and the issue URL. Complete the payout profile and tax details that Open Collective asks for, then submit.
