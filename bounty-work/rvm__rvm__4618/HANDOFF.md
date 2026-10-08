# HANDOFF · rvm/rvm#4618 · IssueHunt $160 · READY FOR SUBMISSION

- Issue: https://github.com/rvm/rvm/issues/4618 ("Update to latest RVM breaks on OSX")
- Bounty: https://oss.issuehunt.io/r/rvm/rvm/issues/4618. $160, funded 2019-06-24 by `issuehunt`. IssueHunt status `funded`, 0 submitted pull requests.
- Base: `rvm/rvm` master @ `92301cb20b61320daf407c3264d19ab413d1a7cb`
- Commit: `703f1c5d82476589b250a1b3acec6f72799f1506`, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`
- Apply: `git am fix.patch`. Checked on a fresh clone of master.

## Facts the submitter should know
- **Issue state:** CLOSED on GitHub, assigned to maintainer `pkuczynski`, labels `bug` and `feedback needed`, milestone `rvm-1.29.9`.
- **Who fixed the reported symptom:** the `sed: illegal option -- r` error was fixed by PR #4711 (James Cuzella, merged 2019-06-23, the day before IssueHunt funded the issue). It replaced the `sed -E`/`sed -r` branch in `__rvm_remove_from_path` with pure-shell loops. Nobody submitted #4711, or anything else, on IssueHunt.
- **#4759 is a separate issue,** not a PR ("__rvm_unload obliterates PATH", milestone 1.29.10). It was fixed by PR #4760 (Kat R, 2019-08-20), which added the guard against removing `/*`.
- **This patch fixes what #4711 left.** In the issue thread the reporter (clive-hetzner, with danmayer and zeninfinity agreeing) showed the root cause was `_system_type` being empty when the cd hook runs, and that `sed` was only a symptom. That root cause is still on master (shown below). The patch also fixes two PATH-cleanup edges in #4711's code. It adds regression tests for #4711's slash cleanup and #4760's guard.
- **Payment is the maintainer's call.** The issue is closed and assigned to the maintainer. Precedent: on IssueHunt, `apples-kksk` was rewarded $40 on 2026-05-13 for the closed issue #4690 via PR #5654 ("Use RubyGems 2.7 for Ruby 1.9 installs", merged 2026-05-11). That PR was a code fix for behaviour still broken on master. #4690 is unassigned, which differs from #4618. IssueHunt shows rvm/rvm with $40 rewarded in total, $260 funded, $220 active.
- **Contribution rules** (`CONTRIBUTING.md`, `.github/pull_request_template.md`, `.github/mergeable.yml`):
  - RVM 1.x accepts bug fixes.
  - The PR template wants `Fixes #…`, a list of changes and a CHANGELOG entry (included).
  - mergeable requires a non-empty description and a CHANGELOG change. A label and milestone are set by maintainers.
  - `binscripts/rvm-installer` isn't touched, so the GPG signature check is unaffected.
  - The CONTRIBUTING file has no assignment rule and no AI-usage rule.
- **Overlap with our rvm#4694 patch** (`bounty-work/rvm__rvm__4694`): the two patches are independent (different functions). Both add a CHANGELOG line at the same spot, so whichever merges second needs a trivial rebase.

## Root cause still on master
- `__rvm_teardown` (`scripts/functions/environment`) runs `unset _system_arch _system_name _system_type _system_version` after every command. That line came from #4584 (commit d105f0b), the change the reporters bisected to.
- Detection (`__rvm_detect_system`) only runs when `functions/detect/system` is first sourced while RVM loads. Neither `rvm()` nor the cd hook (`__rvm_cd_functions_set` → `__rvm_do_with_env_before` → `initialize` + `__rvm_setup`) detects again.
- So everything reached from the hook sees an empty system. Shown on master with a stub `.ruby-version` of `1.8.7` and CentOS 5 simulated through RVM's supported user-db override (`system_name=CentOS`, `system_version=5` in `$rvm_path/user/db`):
  - `rvm use 1.8.7` from the CLI → `ruby-1.8.7-p374` plus the CentOS 5 warning (correct)
  - `cd` into the project, via the hook → **`ruby-1.8.7-head`** (wrong: `__rvm_db_system` ran with `_system_name=[] _system_version=[]` and fell back to the generic entry)
- The same empty values reach the other code that reads `_system_*` after load:
  - macruby/truffleruby/maglev interpreter selection
  - `__rvm_system_path` (binary rubies)
  - the travis-binaries check
  - `__rvm_get_user_shell`

## PATH-cleanup edges in #4711's code (master)
| PATH before `__rvm_remove_from_path /none` | master | this patch |
|---|---|---|
| `/:/usr/bin:/bin` | `:/usr/bin:/bin` (empty entry = current directory) | `/:/usr/bin:/bin` |
| `/usr/bin:/:/bin` | `/usr/bin::/bin` (empty entry = current directory) | `/usr/bin:/:/bin` |
| `/usr/bin:/bin/` | `/usr/bin:/bin/` (last entry not cleaned) | `/usr/bin:/bin` |
| remove `/x/.rvm/bin` from `/usr/bin:/bin:/x/.rvm/bin/` | entry left in PATH | removed |
| remove `/x/.rvm/bin/` (value has a trailing slash, e.g. `rvm_bin_path`) | not removed | removed |

## Change (7 files, +66/−2)
- `scripts/functions/db`:
  - new `__rvm_detect_system_if_needed`. It runs `__rvm_detect_system` + `__rvm_detect_system_override` only when `_system_type` is empty and detection is loaded.
  - `__rvm_db_system` calls it first.
  - Teardown still unsets the variables afterwards, so #4584's intent (not leaving `_system_*` in the user's environment) is kept, and detection costs nothing unless a lookup needs it.
- `scripts/functions/selector_interpreters` (macruby, truffleruby URL, maglev) and `scripts/functions/utility_system` (`__rvm_system_path`, `__rvm_include_travis_binaries`, `__rvm_get_user_shell`): call the helper before reading `_system_*`.
- `scripts/functions/utility` (`__rvm_remove_from_path`):
  - strip trailing slashes only from entries longer than `/`, using a `[!:]` pattern (valid in bash and zsh);
  - strip the last entry's trailing slash;
  - normalise a trailing slash in the value being removed.
  - The #4760 guard and the `//` collapse are unchanged.
- `tests/fast/remove_from_path_comment_test.sh` (new, 8 assertions): slash cleanup with `_system_type` unset (no `illegal option` output), root entries kept, trailing-slash entries and values removed, and the `/*` and `//*` guards (#4759).
- `tests/fast/system_detection_comment_test.sh` (new, 3 assertions):
  - after loading, `__rvm_db_system` redetects (`_system_type` is `Linux|Darwin`);
  - the cd hook resolves `.ruby-version` `1.8.7` to `ruby-1.8.7-p374` under a temporary CentOS 5 user-db override. The test backs up and restores `$rvm_path/user/db` with a trap.
- `CHANGELOG.md`: a Bug fixes entry under `Next`.

## Validation (focused)
Tools: ruby 3.3.6, `tf` 0.4.6 (as in CI), GNU bash 5.2.21. RVM was installed from each tree with `./install --path <tmp>/.rvm --ignore-dotfiles`, then `source <tmp>/.rvm/scripts/rvm && tf --text tests/fast/<file>`.

| test file | master install | this patch |
|---|---|---|
| `tests/fast/remove_from_path_comment_test.sh` | 4 of 8 pass, 4 fail | **8 of 8** |
| `tests/fast/system_detection_comment_test.sh` | 0 of 3 pass (`none`; `ruby-1.8.7-head`) | **3 of 3** |
| `tests/fast/pwd_cd_hook_comment_test.sh` (existing) | n/a | 10 of 10 |
| `tests/fast/version_compare_comment_test.sh` (existing) | n/a | 26 of 26 |

Also checked:
- 14 PATH-normalisation unit cases: 14/14 with the patch, 7/14 on master.
- End-to-end comparison above (CLI `rvm use 1.8.7` vs cd hook under the CentOS 5 override).
- `bash -n` on every changed script.
- `$rvm_path/user/db` is restored after the test runs.

Not run (focused-tests rule): the full `tests/fast/*` suite, and tests that install rubies (e.g. `path_mismatch_comment_test.sh`). zsh and the system bash 3.2 on macOS aren't installed here; the CI macOS jobs cover bash 3.2.

## PR title
Detect system again after teardown and harden PATH cleanup

## PR body (ready to paste)
```
Refs #4618

#4711 fixed the `sed: illegal option -- r` error reported in #4618, and #4760 added the guard for #4759. The root cause described in #4618 is still on master, though: `__rvm_teardown` unsets the `_system_*` variables after every command (#4584), and nothing detects them again before the cd hook runs. Code reached from the hook sees an empty system. For example, with CentOS 5 configured via `system_name`/`system_version` in `$rvm_path/user/db`, `rvm use 1.8.7` correctly resolves to `ruby-1.8.7-p374`, but `cd` into a project with `.ruby-version` `1.8.7` resolves to `ruby-1.8.7-head`, because `__rvm_db_system` runs with an empty `_system_name`.

Changes proposed in this pull request:
* Add `__rvm_detect_system_if_needed`, which detects the system only when `_system_type` is empty, and call it from `__rvm_db_system` and the other functions that read `_system_*` after loading (macruby/truffleruby/maglev selection, `__rvm_system_path`, the travis binaries check, `__rvm_get_user_shell`). Teardown still unsets the variables, so #4584 is kept.
* `__rvm_remove_from_path`: keep `/` entries. The current loop turns `/:/usr/bin` into `:/usr/bin`, and an empty entry means the current directory. Also strip a trailing slash from the last entry and from the value being removed, so `/x/.rvm/bin/` entries are removed too.
* Regression tests: `tests/fast/remove_from_path_comment_test.sh` (slash cleanup without system detection, root entries, trailing slashes, the #4759 guard) and `tests/fast/system_detection_comment_test.sh` (lookups after teardown, and the cd hook using system-specific settings via a temporary user-db override that is restored afterwards).
* CHANGELOG entry.

How it was tested: with `tf --text` against an RVM installed from this branch, both new files pass (8/8 and 3/3). Against master they fail (4/8 and 0/3). `pwd_cd_hook_comment_test.sh` (10/10) and `version_compare_comment_test.sh` (26/26) still pass.

#4618 is funded on IssueHunt (https://oss.issuehunt.io/r/rvm/rvm/issues/4618). I'll register this PR there, and I'd appreciate the bounty being released on merge if you consider it to resolve the remaining part of the issue.
```
"Refs" is used instead of "Closes/Fixes" because #4618 is already closed and the original symptom was fixed by #4711. The body credits #4711 and #4760 so the maintainer has the full picture when deciding on the reward.

## Claim / payout steps (IssueHunt)
1. Rebase onto current master if it has moved since `92301cb`. Open the PR upstream from the `woahwhattheheck` fork with the body above.
2. On https://oss.issuehunt.io/r/rvm/rvm/issues/4618, use "Submit a pull request" and pick the PR. The issue is closed on GitHub but IssueHunt still lists it as `funded`. I couldn't confirm from the public pages whether IssueHunt accepts submissions on an issue that is already closed. For #4690, the public pages don't show whether the issue was closed before #5654 or by it.
3. The maintainer decides whether to reward it on IssueHunt after merging. If rewarded, withdraw from the IssueHunt account linked to `woahwhattheheck`.
