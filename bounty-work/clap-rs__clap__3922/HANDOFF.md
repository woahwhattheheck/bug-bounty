# HANDOFF · clap-rs/clap#3922 · Open Collective $20

Status: **HANDOFF, ready for submission** (see "clap AI policy facts" below; they decide how this has to be submitted)

| | |
|---|---|
| Issue | https://github.com/clap-rs/clap/issues/3922 "Support delimited values for native completions" (open, unassigned, labels `💸 $20`, A-builder, A-completion, C-enhancement, E-help-wanted) |
| Bounty | `💸 $20` label; process in https://github.com/clap-rs/clap/blob/main/CONTRIBUTING.md#conditions-for-fulfilling-a-bounty |
| Platform | Open Collective, https://opencollective.com/clap (invoice "Issue Bounty" after merge) |
| Amount | $20 USD |
| Base | `clap-rs/clap` `main` @ `ccc89b83875474399e9d9d70841163f6319d1a41` ("chore(deps): Update Rust Stable to v1.99 (#6545)", 2026-10-06) |
| Patch | `fix.patch`, 3 commits (test, refactor, fix), author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`, 2 files, +145/−24 |

## Payout evidence

- CONTRIBUTING.md: the PR must fix the bounty issue and be merged by a maintainer; the contributor then files an Open Collective invoice titled "Issue Bounty" that links the issue, and maintainers approve it.
- Open Collective GraphQL (`expenses(account:{slug:"clap"})`, 17 expenses total) shows 7 PAID issue-bounty expenses: 2020-09-26 $10 (kirill-fedorov), 2020-10-19 $5 and 2020-10-24 $5 (castillodel), 2021-01-29 $5 (sujal-bolia), 2021-07-27 $10 "Issue Bounty for #2319" and 2021-08-02 $10 "Issue Bounties for #2448 and #2500" (patrick-gu), 2023-07-06 $5 (silas-groh). No rejected bounty expenses. Collective balance is $19,461.57.
- No evidence found of merged bounty PRs that went unpaid. The most recent paid issue bounty is from 2023-07.

## clap AI policy facts (read before submitting)

- `AI_POLICY.md` on main (2026-08-12, updated 2026-09-21):
  - "Using AI as tools for coding requires receiving permission on the relevant issue before a PR is posted."
  - "We do not allow autonomous agents to be used for contributing to this project." Maintainers close PRs "created without meaningful involvement from the contributor".
  - "The involvement of AI assistance must be disclosed in PRs." The PR template has a required `LLM involvement:` line.
  - The PR body and replies must be in the contributor's own words. AI-written comments may be hidden or deleted.
  - AI-generated code is banned outright only for completion shell scripts. This patch touches no shell script; it changes only Rust in `clap_complete/src/engine/complete.rs` and its tests.
- History on this exact issue: PR #6517 (JulesB40, "fix(complete): Preserve positional prefixes", Codex-authored) was closed by epage on 2026-09-11 with "there is insufficient human involvement for this to be worth reviewing". Before closing, epage wrote: "This is the wrong fix. The problem is with `complete_arg_value` stripping off the prefix and re-applying it for positionals" and "a proper fix requires some subtlety". The sibling Codex PR #6518 for #3923 was closed the same day for the same reason.
- What this means for submission: the submitter must first ask on #3922 for permission to post an AI-assisted PR. The `LLM involvement:` line must be answered truthfully, and the PR body should be rewritten in the submitter's own words. The draft below is a factual starting point, not a substitute for that. The patch also takes a different approach from #6517 (see "Differences from #6517").

## Issue summary

#3922 (epage, 2022) asks native (`unstable-dynamic`) completions to support `value_delimiter`. PR #5602 (shannmu, merged 2024-08-16, "Related issue #3922", no closing keyword) added `rsplit_delimiter`. Since then, `complete_arg_value` splits the token at the last delimiter, completes the remainder and re-applies the prefix. The issue stayed open.

## Root cause of the remaining defect

`complete_arg` passes the **raw** command-line token to `complete_arg_value` for positionals (`ValueDone`/`Pos` states) and for pending options (`Opt` state). `complete_arg_value` always strips everything up to the last delimiter as "prior values". When the raw token is really a flag, the stripped prefix is flag syntax, so unrelated values get offered.

Snapshots on main that encode the bug:

- `suggest_delimiter_values`: `--delimiter=comma,[TAB]` offers `--delimiter=comma,a_pos`, `--delimiter=comma,b_pos`, `--delimiter=comma,c_pos` (values of the positional `pos`). `-D=comma,[TAB]` offers `-D=comma,a_pos` and the others the same way.
- New test `suggest_delimiter_values_flag_like`, showing current behavior: with a positional that allows hyphen values, `--delimiter=comma,[TAB]` offers `--delimiter=comma,--a_pos`. After `--format` (`num_args(0..=1)`), `--format --delimiter=comma,[TAB]` offers `--delimiter=comma,json` and `--delimiter=comma,toml` (values of `--format`).

The parser never treats these tokens as values of those arguments. `--delimiter` is a known long, so it wins over hyphenated values, and an option without `allow_hyphen_values` does not take `--...` as its value.

## Change (3 atomic commits, following clap's "test commit first" convention)

1. `test(complete): Show delimited values on flag-like args`: adds `suggest_delimiter_values_flag_like` with snapshots of the **current** behavior. It covers an `allow_hyphen_values` positional with a delimiter (`--a_pos,` must keep splitting), a known long with a delimiter, and the `Opt`-state case. The test passes on this commit.
2. `refactor(complete): Pull out single value completion`: splits `complete_arg_value` (delimiter split + prefix re-apply) from a new `complete_value` (candidates for one value, tagging). No behavior change; all 34 engine tests pass unchanged.
3. `fix(complete): Don't split delimited values out of flags`:
   - adds `is_value_of(arg, cmd, value_arg, is_continuation)`, which mirrors `clap_builder`'s parser rules (`Parser::get_matches_with`, `parse_long_arg`, `parse_short_arg`, `is_new_arg`):
     - `-` and non-hyphen tokens are values;
     - an argument that is already taking values (`Opt`/`Pos`) with `allow_hyphen_values` accepts any token;
     - `allow_negative_numbers` accepts negative numbers;
     - a positional with `allow_hyphen_values` accepts `--x` only if `x` is not a known long or alias, and accepts `-xyz` only if some character is not a known short or alias;
     - everything else is a flag;
   - adds `complete_raw_arg_value`, which uses `complete_arg_value` (delimiter-aware) when the raw token is a value, and `complete_value` (whole token, no split) otherwise. The non-value case keeps the behavior from before delimiter support: candidates are matched against the whole token, and custom completers still get the whole token.
   - The `ValueDone`, `Pos` and `Opt` branches of `complete_arg` call it. `complete_option`'s `--flag=value` / `-f=value` paths are unchanged because they already pass only the value part.
   - Snapshot updates: the bogus `a_pos`/`--a_pos`/`json` candidates disappear from the 4 cases above. `--a_pos,[TAB]` still gives `--a_pos,--a_pos` and `--a_pos,--b_pos`.

