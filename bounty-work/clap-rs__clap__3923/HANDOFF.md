# HANDOFF · clap-rs/clap#3923 · Open Collective $20

Status: **HANDOFF, ready for submission** (the clap AI policy facts below decide how this has to be submitted)

| | |
|---|---|
| Issue | https://github.com/clap-rs/clap/issues/3923 "Support `is_require_equal_set` in native completions" (open, unassigned, labels `💸 $20`, A-completion, C-enhancement, E-easy, E-help-wanted) |
| Bounty | `💸 $20` label; process in https://github.com/clap-rs/clap/blob/main/CONTRIBUTING.md#conditions-for-fulfilling-a-bounty |
| Platform | Open Collective, https://opencollective.com/clap (invoice "Issue Bounty" after merge) |
| Amount | $20 USD |
| Base | `clap-rs/clap` `main` @ `ccc89b83875474399e9d9d70841163f6319d1a41` (2026-10-06) |
| Patch | `fix.patch`, 2 commits (test, fix), author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`, 2 files, +161/−16 |

## Payout evidence

Same collective as clap#3922. CONTRIBUTING.md describes the bounty process: the PR is merged, then the contributor files an Open Collective invoice titled "Issue Bounty" that links the issue. Open Collective GraphQL shows 7 PAID issue-bounty expenses between 2020-09 and 2023-07 ($5–$10 each, e.g. "Issue Bounty for #2319", "Issue Bounties for #2448 and #2500"). The collective balance is $19,461.57. No evidence of unpaid merged bounties.

## clap AI policy facts (read before submitting)

- `AI_POLICY.md` rules:
  - "Using AI as tools for coding requires receiving permission on the relevant issue before a PR is posted."
  - "We do not allow autonomous agents to be used for contributing".
  - "The involvement of AI assistance must be disclosed in PRs". The template has a required `LLM involvement:` line.
  - The PR body and replies must be in the contributor's own words.
  - AI code is banned only for completion shell scripts. This patch does not touch `clap_complete/src/env/shells.rs` or any shell script.
- History on this issue: #6518 (JulesB40, Codex-authored, "fix(complete): Respect required equals") was closed by epage on 2026-09-11. He cited the AI policy and wrote that "there is insufficient human involvement". During review he had asked "How much of this PR and communication is human vs LLM?".
- What this means for submission: the submitter must first ask permission on #3923, answer `LLM involvement:` truthfully, and rewrite the PR body in their own words.

## Competition

- **#6260** (AndreasBackx, "feat(complete): Support require_equals in completion engine", open, not draft). It was approved by pksunkara on 2026-02-13. epage left 4 review comments the same day. The PR's current diff (fetched 2026-10-08) addresses none of them:
  1. "We need a test case with `num_args(0..=1)`" (pointing at the git example's `--color[=<WHEN>]`; "major use case");
  2. "The intention might not be obvious in the code. Would be good to find a way to make this clear";
  3. "`takes_values` is redundant";
  4. "`shorts_and_visible_aliases` is not covered".
  Its last activity was a cross-reference from #6518 on 2026-09-08.
- **How this patch differs from #6260:**
  - Short flags are handled: `-F=` candidates, `-F<TAB>` → `-F=json`, `-F <TAB>` doesn't complete values, and `-Fj` is not completed as a value.
  - `num_args(0..=1)` is covered in the test and handled the way the parser does (see below).
  - The intent is named in helpers (`takes_next_value`, `takes_attached_value`, `flag_suffix`) with comments.
  - There is no redundant `takes_values` check, because `require_equals` implies a value-taking arg (`debug_asserts`: `is_require_equals_set requires is_takes_value_set`).
- #6518 is closed and unmerged.
- No fleet TAKE in Slack for clap #3923.

## Parser behavior this mirrors (`clap_builder/src/parser/parser.rs`)

- `parse_opt_value`: with `require_equals` and no `=`, `min_vals == 0` sets the flag with no value (`AttachedValueNotConsumed` for short clusters), and otherwise returns `EqualsNotProvided` (an error). A value is only taken from `=value`.
- `parse_short_arg`: after `AttachedValueNotConsumed` it `continue`s, so in `-cv` with optional `require_equals` `-c`, the `v` is another short flag.

## Change

1. `test(complete): Show require_equals behavior`: adds `suggest_require_equals`, modeled on the git example. It has `--format/-F` (`require_equals`, one value) and `--color/-c` (`require_equals`, `num_args(0..=1)`), plus a positional. The snapshots record current behavior: `--format [TAB]` → `json yaml`, `--color [TAB]` → `always never …`, `-F[TAB]` → `-Fjson`, `-c[TAB]` → `-calways`, `-F [TAB]` → `json yaml`. The parser rejects or ignores all of these.
2. `fix(complete): Respect require_equals in native completions`:
   - `flag_suffix`: long, hidden-alias and short candidates for a `require_equals` arg that needs a value become `--format=` / `-F=`. Bash's registration script already turns off the trailing space for candidates ending in `=`. Optional values (`--color`) keep the bare flag, which is valid on its own.
   - `takes_next_value`: in the main loop (long and short), a `require_equals` option no longer moves into `ParseState::Opt`, so the next argument completes as positionals, options and subcommands.
   - `takes_attached_value`: in `parse_shortflags`, an optional-value `require_equals` short only takes the rest of the cluster when it starts with `=`. Otherwise the rest is more short flags, matching `AttachedValueNotConsumed`.
   - `complete_option` short path: values are attached with `=` when nothing is attached yet (`-F` → `-F=json`), and `-Fj` (a value attached without `=`) gets no value candidates.

Snapshot changes in the fix commit (only `suggest_require_equals` changes; the other 33 engine tests are untouched):

```
--[TAB]          --format            -> --format=
--format [TAB]   json yaml           -> pos_a pos_b --format= --color --help
--color [TAB]    always never pos_a… -> pos_a pos_b --format= --color --help
-[TAB]           -F                  -> -F=
-F[TAB]          -Fjson -Fyaml       -> -F=json -F=yaml
-F [TAB]         json yaml           -> pos_a pos_b --format= --color --help
-c[TAB]          -calways -cnever    -> -cF= -cc -ch
--color=[TAB], -c=[TAB]: unchanged (always/never with the `=` prefix)
```

No CHANGELOG edit; maintainers write it at release.

## Files changed

```
clap_complete/src/engine/complete.rs    |  72 +++++++++++++++++-----
clap_complete/tests/testsuite/engine.rs | 105 ++++++++++++++++++++++++++++++++
```

## Validation (focused)

```
$ cargo test -p clap_complete --features unstable-dynamic --test testsuite suggest_require_equals
test result: ok. 1 passed; 0 failed; ... 110 filtered out

