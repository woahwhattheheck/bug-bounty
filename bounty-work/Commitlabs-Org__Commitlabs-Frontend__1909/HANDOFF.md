# HANDOFF: Commitlabs-Org/Commitlabs-Frontend#1909 (CommitmentEarlyExitModal unit tests)

Status: **HANDOFF**. The fleet carrier tests at `35c1f468` were executed and pass (4/4). One follow-up commit adds the two remaining issue-named behaviours (6/6 pass). Ready for submission.

| Field | Value |
|---|---|
| Issue | https://github.com/Commitlabs-Org/Commitlabs-Frontend/issues/1909 |
| Platform | GrantFox (labels: `GRANTFOX OSS`, `MAYBE REWARDED`, `Official Campaign \| FWC26`) |
| Amount | Not published per issue. "Maybe Rewarded" means the sponsor decides the award. The fleet's requested floor is >= $15. contribute.grantfox.xyz is a client-rendered app, and its HTML carries no campaign rows from this container. |
| Payout evidence | Org runs an official GrantFox OSS / FWC26 campaign with 65 labelled issues (#1878-#1946). Fleet PRs #2045 / #2059 have issue-level `/claim` comments live. No settlement receipt was seen yet for this org. |
| Issue state (2026-10-08) | OPEN, unassigned, no linked PR / branch, no comments |
| Competing PRs | None. `is:pr 1909` and `is:pr EarlyExit` both return 0 open / 0 closed on the upstream repo. |
| Fleet carrier | `woahwhattheheck/Commitlabs-Frontend` branch `test/commitlabs1909-early-exit-ack-gate-20261008` head `35c1f468894e53b078f2a29585b4afc112262526` (GF-COMMITLABS1909-EARLYEXIT-TEST-R1, Slack ts 1791431009.007059) |
| Upstream base | `master` @ `0d847032ef5862806cbb678f0bca93b6be44fb17` (unchanged since the carrier was cut) |
| Submit as | woahwhattheheck |

## Issue summary

`src/components/CommitmentEarlyExitModal/` had no test file for the modal itself. The issue flags the main risk: a regression in the confirm-button gating (`hasAcknowledged`) could let a user confirm an early exit without acknowledging the penalty.

Acceptance criteria: add `src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.test.tsx` covering:
- Confirm stays disabled until the acknowledgement checkbox is checked.
- `onConfirm` and `onCancel` fire correctly.

The issue body also names "penalty display" and the "confirm/cancel flow" as modal responsibilities.

## Source check

- The component exists on master `0d847032`: `src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.tsx`.
- #1909 is not on the 23:46 source-drift 404 list, and the named path is live.
- The `ExitTimingPreview` / `GraceCountdown` sibling tests mentioned in the issue body are not in that directory on master. They are not part of the acceptance criteria.

## What was done

1. **Executed the carrier test file at `35c1f468` unchanged.** Result: 4/4 pass, so no repair was needed.
2. **Mutation check on the carrier tests.** Replacing `disabled={!hasAcknowledged}` with `disabled={false}` makes 2 of 4 fail ("disables confirmation until the penalty is acknowledged", "enables confirmation after acknowledgement and invokes the callback"). The tests guard the regression the issue is worried about. The component was restored afterwards.
3. **Follow-up commit `ff3ef3e9` on top of `35c1f468`.** It is test-only, +41 lines, same file, and adds two cases:
   - `shows the penalty breakdown the user is acknowledging` asserts that `$100.00`, `Penalty (3%)`, `-$3.00` and `$97.00` all render.
   - `cancels from the backdrop but not from clicks inside the panel` checks that clicking inside the panel does not call `onCancel` (panel `stopPropagation`), that a backdrop click calls `onCancel` once, and that `onConfirm` is never called.
4. **Mutation checks on the new cases.** Each mutant was reverted after its run:
   - Panel `stopPropagation` removed: 2 failures, including the new backdrop case.
   - Penalty row removed: 1 failure (the new penalty case).

Style matches the repo: `@vitest-environment happy-dom` (42 other test files use it), `fireEvent` with `@testing-library/react`, and prettier config (single quotes, trailing commas, width 100).

## Files changed

- `src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.test.tsx` (new in `35c1f468`; extended in `ff3ef3e9`). No production source changed.

## Validation (focused only)

Environment: Node `v20.20.0` (repo pins `>=20 <21`), deps installed exactly as CI does (`.github/workflows/coverage.yml`: `npm ci`), vitest `2.1.9`, repo `vitest.config.ts`.

```
$ export PATH=/opt/node20/bin:$PATH
$ npm ci --ignore-scripts --no-audit --no-fund
added 885 packages in 25s

# carrier head 35c1f468, unchanged
$ npx vitest run src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.test.tsx
 ✓ src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.test.tsx (4 tests) 54ms
 Test Files  1 passed (1)
      Tests  4 passed (4)

# with ff3ef3e9
$ npx vitest run src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.test.tsx --reporter=verbose
 ✓ ... > renders no dialog when closed
 ✓ ... > disables confirmation until the penalty is acknowledged
 ✓ ... > enables confirmation after acknowledgement and invokes the callback
 ✓ ... > fires cancel without confirming an early exit
 ✓ ... > shows the penalty breakdown the user is acknowledging
 ✓ ... > cancels from the backdrop but not from clicks inside the panel
      Tests  6 passed (6)

# focused coverage of the component (CONTRIBUTING requires >= 95% on new/changed logic)
$ npx vitest run src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.test.tsx --coverage \
    --coverage.include='src/components/CommitmentEarlyExitModal/**' --coverage.reporter=text
 ...yExitModal.tsx |     100 |      100 |     100 |     100 |

$ npx prettier --check src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.test.tsx
All matched files use Prettier code style!
$ npx eslint src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.test.tsx
(exit 0, no output)
$ git log -1 --format=%B | npx commitlint
(exit 0)
```

No full suite, build or typecheck was run (focused validation only).

## How to apply

There are two equivalent routes. Both were verified with `git am` in a clean worktree.

- **Onto the existing carrier branch (preferred, keeps `35c1f468`):**
  ```
  git checkout test/commitlabs1909-early-exit-ack-gate-20261008   # head 35c1f468
  git am fix.patch                                                # adds ff3ef3e9-equivalent commit
  git push origin test/commitlabs1909-early-exit-ack-gate-20261008
  ```
- **Fresh branch from upstream master:** `git checkout -b test/1909-early-exit-modal origin/master && git am full-series-vs-master.patch`. This gives two commits and the same final tree. Both commits use the `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>` identity.

Note: carrier commit `35c1f468` on the fork is authored as `woahwhattheheck <brycembusiness2@gmail.com>`, not the noreply address. Use the master route if the noreply identity should cover both commits.

`fix.patch` sha256 `68b0db073ed056a53f9446d83a5afc8b54d7ef28a6c405e117222b3933f3cd54`; `full-series-vs-master.patch` sha256 `54f8860d8e358e51513ceb7b16aa9ba5d25b8e14cd893cc1fa5ee78c24af6dfd`.

## Separate observation (outside #1909 scope, not changed here)

`src/app/commitments/[id]/page.tsx:508-519` renders the modal with `hasAcknowledged={false}` and `onChangeAcknowledged={() => {}}`. On master the checkbox can never become checked on the detail page, so Confirm stays disabled and `handleConfirmEarlyExit` is unreachable from the UI.

The issue also says the modal is wired on `src/app/commitments/page.tsx`, but only `[id]/page.tsx` imports it on master. This is a candidate for a separate fix or issue. It is not part of this test-only PR.

## Ready-to-paste PR

**Title:** `test: cover early-exit acknowledgement gate (#1909)`

**Body:**

```
Closes #1909

/claim #1909

## Summary
Adds `src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.test.tsx`, unit tests for the early-exit modal itself (not just its sub-pieces), as requested in #1909.

Six focused cases:
- renders no dialog when `isOpen` is false
- Confirm is disabled while the penalty is unacknowledged, and clicking it does not call `onConfirm`
- checking "I understand the penalty" enables Confirm, which then calls `onConfirm` once
- Cancel calls `onCancel` once without calling `onConfirm`
- the original amount, penalty label/amount and net amount are all displayed
- a backdrop click calls `onCancel`; clicks inside the panel do not, and neither path calls `onConfirm`

Test-only change; no production code modified.

## Validation
Node 20.20.0, `npm ci`, repo `vitest.config.ts`:

    npx vitest run src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.test.tsx
    Test Files  1 passed (1)
         Tests  6 passed (6)

Focused coverage for `CommitmentEarlyExitModal.tsx`: 100% statements / branches / functions / lines.
Prettier and ESLint are clean on the test file.

Regression check: making Confirm always enabled (`disabled={false}`) fails the two gating tests, so a break in the `hasAcknowledged` gate is caught.

## Bounty
This PR addresses a GrantFox OSS / FWC26 campaign issue. I'm requesting the GrantFox reward for #1909 for @woahwhattheheck once it is merged. Please confirm the reward amount (the campaign lists it as Maybe Rewarded; the request is for at least the $15 tier) and assign the issue to me if that is needed for payout. Thank you!
```

## Deliverables

- `bounty-work/Commitlabs-Org__Commitlabs-Frontend__1909/fix.patch`: 1 commit on top of carrier head `35c1f468`.
- `bounty-work/Commitlabs-Org__Commitlabs-Frontend__1909/full-series-vs-master.patch`: 2 commits on top of master `0d847032`.
- `bounty-work/Commitlabs-Org__Commitlabs-Frontend__1909/HANDOFF.md`: this file.