No CHANGELOG edit; clap maintainers write the changelog at release, and epage asked #6518 to drop its changelog edit.

## Differences from #6517 (closed)

- #6517 added an `unescaped_positional: Option<&ParsedArg>` parameter to `complete_arg_value` and filtered the delimiter there using a rule based on the leading `-`. That rule did not tell known flags from hyphenated values, so `--delimiter=comma,` was still split for a positional with `allow_hyphen_values`. It also did not cover the `Opt` state (`--format --delimiter=comma,`).
- This patch keeps `complete_arg_value` a pure "value → candidates" function. The decision about whether a raw token is a value is made in `complete_arg`, where the parse state is known, using the parser's own precedence rules. That is the "stripping off the prefix and re-applying it for positionals" problem epage identified.

## Files changed

```
clap_complete/src/engine/complete.rs    | 115 +++++++++++++++++++++++++++-----
clap_complete/tests/testsuite/engine.rs |  54 +++++++++++++--
```

## Validation (focused: the engine test module for the touched code, plus lint on the touched crate)

```
$ cargo test -p clap_complete --features unstable-dynamic --test testsuite suggest_delimiter_values
test engine::suggest_delimiter_values ... ok
test engine::suggest_delimiter_values_flag_like ... ok
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 109 filtered out

$ cargo test -p clap_complete --features unstable-dynamic --test testsuite engine::
test result: ok. 34 passed; 0 failed; 0 ignored; 0 measured; 77 filtered out

$ cargo fmt -p clap_complete -- --check        # clean
$ cargo clippy -q -p clap_complete --features unstable-dynamic --all-targets   # no warnings
```

