# HANDOFF · woahwhattheheck/pocketpay-mobile#8 → Stellar-PocketPay/pocketpay-mobile#400

Status: **HANDOFF** (help_request: focused regression run + fix on top of the fleet carrier)

| Field | Value |
|---|---|
| Upstream issue | https://github.com/Stellar-PocketPay/pocketpay-mobile/issues/400 ("Refactor async action components"), OPEN, unassigned, no linked PR |
| Carrier (fork PR) | https://github.com/woahwhattheheck/pocketpay-mobile/pull/8, OPEN, no reviews |
| Carrier branch / head | `fix/grantfox400-confirm-rejection-20261008-gpt6-d1` @ `706c732d779f7c0b358499c9e9a18dd71b7d12da` |
| Review base | `c3a24abacb45030eb4fef41aabc46b312aaf54a3` (sponsor `main`, fork branch `bounty/review-base-c3a24ab-20261008`) |
| Platform | GrantFox: labels `GrantFox OSS`, `Official Campaign \| FWC26`, `Maybe Rewarded` |
| Amount | Not verified. The issue has only the "Maybe Rewarded" label, and contribute.grantfox.xyz is a client-rendered SPA with no server-side listing to read. |
| Payout evidence | None specific to this repo was found in this pass. GrantFox is on the owner's green list. |
| New head (local, not pushed) | `e47c4bb7939205131fe2aa64b1049c0246d70cdd` = 706c732d + 2 commits |

## What was asked

