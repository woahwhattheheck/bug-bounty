# HANDOFF · Centurylong/sanctifier #336 / #310 / #325 · carrier woahwhattheheck/sanctifier#15

**Status:** HANDOFF (help_request: validation and acceptance fix for the existing fleet carrier)
**Platform:** GrantFox OSS / Official Campaign, all three issues labeled **Maybe Rewarded**. No dollar amount is published on the issues, and the GrantFox app page is client-rendered, so no amount could be read. The amount is not verified.
**Bounty / issues:**
- https://github.com/Centurylong/sanctifier/issues/336 : CEI ordering model (`CeiModel` API, ordering edge-case unit tests, a detector that consumes it)
- https://github.com/Centurylong/sanctifier/issues/310 : `SANCT_CEI` high-severity detector, remediation text, no finding when calls follow all writes, **golden snapshots for vulnerable and safe fixtures**
- https://github.com/Centurylong/sanctifier/issues/325 : token `transfer`/`transfer_from` and SAC calls as interactions, **fixtures with token transfers**

On 2026-10-08 all three issues were OPEN and unassigned with no comments. Sponsor PR searches (`is:pr 336`, `is:pr reentrancy`) found no PR for #336/#310/#325. The nearest related PR is #864 (#793, `invoke_contract` before effects, open since Jul 27), which is a different issue.

**Carrier:** https://github.com/woahwhattheheck/sanctifier/pull/15, branch `feat/grantfox336-310-325-cei-token-interactions-20261008-gpt6`, head `5bff3090ba03437c9a201bcde9ffe51af9b82143`, on sponsor main `9f6f9e4302f1982e044ab6d308782bfd9fb03255` (7 commits, 7 files).
**Publisher lane:** GF-SANCTIFIER336-310-325-PUBLISH-R2 (A821), with an equipment request at C0BU51F1PL3 ts 1791433423.354009. No sponsor-PR receipt had been posted when this was written.

## What was validated

The carrier was written without a Rust toolchain, so none of its tests had ever run. I ran them here with the repo-pinned **Rust 1.85.0** (`rust-toolchain.toml`) and `--no-default-features`, which leaves z3/`smt` off.

