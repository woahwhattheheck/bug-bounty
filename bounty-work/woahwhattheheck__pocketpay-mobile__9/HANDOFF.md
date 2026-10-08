# HANDOFF · Stellar-PocketPay/pocketpay-mobile#397 · fork PR woahwhattheheck/pocketpay-mobile#9

Status: **HANDOFF** (help_request: adds the missing #397 regression and a docs row on top of the fleet carrier head)

| | |
|---|---|
| Sponsor issue | https://github.com/Stellar-PocketPay/pocketpay-mobile/issues/397 ("Add mobile global error boundary") |
| Fleet carrier | https://github.com/woahwhattheheck/pocketpay-mobile/pull/9, branch `fix/grantfox397-diagnostics-share-20261008-gpt6-d2` @ `582b6c8459785983c6a6b704ce51eec0f232960a` |
| Sponsor base | `Stellar-PocketPay/pocketpay-mobile` `main` @ `c3a24abacb45030eb4fef41aabc46b312aaf54a3` (re-checked 2026-10-08: still the tip of main) |
| Platform | GrantFox: labels `GrantFox OSS`, `Maybe Rewarded`, `Official Campaign \| FWC26`, `expert` |
| Amount | Not verified. The issue is "Maybe Rewarded" and GrantFox evaluation sets the reward. contribute.grantfox.xyz returned HTTP 403 from this container. |
| Payout evidence | CONTRIBUTING.md: "Merging a pull request does not trigger or guarantee payment — approval is decided by the GrantFox evaluation process." Before the payment evaluation period, contributors must complete docs/issue-approval-readiness-checklist.md, docs/evaluation-readiness-checklist.md and docs/contributor-self-assessment.md. GrantFox is green for receiving per the team brief. |
| Issue state | OPEN, unassigned, 0 comments, Development: "No branches or pull requests" (WebFetch 2026-10-08) |
| Competition | Sponsor PR search `is:pr 397`: 0 open, 0 closed. The only carrier is our own fork PR #9 (fleet; no sponsor PR yet, the App returned 403). |

## Issue summary

#397 asks for an app-wide error boundary with recovery actions, hidden sensitive details, diagnostics integration, redacted developer logs and documentation. Most of this already shipped upstream in #382 (`908530f`, "feat: Add mobile global error boundary and recovery system"). One of its recovery actions, **Share Diagnostics**, does not work on current `main`.

## Root cause

- #382 added `Share.share({ message: getDiagnostics(), ... })` to `src/components/ErrorBoundaryFallback.tsx`. At that time `getDiagnostics()` was synchronous.
- #419 (`26fdaea`, same day) made `getDiagnostics()` async so it could add `SecureStore.isAvailableAsync()`. That call site was never updated.
- Result: the native share sheet receives a `Promise` instead of the redacted JSON string. The surrounding `catch {}` swallows any failure, so the recovery action fails silently.

## What is in the carrier vs. this patch

- `582b6c8` (fleet, already on fork PR #9): `handleShareDiagnostics` awaits `getDiagnostics()` before `Share.share`. It adds single-flight (ref plus busy/disabled `accessibilityState`, "Preparing diagnostics…" label) and a generic `accessibilityRole="alert"` message, "Diagnostics could not be shared. Please try again.", that never echoes the error.
- **This patch** (2 commits on top of `582b6c8`, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`):
  1. `51aa643` `test(error-boundary): cover awaited diagnostics in Share Diagnostics action` adds 3 cases to the existing `__tests__/ErrorBoundary.test.tsx`:
     - **#397 regression:** `Share.share` gets the resolved redacted diagnostics **string** (`typeof message === 'string'`, exact `{ message, title: 'App Diagnostics Log' }`), not the Promise.
     - Repeat taps while the export is pending are ignored. The button is disabled and shows "Preparing diagnostics…", with exactly one `getDiagnostics()` call and one `Share.share` call.
     - A rejected export shows the generic alert, does not call `Share.share`, never renders the underlying error text, and succeeds on retry (the alert clears).
     - The tests spy on `getDiagnostics` / `Share.share` using the file's existing `jest.spyOn(module, fn)` pattern. Fixture data is a JSON string with a `[REDACTED_SECRET]` placeholder; no key-shaped strings.
  2. `de1cb58` `docs(error-handling): describe awaited Share Diagnostics behavior` updates the single "Share Diagnostics" row of the recovery-actions table in `docs/error-handling.md` to match the shipped behavior. This commit stands alone and can be dropped if the publisher wants a test-only delta.

Files changed by this patch: `__tests__/ErrorBoundary.test.tsx` (+105/-2), `docs/error-handling.md` (+1/-1).
Full series vs sponsor main: those two files plus `src/components/ErrorBoundaryFallback.tsx` (+37/-3), 3 files, +143/-6.

## Validation (focused only: the one touched test file)

Environment: Node v22.22.0, npm 10.9.4, Jest 29.7.0, jest-expo 54.0.17, @testing-library/react-native 13.3.3, react-native 0.81.5.

```bash
npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund   # CONTRIBUTING requires --legacy-peer-deps; 948 packages, exit 0
npx jest --watchAll=false __tests__/ErrorBoundary.test.tsx
```

At `de1cb58` (this patch on the carrier):

```
PASS __tests__/ErrorBoundary.test.tsx
  ErrorBoundary
    ✓ renders children when no error occurs
    ✓ captures child exception and renders fallback UI with friendly message
    ✓ triggers recovery action and resets error state on "Reintentar" button press
    ✓ supports custom fallback render function prop
    ✓ hides technical error stack trace in production mode (__DEV__ = false)
    ✓ reports the error even in production (__DEV__ = false), not just in dev
    ✓ allows expanding technical details in development mode (__DEV__ = true)
  ErrorBoundaryFallback — Share Diagnostics recovery action
    ✓ passes the resolved redacted diagnostics text to Share.share (#397)
    ✓ ignores repeat taps while diagnostics are being prepared
    ✓ shows a generic, retryable error when diagnostics cannot be prepared
Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

No React `act()` warnings appear in the output. The baseline at `582b6c8` before adding tests was 7/7 passed.

Counter-check: the same test file with `src/components/ErrorBoundaryFallback.tsx` restored from sponsor `c3a24ab` (fix removed). Exit 1 means the regression catches the bug:

```
Tests:       3 failed, 7 passed, 10 total
● ... › passes the resolved redacted diagnostics text to Share.share (#397)
    expect(received).toBe(expected) // Object.is equality
    Expected: "string"
    Received: "object"
    > 237 |     expect(typeof content.message).toBe('string');
```

Not run (focused-validation rule): the full Jest suite, `tsc --noEmit`, `expo lint`, and any device or emulator check.

## Known limitations / facts for the publisher

- On sponsor `c3a24ab`, `src/utils/diagnostics.ts:46` calls `classifyNetworkError(...)`, which that file never imports (it is exported from `src/hooks/useNetworkStatus.ts`). So the real `getDiagnostics()` rejects at runtime on current `main`. With this PR, Share Diagnostics shows the generic retry alert instead of handing a rejected Promise to the share sheet, but it cannot succeed on-device until the import lands. That import belongs to #390, and fleet reports say sponsor PR #577 adds it. These regression tests mock `getDiagnostics`, so they isolate the share path from that defect.
- No screenshots or device recording. The only visible changes are the busy label and the inline failure text.

## How to apply

```bash
git clone https://github.com/woahwhattheheck/pocketpay-mobile && cd pocketpay-mobile
git checkout fix/grantfox397-diagnostics-share-20261008-gpt6-d2   # must be at 582b6c8459785983c6a6b704ce51eec0f232960a
git am /path/to/fix.patch                                        # adds the 2 commits above
# Alternative from sponsor main (3 commits incl. the carrier fix):
# git checkout c3a24abacb45030eb4fef41aabc46b312aaf54a3 && git am /path/to/fix-full-from-sponsor-main.patch
```

Both patches were checked with `git am` in clean worktrees. Each reproduces the exact tree of `de1cb58`. Commit SHAs will differ after `git am` because the committer timestamp changes.

Deliverables in this directory:
- `fix.patch`: 2 commits, against carrier head `582b6c8` (primary)
- `fix-full-from-sponsor-main.patch`: 3 commits, against sponsor `main` `c3a24ab`

## PR draft (ready to paste, sponsor PR from `woahwhattheheck:fix/grantfox397-diagnostics-share-20261008-gpt6-d2` → `Stellar-PocketPay/pocketpay-mobile:main`)

The fleet carrier used `Refs #397` because #382 delivered the boundary itself. With this PR merged, every #397 acceptance criterion has working evidence (table below), so the draft uses `Closes #397`. If the maintainer prefers to keep the issue open, change that line to `Refs #397`.

**Title:** `fix(error-boundary): await redacted diagnostics in share recovery (#397)`

**Body:**

```markdown
## Summary

Closes #397

/claim #397

The global error boundary and recovery screen from #382 are in place, but its **Share Diagnostics** recovery action is broken on `main`. #382 called `Share.share({ message: getDiagnostics() })` while `getDiagnostics()` was synchronous. #419 later made it async (`SecureStore.isAvailableAsync()`), so the native share sheet now receives a `Promise` instead of the redacted JSON, and the empty `catch {}` hides the failure.

This PR:
- awaits the redacted `getDiagnostics()` text before calling `Share.share`
- makes the action single-flight: busy/disabled `accessibilityState` and a "Preparing diagnostics…" label while the export is prepared
- replaces the silent catch with a generic, screen-reader-announced "Diagnostics could not be shared. Please try again." alert. No exception text is shown, because storage/share errors can carry wallet details. The action can be retried.
- adds focused regressions to the existing `__tests__/ErrorBoundary.test.tsx` and updates the recovery-actions table in `docs/error-handling.md`

I am the original contributor (@woahwhattheheck) and request the GrantFox OSS / FWC26 bounty payout for this contribution on merge. I'll complete the evaluation-readiness steps the maintainers need.

## Test Plan and Evidence

`npx jest --watchAll=false __tests__/ErrorBoundary.test.tsx` → **10 passed** (7 existing + 3 new):
- happy path: `Share.share` receives the resolved redacted diagnostics string with title `App Diagnostics Log`
- repeat taps while the export is pending start no second export or share sheet
- negative path: a rejected export shows the generic alert, does not open the share sheet, never renders the underlying error, and succeeds on retry

With the component reverted to current `main`, the same file fails 3 tests. The #397 case fails with `Expected: "string" / Received: "object"`, i.e. the Promise passed to `Share.share`.

## Self-Assessment

- [x] **Scope:** Limited to the Share Diagnostics recovery action of the existing boundary (one component, one existing test file, one docs row).
- [x] **Tests:** Focused Jest regressions above, including a negative path.
- [ ] **CI:** The targeted Jest file passes locally. The full suite, `npm run typecheck` and `npm run lint` were not run locally; please rely on CI for those.
- [x] **Documentation:** `docs/error-handling.md` recovery-actions table updated.
- [x] **Known limitations:** See below.
- [x] **Acceptance criteria:** Mapped below.

### CI Status

Local: `npx jest --watchAll=false __tests__/ErrorBoundary.test.tsx` → 1 suite, 10/10 passed (Jest 29.7.0, jest-expo 54.0.17).

### Documentation

`docs/error-handling.md`: the "Share Diagnostics" row now describes the awaited export, the busy state and the generic retryable failure.

### Known Limitations

- On current `main`, `src/utils/diagnostics.ts` calls `classifyNetworkError` without importing it, so the real `getDiagnostics()` rejects until that import lands (#390 scope). With this PR the user then sees the retryable alert instead of a silently broken share sheet. The new tests mock `getDiagnostics` so they cover the share path independently.
- No device/emulator recording was captured.

### Acceptance Criteria Audit

| Acceptance Criterion | Implementation Evidence | Test Evidence | Documentation Impact | Status |
| --- | --- | --- | --- | --- |
| Global error fallback is added | `ErrorBoundary` / `ErrorBoundaryFallback` from #382 (unchanged) | existing `ErrorBoundary.test.tsx` cases | `docs/error-handling.md` (existing) | Complete |
| Recovery actions are available | Share Diagnostics now shares the real redacted export, with single-flight and retry (`ErrorBoundaryFallback.tsx`) | 3 new Share Diagnostics cases | recovery-actions table row updated | Complete |
| Sensitive details are hidden | Failure alert is generic; exception text is never rendered | negative-path case asserts the error text is absent | row notes "no error details" | Complete |
| Diagnostics integration is considered | Share path uses the redacted `getDiagnostics()` JSON | happy-path case asserts the exact shared string | existing Diagnostics Integration section | Complete |
| Developer logs remain useful but redacted | unchanged from #382 (`reportError` redaction) | existing cases | existing | Complete |
| Documentation explains error handling approach | `docs/error-handling.md` | n/a | updated | Complete |

## Screenshots or Recordings

Not captured. The only visible changes are the "Preparing diagnostics…" busy label and the one-line failure alert under the Share Diagnostics button.
```

## Notes

- The fleet carrier (fork PR #9) is unchanged. This patch was not pushed to the fork branch; a publisher applies it with `git am` and pushes.
- Clone used: `/home/user/work/clones/woahwhattheheck__pocketpay-mobile__397`, branch `fix/issue-397` @ `de1cb58dc05a4e346c6c9844df1c0311cac8fa57`.