Toolchain: rustc 1.97.0. MSRV 1.85: the patch uses only `Option::is_some_and`/`Result::is_ok_and` (1.70).

Each commit was checked: commit 1 passes with snapshots of current behavior, commit 2 passes unchanged, and commit 3 passes with the updated snapshots.

Extra edge cases checked by hand (throwaway test, not committed):

- With an `allow_hyphen_values` positional, `-x,` and `-v,` are still split, because `,` is not a known short and the parser treats them as values.
- With an `allow_negative_numbers` positional, `-1,` is no longer split. The parser rejects `-1,-2` because `is_negative_number` fails on it.
- `-` and `--` are unchanged.

## How to apply

```
git clone https://github.com/clap-rs/clap && cd clap
git checkout -b fix/issue-3922 ccc89b83875474399e9d9d70841163f6319d1a41
git am /path/to/fix.patch
cargo test -p clap_complete --features unstable-dynamic --test testsuite engine::
```

## Competition

- No open PR references #3922 (GitHub "Development": no branches or pull requests).
- #6517 (JulesB40) is closed and unmerged (see above).
- No fleet TAKE in Slack for clap #3922.

## PR draft (clap template; the submitter rewrites the body in their own words per AI_POLICY.md)

**Title:** `fix(complete): Don't split delimited values out of flags`

**Body:**

```
### What does this PR try to solve?

Closes #3922

Native completions still offer delimited values in the wrong place. With a positional
`pos` that has a `value_delimiter`, `--delimiter=comma,<TAB>` and `-D=comma,<TAB>` suggest
`--delimiter=comma,a_pos` etc., and `--format --delimiter=comma,<TAB>` suggests values of
`--format` behind `--delimiter=comma,`. `complete_arg_value` strips everything up to the last
delimiter as prior values, but for positionals and pending options it is handed the raw
argument, which here is a flag.

The fix only splits on the delimiter when the parser would treat the raw argument as values
of that argument (hyphenated values, known flags taking precedence, negative numbers), and
otherwise completes the whole token as before delimiter support existed.

Commits: a test showing current behavior, a refactor pulling single-value completion out of
`complete_arg_value`, then the fix with the snapshot changes.

This issue carries the $20 bounty label. Per CONTRIBUTING.md I'll redeem the bounty through
Open Collective (https://opencollective.com/clap/expenses/new, "Issue Bounty", linking #3922)
once this is merged, and I'm asking for that payout on merge.

### Notes to reviewers

- `complete_option`'s `--flag=value` paths are unchanged; they already pass only the value.
- `allow_hyphen_values` positionals still split (`--a_pos,<TAB>` -> `--a_pos,--b_pos`).

LLM involvement: <submitter fills in truthfully; the patch was drafted with an AI coding agent and must be disclosed per AI_POLICY.md>
```

Bounty claim after merge: Open Collective → https://opencollective.com/clap/expenses/new → Invoice → title "Issue Bounty" → description `https://github.com/clap-rs/clap/issues/3922` → amount 20.