The publisher handoff (#bug-bounty, 2026-10-07 23:55 EDT) said the focused regression `tests/async-confirmation-failure.test.tsx` was authored but not run. This pass ran only the jest file PR #8 adds, at head 706c732d, and fixed it on top as woahwhattheheck.

## Result at 706c732d (before)

```
$ npx jest --watchAll=false tests/async-confirmation-failure.test.tsx
FAIL tests/async-confirmation-failure.test.tsx
  ● Test suite failed to run
    Jest encountered an unexpected token
    .../node_modules/lucide-react-native/dist/esm/lucide-react-native.mjs:8
    export { default as AArrowDown, ... } from './icons/a-arrow-down.mjs';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
    > 15 | import { X, AlertTriangle } from 'lucide-react-native';
      at Object.require (src/components/ConfirmModal.tsx:15:1)
      at Object.require (tests/async-confirmation-failure.test.tsx:3:1)
Test Suites: 1 failed, 1 total
Tests:       0 total
```

**Root cause:** the new suite imports `ConfirmModal`, which imports `lucide-react-native`. That package ships untransformed ESM, and the jest-expo preset does not transform it. Every sibling suite that renders these components (`__tests__/useConfirm.test.tsx`, `BackupReminderModal`, `ErrorBoundary`, `NetworkStatusBanner` and others) stubs it with a per-file `jest.mock('lucide-react-native', ...)`. The new file did not. The product code was not at fault. None of the 3 authored cases ran.

## Changes on top of 706c732d (2 commits, 1 file)

1. `6d150e5 test(confirm): stub lucide icons so the #400 regression suite loads`: adds the repo-standard `jest.mock('lucide-react-native', () => ({ X: () => null, AlertTriangle: () => null }))`. With this, the 3 authored cases run and pass unchanged.
2. `e47c4bb test(confirm): cover the rendered redacted retry error for #400`: the carrier's `ConfirmModal` changes (commits d3436df and 706c732) had no test. This commit adds 2 rendered cases:
   - Through `useConfirm` + `ConfirmModal`: a rejected destructive action keeps the dialog open. It shows the `accessibilityRole="alert"` message "Unable to complete this action. Please try again." and never the thrown text (`secret seed in provider error`). The promise stays unresolved. A retry then resolves `true`, closes the dialog and clears the alert.
   - Declarative `ConfirmModal`: after a failure, hiding (`visible={false}`) and reopening clears the stale alert.

Files changed vs 706c732d: `tests/async-confirmation-failure.test.tsx` (+88 / -1). The full PR vs c3a24aba is 4 files: `src/hooks/useConfirm.tsx`, `src/components/ConfirmModal.tsx`, `docs/async-actions-and-confirmations.md`, `tests/async-confirmation-failure.test.tsx` (288 insertions, 29 deletions).

## Validation (focused only)

Dependencies: the `help-ppmobile-397-regression` node_modules does not exist on this machine. Installed from the repo lockfile with `npm ci --ignore-scripts --no-audit --no-fund` (948 packages, Node 22.22.0, npm 10.9.4). Deleted node_modules afterward.

```
# PR-added suite after commit 1 (authored cases only)
$ npx jest --watchAll=false tests/async-confirmation-failure.test.tsx
PASS tests/async-confirmation-failure.test.tsx
  async confirmation failure and lifecycle
    ✓ does not resolve true on a rejected destructive action and permits retry
    ✓ cannot let a superseded dialog settle its replacement
    ✓ blocks duplicate submits, cancellation and supersession during an in-flight action
Tests:       3 passed, 3 total

# Final head e47c4bb: PR suite + the existing hook regression the PR changes behaviour under
$ npx jest --watchAll=false tests/async-confirmation-failure.test.tsx __tests__/useConfirm.test.tsx
PASS tests/async-confirmation-failure.test.tsx   (5 tests)
PASS __tests__/useConfirm.test.tsx               (7 tests)
Test Suites: 2 passed, 2 total
Tests:       12 passed, 12 total

# Type-check of the two changed source files only (temporary tsconfig extending the repo's;
# the repo tsconfig excludes tests/ and __tests__/, so test files are not type-checked upstream)
$ npx tsc --noEmit -p tsconfig.focus400.json   # include: src/hooks/useConfirm.tsx, src/components/ConfirmModal.tsx
exit 0
```

Mutation checks show the suite catches the defects:
- Restoring `src/hooks/useConfirm.tsx` and `src/components/ConfirmModal.tsx` to c3a24aba: **5/5 fail** (`Tests: 5 failed, 5 total`).
- Removing only the `if (!visible) setConfirmError(false);` reset effect from the head: **1 fails** (the declarative-reopen case) and 4 pass.

No full suite, lint or CI entrypoint was run.

## How to apply

On the carrier branch at 706c732d:

```
git checkout fix/grantfox400-confirm-rejection-20261008-gpt6-d1   # @ 706c732d779f7c0b358499c9e9a18dd71b7d12da
git am fix.patch                                                  # 2 commits, author woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>
```

`full-series-vs-c3a24aba.patch` is the 7-commit series (the carrier's 5 + these 2) against sponsor `main` c3a24aba, for opening the upstream PR from a fresh branch. Both were checked with `git am` in a scratch worktree, and both produce the same tree, `6ebcaf7863baa29335fce1de25687b595ed5f1b2`. The carrier's 5 original commits keep their existing author email (`brycembusiness2@gmail.com`). The 2 new commits use the noreply address.

## Competition / overlap (facts)

- **Upstream PRs for #400:** none. Searching `is:pr 400` on Stellar-PocketPay/pocketpay-mobile returns 0 results.
- **#400 vs #368:** #400's text matches #368 ("Refactor reusable async action and confirmation components"). Merged PR #383 (giftexceed, merged 2026-07-27 by El-swaggerito, `Closes #368`) already shipped `useConfirm`, `ReviewConfirm`, `LoadingState` and the `ConfirmModal`/`AsyncActionButton` pending state, and migrated payments/wallet/vault/contacts. PR #8 is a correctness and accessibility fix on top of those shared components. It does not add a new scaffold. The PR body below states this so a reviewer can see what #400 adds over #368.
- **Same-account upstream PR #572** (`fix(confirm): bind confirmation settlement to request identity`, OPEN since 2026-10-06, head `woahwhattheheck:work/pocketpay-confirmation-identity-20261006-7ca6`, 1 file `src/hooks/useConfirm.tsx`) rewrites the same `settle`/`handleConfirm`/`handleCancel` code. PR #8's hook change includes the same request-identity binding (per-request `id` and stale callbacks become no-ops) and adds fail-closed rejection and the in-flight guard. With both open upstream, whichever merges second needs `src/hooks/useConfirm.tsx` rebased. The upstream #400 PR body can mention that it includes #572's identity binding (optional line below).

## Ready-to-paste upstream PR

Head: the carrier branch after `git am fix.patch` (or a fresh branch from `full-series-vs-c3a24aba.patch`) → base `Stellar-PocketPay/pocketpay-mobile:main`.

**Title:** `fix(ui): handle rejected async confirmations safely (#400)`

**Body:**

```markdown
Closes #400

/claim #400

## Summary

The shared async action and confirmation components from #383 (`useConfirm`, `ConfirmModal`, `AsyncActionButton`, `ReviewConfirm`) are used across payments, wallet, vault and contacts. This PR fixes the reliability and accessibility gaps left in that shared confirmation path, so every flow that uses it gets the same safe behaviour:

- **Fail closed on rejected actions.** `useConfirm` settled with `finally { settle(true) }`, so a destructive `onConfirm` that threw still resolved `confirm()` to `true` and closed the dialog. It now resolves `true` only after the action completes. On rejection the dialog stays open, its spinner clears, and the user can retry or cancel.
- **Accessible, redacted retry error.** `ConfirmModal` catches the rejection and shows a generic, screen-reader-announced message (`accessibilityRole="alert"`, polite live region): "Unable to complete this action. Please try again." It never shows the thrown error text, which can contain wallet or storage details. The message clears when a declarative modal is hidden and reopened.
- **Request identity and in-flight safety.** Each confirmation carries its own id. Confirm and cancel callbacks kept from a superseded dialog are no-ops, so they cannot run, settle or dismiss the replacement. While an action is in flight, cancel is ignored and a new `confirm()` resolves `false` instead of replacing work that may already have side effects. Duplicate presses stay blocked.
- **Docs.** `docs/async-actions-and-confirmations.md` now documents the fail-closed retry and supersession rules.

Business logic in the payment, wallet, vault and contact flows is unchanged. They pick up the fix through the shared components.

## Files

- `src/hooks/useConfirm.tsx`
- `src/components/ConfirmModal.tsx`
- `docs/async-actions-and-confirmations.md`
- `tests/async-confirmation-failure.test.tsx` (new)

## Tests

    npx jest --watchAll=false tests/async-confirmation-failure.test.tsx __tests__/useConfirm.test.tsx
    Test Suites: 2 passed, 2 total
    Tests:       12 passed, 12 total

The new suite covers rejected-action retry, superseded-dialog isolation, in-flight duplicate submit, cancel and supersede, the rendered redacted alert, and clearing the alert on reopen. Run against the previous `useConfirm`/`ConfirmModal`, all 5 new cases fail. The existing `useConfirm` suite passes unchanged.

## Bounty

This PR resolves #400 under the GrantFox OSS / FWC26 campaign. When it is merged, please assign the #400 GrantFox reward to @woahwhattheheck.
```

Optional line for the body if #572 is still open when this is submitted:
`Includes the request-identity binding from #572 (stale confirm/cancel callbacks cannot settle a replacement dialog).`