$ cargo test -p clap_complete --features unstable-dynamic --test testsuite engine::
test result: ok. 34 passed; 0 failed; 0 ignored; 0 measured; 77 filtered out   (at both commits)

$ cargo fmt -p clap_complete -- --check                                         # clean
$ cargo clippy -q -p clap_complete --features unstable-dynamic --all-targets    # no warnings
```

rustc 1.97.0; nothing above MSRV 1.85 is used.

`fix.patch` applies cleanly on main@ccc89b83 with `git am`. It also stacks on top of the clap#3922 patch (`git am -3`, no conflicts) if both are submitted.

## How to apply

```
git checkout -b fix/issue-3923 ccc89b83875474399e9d9d70841163f6319d1a41
git am /path/to/fix.patch
cargo test -p clap_complete --features unstable-dynamic --test testsuite engine::
```

## PR draft (clap template; the submitter rewrites the body in their own words per AI_POLICY.md)

**Title:** `fix(complete): Respect require_equals in native completions`

**Body:**

```
### What does this PR try to solve?

Closes #3923

With `require_equals`, the parser only accepts values attached with `=`, but native
completions offered `json` after `--format `, `-Fjson` for `-F`, and plain `--format`.

Now flags that need a value complete to `--format=`/`-F=`, the next argument is no longer
treated as the value, and short values are attached with `=`. For an optional value
(`num_args(0..=1)`, like the git example's `--color[=<WHEN>]`) the bare flag stays a valid
completion and the value is only taken after `=`, so `-cv` keeps `v` as a flag the same way
the parser does.

The first commit records the current behavior in `suggest_require_equals`, so the second
commit's snapshot diff shows exactly what changed.

This issue carries the $20 bounty label. Per CONTRIBUTING.md I'll redeem it through Open
Collective (https://opencollective.com/clap/expenses/new, "Issue Bounty", linking #3923)
once this is merged, and I'm asking for that payout on merge.

### Notes to reviewers

- This also covers the review points left on #6260: a `num_args(0..=1)` case, short flags,
  no `takes_values` check (`require_equals` already implies it), and named helpers for intent.

LLM involvement: <submitter fills in truthfully; the patch was drafted with an AI coding agent and must be disclosed per AI_POLICY.md>
```

Bounty claim after merge: https://opencollective.com/clap/expenses/new → Invoice → "Issue Bounty" → `https://github.com/clap-rs/clap/issues/3923` → 20.