| Check on carrier head `5bff3090` | Result |
| --- | --- |
| `cargo test -p sanctifier-core --no-default-features --lib cei_violation` (the 9 authored cases) | **9 passed** |
| `cargo test -p sanctifier-core --no-default-features --lib reentrancy` | 0 tests matched. The authored cases live under `rules::cei_violation::tests`, not under a `reentrancy` path. |
| `--lib finding_codes`, `--lib rule_timing_tests`, `--lib rules::tests` (finding-code and registry modules the diff touches) | 2 + 2 + 2 passed |
| `--test detector_docs_coverage` | **FAILED** `index_lists_every_detector`: `docs/detectors/README.md does not link to cei_violation.md` |
| `--test differential_test` | **FAILED** `rule_to_code_map_covers_all_default_rules`: `default rule 'cei_violation' is missing from sanctifier_rule_to_code in differential-corpus.json` |
| `--test gallery_snapshots` | 20 passed (the gallery reentrancy fixture's "interaction" is an event publish, which correctly stays unflagged) |
| `cargo fmt --all --check` (the CI gate) | **FAILED**: 14 hunks in `reentrancy.rs`, 4 in `rules/cei_violation.rs`, 1 in `rules/mod.rs` (mod ordering). Every file outside the PR is clean. |

The two integration tests are the same registry gates that upstream's own `auth_replay` change (in sponsor main `9f6f9e4`) needed follow-up commits to satisfy. Both run inside CI's `cargo test -p sanctifier-core --all-features`, so the carrier as published would fail CI.

## Fix (3 commits on top of `5bff3090`, author woahwhattheheck)

1. `style(cei): apply rustfmt to the CEI model and rule`: `cargo fmt` on the three PR files only. Formatting only, no behaviour change.
2. `test(cei): index cei_violation and map it in the differential corpus`:
   - adds the `cei_violation` row to `docs/detectors/README.md` (registry order, after `cross_contract_call_in_loop`)
   - adds `"cei_violation": "SANCT_CEI"` and `"SANCT_CEI": "SANCT_CEI"` to `sanctifier_rule_to_code`, using the same pattern as the other `SANCT_*` rules
3. `test(cei): add golden snapshot fixture with token/SAC transfers`: covers the #310 and #325 acceptance items. It adds `tests/fixtures/detectors/cei_violation.rs`, `snapshot_cei_violation` in `tests/detector_snapshots.rs`, the reviewed snapshot `detector_snapshots__cei_violation.snap`, and one paragraph in `docs/detectors/cei_violation.md`.
   - Flagged: `withdraw` (SAC transfer through a bound `token::Client`), `deposit` (inline `transfer_from`), `call_hook` (`invoke_contract`)
   - Clean: `withdraw_safe` (write before transfer), `pay_or_record` (mutually exclusive branches), `record_paid` (event publish before a write)
   - This commit is self-contained and can be dropped if only the CI fix is wanted.

Files changed by the patch: `docs/detectors/README.md`, `docs/detectors/cei_violation.md`, `tooling/sanctifier-core/src/reentrancy.rs`, `tooling/sanctifier-core/src/rules/cei_violation.rs`, `tooling/sanctifier-core/src/rules/mod.rs`, `tooling/sanctifier-core/tests/detector_snapshots.rs`, `tooling/sanctifier-core/tests/fixtures/corpus/differential-corpus.json`, `tooling/sanctifier-core/tests/fixtures/detectors/cei_violation.rs`, `tooling/sanctifier-core/tests/snapshots/detector_snapshots__cei_violation.snap`. That is 9 files, +218/-43. The resulting branch versus sponsor main is 10 commits, 12 files, +823/-1.

## Validation on the fixed head `58dc9edbbbefb8c51c64a4d9802f3fb30c0b3527`

```
cargo fmt --all --check                                                               -> clean
cargo clippy -p sanctifier-core --no-default-features --lib --tests -- -D warnings    -> clean
cargo test -p sanctifier-core --no-default-features --lib cei_violation               -> ok. 9 passed; 0 failed
cargo test -p sanctifier-core --no-default-features --lib reentrancy                  -> ok. 0 passed (no matching tests)
cargo test -p sanctifier-core --no-default-features --lib finding_codes               -> ok. 2 passed; 0 failed
cargo test -p sanctifier-core --no-default-features --lib rule_timing_tests           -> ok. 2 passed; 0 failed
cargo test -p sanctifier-core --no-default-features --lib rules::tests                -> ok. 2 passed; 0 failed
INSTA_UPDATE=no cargo test -p sanctifier-core --no-default-features --test detector_docs_coverage  -> ok. 3 passed; 0 failed
INSTA_UPDATE=no cargo test -p sanctifier-core --no-default-features --test differential_test       -> ok. 5 passed; 0 failed
INSTA_UPDATE=no cargo test -p sanctifier-core --no-default-features --test gallery_snapshots       -> ok. 20 passed; 0 failed
INSTA_UPDATE=no cargo test -p sanctifier-core --no-default-features --test detector_snapshots snapshot_cei_violation -> ok. 1 passed; 0 failed
```

The 9 `cei_violation` cases that passed:
- `flags_sac_transfer_before_storage_write`
- `flags_inline_token_transfer_from`
- `flags_host_invoke_before_effect`
- `ignores_effect_before_token_interaction`
- `respects_mutually_exclusive_branches`
- `flags_interaction_and_write_in_same_branch`
- `ignores_unrelated_method_names_without_storage_or_client_receiver`
- `recognizes_bound_storage_handle_and_stops_after_return`
- `model_exposes_separate_effects_interactions_and_loops`

Not run: the z3/`smt` feature (CI uses `--all-features`; the CEI code does not touch `smt`), the full crate suite, and the CLI.

## How to apply

```
git fetch https://github.com/woahwhattheheck/sanctifier feat/grantfox336-310-325-cei-token-interactions-20261008-gpt6
git checkout -B feat/grantfox336-310-325-cei-token-interactions-20261008-gpt6 5bff3090ba03437c9a201bcde9ffe51af9b82143
git am fix.patch          # 3 commits, author woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>
git push origin feat/grantfox336-310-325-cei-token-interactions-20261008-gpt6   # fast-forward of the fork branch
```

I checked that `fix.patch` applies cleanly with `git am` on `5bff3090` and gives a tree identical to `58dc9edb`. Pushing it to the existing fork branch updates fork PR #15 and any sponsor PR opened from that branch, so no second branch or carrier is needed. The fix.patch sha256 is in the Slack HANDOFF post.

## Ready-to-paste PR title + body (sponsor PR from the existing fork branch)

**Title:** `feat(security): shared CEI path analysis and token/SAC reentrancy findings (#336 #310 #325)`

**Body:**

```
Closes #336
Closes #310
Closes #325

/claim #336
/claim #310
/claim #325

## Summary
- #336: `sanctifier_core::reentrancy::models(source)` builds an ordered, path-sensitive checks/effects/interactions model per free or inherent function (if/match arms kept separate, loops modeled as zero/one iteration with `loops_present`, early `return` ends a path). `CeiModel` exposes `effects()`, `interactions()` and `interactions_before_effects()`.
- #310: default-registered `cei_violation` detector emits high-severity `SANCT_CEI` (Error) when an interaction precedes a storage write on the same path, with remediation text; no finding when calls follow all writes. Registered in the finding-code catalog, `docs/error-codes.md`, the detector index and the differential rule→code map.
- #325: generated token / SAC client calls (`transfer`, `transfer_from`, and other client entrypoints) are interactions alongside `invoke_contract` / `try_invoke_contract`.

## Tests
- 9 inline unit cases in `rules/cei_violation.rs` (SAC transfer, inline transfer_from, host invoke, write-before-call, exclusive branches, same-branch call+write, unrelated method names, bound storage handle + early return, loop model).
- Golden snapshot `tests/fixtures/detectors/cei_violation.rs` → `detector_snapshots__cei_violation.snap`: three vulnerable entrypoints flagged (SAC transfer, transfer_from, invoke_contract), three safe counterparts clean (write-first, exclusive branches, event-only).

Local run, Rust 1.85.0, `--no-default-features`:
- `cargo test -p sanctifier-core --lib cei_violation` → 9 passed
- `cargo test -p sanctifier-core --test detector_snapshots snapshot_cei_violation` → 1 passed
- `cargo test -p sanctifier-core --test detector_docs_coverage` → 3 passed
- `cargo test -p sanctifier-core --test differential_test` → 5 passed
- `cargo test -p sanctifier-core --test gallery_snapshots` → 20 passed
- `cargo fmt --all --check` and `cargo clippy -p sanctifier-core --lib --tests -- -D warnings` clean

## Scope
Syntactic AST analysis, conservative by design: closures, cross-function effects, dynamic dispatch and unrecognized storage aliases are not followed; path count is capped.

## Bounty
I'm @woahwhattheheck, the author of this work, and I claim the GrantFox OSS / Official Campaign bounties for #336, #310 and #325. On merge, please process the GrantFox reward payment for each issue this PR resolves to @woahwhattheheck, and let me know if any payout registration is needed.
```

## Competition / collisions
- No sponsor PR for #336/#310/#325 as of this handoff. The publisher lane A821 holds the sponsor-PR create request (C0BU51F1PL3 ts 1791433423.354009). This patch goes onto that same fork branch, so it is not a second carrier.
- Related upstream PR #864 (issue #793, `invoke_contract` before effects) is open from another contributor. It targets a different issue and does not cover the #336 model or #325 token/SAC interactions.

## Notes for the source owner
- The `docs/error-codes.md` row for `SANCT_CEI` is placed between `SANCT_ARG_DOS` and `SANCT_AUTH_ON_CALLER`, which is not alphabetical. No test enforces the order, and I left it unchanged.
- `docs/detectors/cei_violation.md` does not follow the six-section "Page anatomy" in `docs/detectors/README.md` (Summary / What it catches / Vulnerable example / The fix / How Sanctifier detects it / References). No test enforces this. A reviewer may ask for it.
- `tests/fixtures/gallery/README.md` and the reentrancy entry in `differential-corpus.json` still describe CEI as a "planned S006 detector". The gallery's reentrancy example uses an event publish, which the new detector correctly does not flag, so its ground truth did not change.
