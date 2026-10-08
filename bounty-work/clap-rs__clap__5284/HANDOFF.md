# HANDOFF · clap-rs/clap#5284 · Open Collective $20

Status: **HANDOFF, ready for submission** (the clap AI policy facts below decide how this has to be submitted)

| | |
|---|---|
| Issue | https://github.com/clap-rs/clap/issues/5284 "Support subcommand flags in native completion engine" (open, unassigned, labels `💸 $20`, A-completion, C-enhancement, E-medium) |
| Bounty | `💸 $20` label; process in https://github.com/clap-rs/clap/blob/main/CONTRIBUTING.md#conditions-for-fulfilling-a-bounty |
| Platform | Open Collective, https://opencollective.com/clap (invoice "Issue Bounty" after merge) |
| Amount | $20 USD |
| Base | `clap-rs/clap` `main` @ `ccc89b83875474399e9d9d70841163f6319d1a41` (2026-10-06) |
| Patch | `fix.patch`, 2 commits (test, feat), author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`, 2 files, +241/−9 |

## Payout evidence

Same collective as clap#3922/#3923. CONTRIBUTING.md describes the bounty process: the PR is merged, then the contributor files an Open Collective invoice titled "Issue Bounty". Open Collective GraphQL shows 7 PAID issue-bounty expenses between 2020-09 and 2023-07. The collective balance is $19,461.57. No evidence of unpaid merged bounties.

## clap AI policy facts (read before submitting)

- `AI_POLICY.md` rules:
  - Permission is required on the issue before an AI-assisted PR is posted.
  - "We do not allow autonomous agents to be used for contributing".
  - AI assistance must be disclosed (the PR template has a required `LLM involvement:` line).
  - The PR body and replies must be in the contributor's own words.
  - AI code is banned only for completion shell scripts; this patch touches none.
- epage closed the Codex-authored PRs #6517 (for #3922) and #6518 (for #3923) on 2026-09-11 for "insufficient human involvement".
- What this means for submission: the submitter asks permission on #5284 first, answers `LLM involvement:` truthfully, and writes the PR body in their own words.

## Issue requirements (epage, 2024-01-04) and how they are met

1. "#3656 added subcommand support but left out pacman-style flag subcommands" → `Command::short_flag` / `long_flag` subcommands (and their aliases) are now offered and followed.
2. "subcommand short flags can be conjoined with each other and regular short flags (`-Sq`)" → `parse_shortflags` switches to the subcommand when it meets a short flag subcommand anywhere in the group. The remaining flags are looked up on that subcommand, as `clap_builder`'s `parse_short_arg` does with `flag_subcmd_skip`. This also answers epage's review on draft #6262: "short flag subcommands can be anywhere in the list of short flags, not just the first".
3. "We shouldn't offer hidden options by default but complete them if the user starts typing them" → flag-subcommand candidates go through `populate_command_candidate`, so hidden subcommands are `hide(true)` and hidden flag aliases are added as hidden. The engine already drops hidden candidates while any visible one matches, so `--[TAB]` does not list `--hidden` but `--hid[TAB]` completes it. Flag candidates also share the subcommand's id (`command::<name>`). For an empty argument, the engine's id dedup keeps only the subcommand name (`sync`) and does not repeat `-S`/`--sync`.

## Change

1. `test(complete): Show flag subcommand behavior`: adds `suggest_flag_subcommand`. It builds a pacman-like command: root `-v/--verbose`; `sync` with `short_flag('S')`, `long_flag("sync")`, `-s/--search`, `-b/--dbpath <db_a|db_b>`, positional `<pkg_a|pkg_b>`; and a hidden `hidden` subcommand with `-H/--hidden`. The snapshots record that flag subcommands are currently ignored: `-S [TAB]` completes the root, `-S[TAB]` offers root flags, and `--s[TAB]` gives nothing.
2. `feat(complete): Support flag subcommands in native completions`:
   - Main loop: an unknown long that matches a long flag subcommand switches `current_cmd` (args take precedence, as in `parse_long_arg`). In a short group, if `parse_shortflags` reports a subcommand, it switches `current_cmd`, and the group is not treated as a hyphenated positional.
   - `parse_shortflags` returns the subcommand it switched to. An unknown short that matches a short flag subcommand switches the command for the rest of the group, and a value-taking option found after that belongs to the subcommand (`-Sb <TAB>` completes `--dbpath` values).
   - `complete_option`: long flag subcommands are added next to the long options (empty, `-`, `--`, `--prefix`), and short flag subcommands are chained into the short listings. Inside a group, the shorts of the last flag subcommand are offered (`-vS<TAB>` → `-vSs`, `-vSb`, `-vSh`).
   - New helpers: `long_flag_subcommands`, `short_flag_subcommands`, `find_short_flag_subcommand`, `find_long_flag_subcommand`.

Snapshot changes in the feat commit:

```
 [TAB]          unchanged (sync, help, --verbose, --help; -S/--sync deduped behind `sync`)
