# HANDOFF · rvm/rvm#4694 · IssueHunt $40 · READY FOR SUBMISSION

- Issue: https://github.com/rvm/rvm/issues/4694 ("RVM 1.29.8 throwing `_system_name: unbound variable` error on AWS under Packer"). OPEN, unassigned, label `bug`.
- Bounty: https://oss.issuehunt.io/r/rvm/rvm/issues/4694. $40 funded 2019-06-24, status `ready`.
- Payout evidence: IssueHunt repo data shows $40 rewarded for rvm/rvm (`rewardedAmount` 4000 cents), $260 total funded and $220 currently active. The repo is claimed on IssueHunt.
- Maintainer activity: master is merged regularly (Ruby/JRuby version PRs through 2026-09-27). The nounset fix "Avoid undefined `rvm_shell_nounset` variable" (#5638) is already merged and listed in CHANGELOG `Next`.
- Base: `rvm/rvm` master @ `92301cb20b61320daf407c3264d19ab413d1a7cb`
- Commit: `97b59abbc8ed64991b9b089694a9d37094c969e6`, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`
- Apply: `git am fix.patch`. Checked on a fresh clone of master.

## Contribution rules (for the submitter)
- `CONTRIBUTING.md`: RVM 1.x takes bug fixes, and new features "as long as they keep compatibility and do not break anything". Code style follows `FORMATTING.md`. The CONTRIBUTING file has no assignment rule and no AI-usage rule.
- PR template (`.github/pull_request_template.md`): `Fixes #…`, a list of changes, and a CHANGELOG entry. The entry is included.
- `.github/mergeable.yml`:
  - The description must not be empty.
  - A label and a milestone are required. Maintainers set these; competing PR #5652 reports that the label rule is its only remaining red check.
  - Every change must include `CHANGELOG.md` (it does).
  - Any change to `binscripts/rvm-installer` must also change `binscripts/rvm-installer.asc`. That's why this patch leaves the installer alone; see the notes below.
- CI: `tests/fast/*` runs with `tf --text` (`.github/actions/test`). The GPG workflow verifies the signature of `binscripts/rvm-installer`, which this patch doesn't touch.

## Root cause
The reporter's script (gist `install.sh` / `jenkins-output.txt`) sources RVM with `set +eux`, then runs `set -eux` and `rvm --default use 2.3.4`. That command re-sources `scripts/base` → `scripts/functions/support`, which immediately calls `__rvm_setup_utils_functions`. That function expands `${_system_name}`, but system detection (`functions/detect/system`) only runs *after* it, so under `-u` the shell aborts with `scripts/functions/support: line 182: _system_name: unbound variable`. Current master still fails at exactly that line with this flow.

Other nounset failures on the same paths:
- `scripts/rvm:140` reads `${rvm_prefix}` before checking whether it is set. Sourcing RVM with `-u` already enabled fails there first.
- The duplicated `rvm_user_install_flag` block (in `scripts/rvm`, `scripts/initialize`, `scripts/functions/installer`; marker `kkdfkgnjfndgjkndfjkgnkfjdgn`) expands `${USER// /_}`. `USER` isn't set in Docker `RUN` steps, cron jobs or systemd units, so loading fails with `USER: unbound variable` (`scripts/rvm:147` / `scripts/initialize:110`).
- `scripts/cd` expands `${chpwd_functions[*]}` / `"${chpwd_functions[@]}"`. Bash < 4.4 (the bash 4.2 of Amazon Linux 1 and CentOS 7) reports an unset *or empty* array as unbound.

## Change (7 files, +42/−11)
- `scripts/functions/support`: `${_system_name:-}` in `__rvm_setup_utils_functions`. This keeps master's behaviour exactly: an empty name falls back to `__rvm_setup_utils_functions_Other`.
- `scripts/rvm`: `${rvm_prefix:-}` in the "guess `rvm_prefix`" check.
- `scripts/rvm`, `scripts/initialize`, `scripts/functions/installer`: the duplicated `rvm_user_install_flag` case is changed identically in all three. The `/${USER}*` prefix test moves into an `if [[ -n "${USER:-}" && … ]]`, so a missing `USER` can neither abort the shell nor turn into a `/*` pattern that would mark every install as a user install. Checked against the original over 27 path/USER combinations on bash 4.2 and 5.2: identical results whenever `USER` is set.
- `scripts/cd`: `${chpwd_functions[*]:-}` for the membership test, and `chpwd_functions=( ${chpwd_functions[@]+"${chpwd_functions[@]}"} __rvm_cd_functions_set )` for the append. This is the portable nounset-safe idiom: it keeps the user's existing hooks and avoids `arr+=` on a possibly unset array, which `FORMATTING.md` advises against.
- `tests/fast/nounset_comment_test.sh` (new, `tf` comment-test format, 14 assertions):
  - sourcing plus `rvm current` under `bash -u`, with and without `USER`;
  - the reported flow (load RVM, then `set -eu -o pipefail`, then `rvm use system`), with and without `USER`;
  - cd-hook registration with an unset array, and preservation of an existing hook.
- `CHANGELOG.md`: a Bug fixes entry under `Next`.

**Not changed, on purpose:**
- `binscripts/rvm-installer` contains the same `rvm_user_install_flag` block. It is GPG-signed: `mergeable.yml` requires `.asc` changes alongside it, and the GPG workflow verifies the signature on every PR. The upstream precedent (#5620) shipped an installer change together with a maintainer re-signature, so the installer copy is left for the next signed release. The installer runs in its own `bash` process (`curl … | bash -s`), so it is not on the reported nounset path.
- `scripts/functions/db` (`__rvm_db_system`): `__rvm_detect_system` always exports `_system_name`/`_system_version` with an `"unknown"` default before the only caller (`scripts/functions/selector:494`) runs. #5652/#5663 guard this anyway; here it isn't reachable unset in real flows, so it is left as is to keep the diff minimal.

## Validation (focused)
Environment: Linux container with GNU bash 5.2.21, plus GNU bash 4.2 built from `ftp.gnu.org/gnu/bash/bash-4.2.tar.gz` (the Amazon Linux 1 / CentOS 7 era shell), ruby 3.3.6, `tf` 0.4.6 (as in CI).

1. **Regression test, the CI way.** RVM installed locally from the tree with `./install --path <tmp>/.rvm --ignore-dotfiles`, then `source <tmp>/.rvm/scripts/rvm && tf --text <test>`:
   - `tests/fast/nounset_comment_test.sh` on **this patch**: `Processed commands 10 of 10, success tests 14 of 14` (rc 0)
   - the same test file against an install of **master**: `success tests 2 of 14, failure tests 12 of 14`. The failures show `scripts/functions/support: line 182: _system_name: unbound variable` and `scripts/rvm: line 140: rvm_prefix: unbound variable`.
   - existing neighbouring tests on this patch: `tests/fast/pwd_cd_hook_comment_test.sh` → `success tests 10 of 10`; `tests/fast/version_compare_comment_test.sh` → `success tests 26 of 26`
2. **Reporter's exact flow** (source with nounset off, then `set -eu -o pipefail; rvm --default use ruby-3.3.0; rvm current`, using a minimal `env -i` environment and a stub ruby under `rubies/`):

   | tree | bash 5.2, USER set | bash 5.2, USER unset | bash 4.2, USER set | bash 4.2, USER unset |
   |---|---|---|---|---|
   | master | exit 127, `support: line 182: _system_name: unbound variable` | exit 127, `initialize: line 110: USER: unbound variable` | same as bash 5.2 | same as bash 5.2 |
   | PR #5663 | exit 0 | exit 127, `initialize: line 110: USER: unbound variable` | exit 0 | exit 127 (same) |
   | **this patch** | **exit 0, `ruby-3.3.0`** | **exit 0, `ruby-3.3.0`** | **exit 0** | **exit 0** |
3. **Strict sweep.** RVM sourced *with* `set -euo pipefail` already on, then 12 commands: `rvm current`, `use system`, `use ruby-3.3.0`, `--default use`, `list strings`, `list`, `gemset list`, `info`, `cd` hook, `use …@foo --create`, `alias list`, `bin/rvm-prompt`.
   - this patch: **12/12** on bash 5.2 and 4.2, with and without `USER`.
   - master: 0/12, failing at `rvm_prefix`.
   - PR #5663: 12/12 with `USER`, 0/12 without.
4. `bash -n` on every changed script. `bash -O extglob -n` was used for the installer while checking: its plain `bash -n` error at line 710 already exists on master.

Not run: the full `tests/fast/*` suite (team rule: focused tests only). zsh and bash 3.2 are untested because neither is installed here. The expansions used (`${arr[*]:-}` and `${arr[@]+"${arr[@]}"}`) are documented in both, and the CI test action runs `shell: bash`, which on its macOS jobs is the system bash 3.2. Check the macOS job results on the PR.

## Competition
IssueHunt lists two submissions; GitHub shows three open PRs for this issue. None has a maintainer review.
- #5652 (dicnunz, 2026-05-09): guards `rvm_prefix`, `_system_name`, and `__rvm_db_system`. No cd-hook fix and no `USER` handling.
- #5657 (2026-05-18): guards `rvm_prefix`, `_system_name`, and the cd hook. No `USER` handling.
- #5663 (landeqiming666, 2026-07-17): combines #5652 and #5657.

**Why ours is better:** every existing PR still fails to load RVM when `USER` is unset. That is the normal state of Docker `RUN` steps, cron and systemd services, the same provisioning contexts the issue is about. Measured: #5663 gets 0/12 commands and exit 127 on the reported flow without `USER`; this patch gets 12/12 and exit 0. Ours also:
- keeps the three duplicated `rvm_user_install_flag` blocks in sync (the repo's duplication-marker convention);
- leaves the GPG-signed installer untouched, so the signature and mergeable checks stay green;
- keeps master's exact fallback behaviour in `__rvm_setup_utils_functions` (no new `"Other"` default);
- has been validated on bash 4.2, the shell on the reporter's Amazon Linux.

## PR title
Fix unbound variable errors when RVM runs with nounset

## PR body (ready to paste)
```
Fixes #4694

Scripts that enable `set -u` (for example `set -euo pipefail` in Packer, Docker or CI provisioning) cannot load or use RVM today. The reported flow (load RVM, then `set -eux` and `rvm --default use …`) still fails on master with `scripts/functions/support: line 182: _system_name: unbound variable`.

Changes proposed in this pull request:
* `scripts/functions/support`: `__rvm_setup_utils_functions` runs before system detection, so it now reads `${_system_name:-}`. An empty name falls back to `__rvm_setup_utils_functions_Other` exactly as before.
* `scripts/rvm`: check `${rvm_prefix:-}` before guessing the prefix.
* `scripts/rvm`, `scripts/initialize`, `scripts/functions/installer`: the duplicated `rvm_user_install_flag` detection no longer expands an unset `USER`. `USER` is not set in Docker `RUN` steps, cron jobs or systemd units. An empty `USER` is never treated as a `/<user>` install prefix, and results are unchanged whenever `USER` is set (checked over 27 path/USER combinations).
* `scripts/cd`: register the cd hook with nounset-safe expansions. Bash < 4.4 treats an unset or empty `chpwd_functions` as unbound. Existing hooks are preserved.
* `tests/fast/nounset_comment_test.sh`: covers loading under `bash -u`, the reported load-then-`set -u` flow, both with and without `USER`, and cd-hook registration.
* CHANGELOG entry.

`binscripts/rvm-installer` contains the same `rvm_user_install_flag` block but is GPG-signed (`rvm-installer.asc`), so I left it for a signed release update. It runs in its own bash process and is not on this code path.

How it was tested:
* `tf --text tests/fast/nounset_comment_test.sh` against an RVM installed from this branch: 14/14 passing. The same file against master: 12 of 14 assertions fail with the errors above.
* `tf --text tests/fast/pwd_cd_hook_comment_test.sh` (10/10) and `tests/fast/version_compare_comment_test.sh` (26/26).
* The reporter's flow and a 12-command sweep (`current`, `use`, `--default use`, `list`, `gemset list`, `info`, cd hook, `--create`, `alias list`, `rvm-prompt`) with `set -euo pipefail`, on bash 5.2 and bash 4.2, with and without `USER`: all passing.

This issue is funded on IssueHunt (https://oss.issuehunt.io/r/rvm/rvm/issues/4694). I'll submit this PR there to claim the bounty, and I'd appreciate the reward being released when it's merged.
```

## Claim / payout steps (IssueHunt)
1. Open the PR upstream from the `woahwhattheheck` fork with the body above. Before that, rebase onto current master if it has moved since `92301cb`.
2. On https://oss.issuehunt.io/r/rvm/rvm/issues/4694, use "Submit a pull request" and pick the PR. IssueHunt only pays submissions registered there.
3. After the maintainer merges and rewards it on IssueHunt, withdraw from the IssueHunt account linked to `woahwhattheheck`.