--[TAB]         + --sync  Synchronize packages        (--hidden stays hidden)
--s[TAB]        "" -> --sync
--hid[TAB]      "" -> --hidden
-[TAB]          + -S  Synchronize packages
-S[TAB]         -Sv -Sh            -> -Ss -Sb -Sh      (sync's flags)
-vS[TAB]        -vSv -vSh          -> -vSs -vSb -vSh
-S [TAB]        root completions   -> pkg_a pkg_b --search --dbpath --help
--sync [TAB]    root completions   -> pkg_a pkg_b --search --dbpath --help
-vSs [TAB]      root completions   -> pkg_a pkg_b --search --dbpath --help
-Sb [TAB]       root completions   -> db_a db_b
```

No CHANGELOG edit; maintainers write it at release.

## Files changed

```
clap_complete/src/engine/complete.rs    | 117 +++++++++++++++++++++++++---
clap_complete/tests/testsuite/engine.rs | 133 ++++++++++++++++++++++++++++++++
```

## Validation (focused)

```
$ cargo test -p clap_complete --features unstable-dynamic --test testsuite suggest_flag_subcommand
test result: ok. 1 passed; 0 failed; ... 110 filtered out

$ cargo test -p clap_complete --features unstable-dynamic --test testsuite engine::
test result: ok. 34 passed; 0 failed; 0 ignored; 0 measured; 77 filtered out   (at both commits)

$ cargo fmt -p clap_complete -- --check                                         # clean
$ cargo clippy -q -p clap_complete --features unstable-dynamic --all-targets    # no warnings
```

Combination check: the clap#3922, #3923 and #5284 patches stack on main@ccc89b83 in that order with `git am -3` (no conflicts). With all three applied, `engine::` gives 36 passed, 0 failed.

## How to apply

```
git checkout -b fix/issue-5284 ccc89b83875474399e9d9d70841163f6319d1a41
git am /path/to/fix.patch
cargo test -p clap_complete --features unstable-dynamic --test testsuite engine::
```

## Competition

- **#6262** (AndreasBackx, "feat(complete): Support flag-style subcommands in completion engine"). It is a **draft**, with no activity since 2026-02-13. It resolves only a flag subcommand in the **first** position of a short group, and epage's review on it says "short flag subcommands can be anywhere in the list of short flags, not just the first". It also changes `tests/testsuite/bash.rs` PTY snapshots that are unrelated to the feature.
- **How this patch differs:** it handles flag subcommands anywhere in the group. The same loop also follows a flag subcommand nested inside another, though no test covers that case. Hidden flag subcommands and aliases are covered. Empty-argument listings are not duplicated (shared id). It changes no shell PTY snapshots.
- No fleet TAKE in Slack for clap #5284.

## PR draft (clap template; the submitter rewrites the body in their own words per AI_POLICY.md)

**Title:** `feat(complete): Support flag subcommands in native completions`

**Body:**

```
### What does this PR try to solve?

Closes #5284

Native completions ignored pacman-style flag subcommands: `-S`/`--sync` were never offered
and `-S <TAB>` kept completing the parent command.

Flag subcommands are now offered next to the other flags and switch completions to the
subcommand. As in the parser, a short flag subcommand can be anywhere in a group of short
flags (`-vSs`); flags after it are looked up on the subcommand. Hidden flag subcommands and
hidden flag aliases are only completed once typed, and `-S`/`--sync` aren't repeated next to
`sync` for an empty argument because they share its id.

The first commit records the current behavior in `suggest_flag_subcommand`; the second
commit's snapshot diff shows the change.

This issue carries the $20 bounty label. Per CONTRIBUTING.md I'll redeem it through Open
Collective (https://opencollective.com/clap/expenses/new, "Issue Bounty", linking #5284)
once this is merged, and I'm asking for that payout on merge.

### Notes to reviewers

- Args take precedence over flag subcommands, matching `parse_long_arg`/`parse_short_arg`.

LLM involvement: <submitter fills in truthfully; the patch was drafted with an AI coding agent and must be disclosed per AI_POLICY.md>
```

Bounty claim after merge: https://opencollective.com/clap/expenses/new → Invoice → "Issue Bounty" → `https://github.com/clap-rs/clap/issues/5284` → 20.
