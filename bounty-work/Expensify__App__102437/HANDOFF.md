# Expensify/App#102437 — HybridApp required 2FA: verify step restarts, "Got it" leaves Classic user in NewDot

| | |
|---|---|
| Issue | https://github.com/Expensify/App/issues/102437 |
| Bounty | Upwork, **$250** (title `[$250]`, raised from $175 on 2026-10-07) |
| Upwork job | https://www.upwork.com/jobs/~022104617040252326734 (Job ID 2104617040252326734) |
| Payout path | Expensify hires the selected contributor through the Upwork job and pays there after the PR is merged and deployed. Fleet evidence of Expensify paying: "$250 via Upwork" recorded on Expensify/App#99074 (Slack #coordination, 2026-10-04). The woahwhattheheck contributor details (Expensify email + Upwork profile) are already stored by Melvin (#86498 issuecomment-5746723803), so they do not need to be posted again. |
| Labels / state (2026-10-08) | OPEN · Bug, DailyKSv2, External, Help Wanted · C+ reviewer: @thesahindia |
| Base | `Expensify/App` `main@4bb683286b0b877945f9e95fa512cd199f23a852` |
| Patch | `fix.patch` (1 commit, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`) |
| Apply | `git checkout -b fix/issue-102437 4bb683286b0b && git am fix.patch` |

## Thread status (read 2026-10-08, all 21 timeline items)

- 2026-09-28 MelvinBot proposal (issuecomment-5874711524): keep `NVP_TRY_NEW_DOT` through the post-2FA reset + latch the agent check.
- 2026-10-05 C+ thesahindia: `@MelvinBot implement this` -> draft PR **#103081** (preserve `NVP_TRY_NEW_DOT` in both reset branches + `withAgentAccessDenied` keeps the last identity).
- 2026-10-07 thesahindia **closed #103081: "Fix didn't work"**, asked Melvin where a Classic user should land after signing out/in (answer: OldDot), and `Help Wanted` was re-added; price -> $250.
- Proposals in thread (none reviewed/accepted yet):
  - ashusatyarthi-wq 5876533267 (09-28): keep `NVP_TRY_NEW_DOT` + `PERSONAL_DETAILS_LIST`.
  - franklincg 5876990264 (09-28): keep `NVP_TRY_NEW_DOT`.
  - oqildev 6047355558 (10-07): keep `NVP_TRY_NEW_DOT`, seed `HAS_LOADED_APP` + current-user personal details.
  - wildan-m 6047355767 (10-07): keep `NVP_TRY_NEW_DOT`, seed post-validate account flags (has a compare branch).
  - mukhrr 6047357310 (10-07): keep `NVP_TRY_NEW_DOT`, `HAS_LOADED_APP`, `PERSONAL_DETAILS_LIST`.
  - **samranahm 6047432407 (10-07): remember the "go back to OldDot" sign-in decision (module state) and use it on the success page.**
  - nabi-ebrahimi 6047563918 (10-07): seeds + make `DynamicSuccessPage` use `shouldUseOldApp`.
  - **yusufdeveloper2903 6047782454 (10-07): `hybridApp.shouldReturnToOldDotAfter2FA` flag set at sign in, read/reset on "Got it" — the same mechanism as this patch.**
  - OmkarD09 6050839748 (10-08): keep `NVP_TRY_NEW_DOT`.
- Slack collision check (`102437`): no fleet TAKE/PR before ours. Our TAKE: https://tokenjunkielabs.slack.com/archives/C0BVANHNB26/p1791429278137479

**Competition, stated plainly:** the core idea of this patch (persist the sign-in decision on `HYBRID_APP`) was already posted by yusufdeveloper2903, and samranahm posted the same root cause earlier. Expensify's ProposalPolice withdraws a new proposal that scores >=90% similar to an earlier one, and C+ reviewers pick the first proposal with a correct root cause. What this patch adds over the in-thread proposals: it is implemented, typechecks, lints clean, and comes with 9 new jest tests that fail on `main` and pass with the fix, including a test that reproduces the "verify step restarts" mechanism (the 2FA screen being unmounted by `withAgentAccessDenied` during the reset). If our account is not the one selected, the patch still documents a working, tested fix.

## Root cause

1. **"Got it" leaves the user in NewDot.** `signInToOldDotAndChooseExperience` (`src/libs/HybridApp.ts`) decides at sign in that a Classic user would open OldDot (`shouldUseOldApp(tryNewDot)`) but keeps them in NewDot while `needsTwoFactorAuthSetup && !requiresTwoFactorAuth`. That decision is not stored anywhere. `DynamicSuccessPage` later re-derives it from `nvp_tryNewDot.classicRedirect.dismissed`, which:
   - is wiped by the Onyx reset in `validateTwoFactorAuth` (both branches; in the forced-onboarding branch `openApp()` is deferred until after "Got it", so it never comes back in time; in the login-required branch it only comes back when the next OpenApp finishes), and
   - is a narrower check than the sign-in decision: `shouldUseOldApp` also sends users with an empty `nvp_tryNewDot` or no `classicRedirect` to OldDot, while the success page only accepts `dismissed: true`.
   Keeping `NVP_TRY_NEW_DOT` through the reset (#103081) only covers the first point.
2. **The verify step restarts.** After a valid code the client does not mark 2FA as enabled; `DynamicVerifyPage` only moves to the success step when `account.requiresTwoFactorAuth` becomes true (from the server/OpenApp). Meanwhile the login-required reset seeds `IS_LOADING_APP: true` and drops `HAS_LOADED_APP` and the personal details, so `useIsAgentAccount()` returns `undefined` and `withAgentAccessDenied` renders `null` for every TWO_FACTOR_AUTH screen. When OpenApp finishes, the verify page mounts again with an empty code field.

## Change summary (fix.patch)

| File | Change |
|---|---|
| `src/types/onyx/HybridApp.ts` | New `shouldReturnToOldDotAfter2FASetup?: boolean`. |
| `src/libs/actions/HybridApp/index.ts` | `setShouldReturnToOldDotAfter2FASetup()`; `resetSignInFlow()` (sign out) resets it to `false`. |
| `src/selectors/HybridApp.ts` | `shouldReturnToOldDotAfter2FASetupSelector`. |
| `src/libs/HybridApp.ts` | When the user would open OldDot but is kept in NewDot only for the required 2FA setup, store `shouldReturnToOldDotAfter2FASetup: true` (written on every "stay in NewDot" decision, so it is `false` otherwise). `HYBRID_APP` is in `KEYS_TO_PRESERVE`, so it survives the reset. |
| `src/pages/settings/Security/TwoFactorAuth/DynamicSuccessPage.tsx` | "Got it" returns to OldDot when the flag is set (or the existing `classicRedirect.dismissed` check passes): clears the 2FA setup data (`clearTwoFactorAuthData(true)`, because the RHP `beforeRemove` cleanup does not run when NewDot closes), resets the flag, calls `closeReactNativeApp`. Back button resets the flag. |
| `src/libs/actions/Session/index.ts` | `TwoFactorAuth_Validate` success data also sets `requiresTwoFactorAuth: true, needsTwoFactorAuthSetup: false`, so the verify step advances immediately. The login-required reset keeps `HAS_LOADED_APP` and `PERSONAL_DETAILS_LIST` (same as the delegate reset's `KEYS_TO_PRESERVE_DELEGATE_ACCESS`), so the 2FA RHP stays mounted while OpenApp runs. |
| `tests/unit/HybridAppTest.ts` (new) | Sign-in decision: Classic + pending 2FA -> flag true; empty `nvp_tryNewDot` + pending 2FA -> flag true; NewDot user -> flag false; Classic without pending 2FA -> OldDot opens right away. |
| `tests/ui/DynamicSuccessPageTest.tsx` (new) | "Got it" with the flag and no `nvp_tryNewDot` -> clears 2FA data, resets flag, closes NewDot; NewDot user -> Enabled page; existing `dismissed: true` path still closes NewDot. |
| `tests/actions/SessionTest.ts` | Success data marks 2FA enabled; login-required reset keeps `HAS_LOADED_APP` + personal details and still runs OpenApp; `beforeEach(jest.restoreAllMocks)` for the describe. |
| `tests/unit/withAgentAccessDenied.test.tsx` | Integration: render a guarded screen, run `validateTwoFactorAuth('123456', true)` with OpenApp in flight -> screen stays rendered. |

8 files changed in src+tests (+2 new test files), 162 insertions, 10 deletions.

## Validation (Node 26.5.0 / npm 11.17.0 per `package.json` engines; `npm ci --ignore-scripts` + `bun scripts/applyPatches.ts`)

```
TZ=utc NODE_OPTIONS="--experimental-vm-modules --max_old_space_size=8192" npx jest \
  tests/unit/HybridAppTest.ts tests/ui/DynamicSuccessPageTest.tsx tests/unit/withAgentAccessDenied.test.tsx \
  tests/actions/SessionTest.ts tests/ui/BaseTwoFactorAuthFormTest.tsx tests/unit/HybridAppActionsTest.ts \
  tests/unit/TryNewDotUtilsTest.ts tests/unit/AccountUtilsTest.ts tests/unit/TwoFactorAuthUtilsTest.ts
-> Test Suites: 9 passed, 9 total / Tests: 147 passed, 147 total
```

Same new tests with the three source fixes reverted (`git stash` of `Session/index.ts`, `HybridApp.ts`, `DynamicSuccessPage.tsx`) -> the 7 behavior tests fail, the regression tests pass:
- HybridAppTest: 3 failed / 1 passed (the "opens OldDot right away" regression passes on main too)
- DynamicSuccessPageTest: 1 failed / 2 passed
- SessionTest `validateTwoFactorAuth`: 2 failed / 1 passed (existing forced-onboarding test passes)
- withAgentAccessDenied "keeps the 2FA screen mounted ...": failed with `Unable to find an element with testID: protected-content` (the unmount that shows up as the restarted verify step)

```
node node_modules/typescript/bin/tsc --build tsconfig.app.json   -> exit 0
node node_modules/typescript/bin/tsc --build tsconfig.jest.json  -> exit 0
bun scripts/lint/index.ts <10 touched files>                     -> exit 0 (ESLint + seatbelt)
npx oxfmt --check <10 touched files>                             -> all formatted
```

Not covered here: a run on a real HybridApp build (Android/iOS) with a Classic account that becomes a Xero workspace admin. The C+ tested #103081 that way, so a device run of these QA steps is the remaining verification step before the PR.

## Ready-to-paste proposal (Expensify template)

```markdown
## Proposal

### Please re-state the problem that we are trying to solve in this issue.
On HybridApp, a Classic user who must set up 2FA (e.g. Xero workspace admin) is kept in NewDot for the setup. After a valid code the verify step comes back empty, and "Got it" on the success screen leaves them in NewDot instead of returning to OldDot.

### What is the root cause of that problem?
1. The decision "this user goes to OldDot, but only after the required 2FA setup" is made once in `signInToOldDotAndChooseExperience` (`HybridApp.ts`) and never stored. `DynamicSuccessPage` tries to re-derive it from `nvp_tryNewDot.classicRedirect.dismissed`, but:
   - `validateTwoFactorAuth` clears Onyx after a valid code, which drops `nvp_tryNewDot` (in the forced-onboarding branch `openApp()` is deferred until after "Got it", so it is never back; in the login-required branch it is only back after the next OpenApp);
   - it is also not the same check as sign in: `shouldUseOldApp()` sends a user with an empty `nvp_tryNewDot` / no `classicRedirect` to OldDot, while the success page needs `dismissed: true`.
   So keeping `nvp_tryNewDot` through the reset (#103081) is not enough.
2. The verify step "restarts" because the login-required reset sets `isLoadingApp` and drops `hasLoadedApp` and the personal details. `useIsAgentAccount()` then returns `undefined`, `withAgentAccessDenied` renders nothing for every 2FA screen, and the verify page mounts again (empty) once OpenApp is back. It also can't move on by itself, because nothing marks 2FA as enabled on the client until OpenApp returns.

### What changes do you think we should make in order to solve the problem?
1. When `signInToOldDotAndChooseExperience` keeps a would-be-OldDot user in NewDot only for the required 2FA setup, store `shouldReturnToOldDotAfter2FASetup` on `HYBRID_APP` (already kept by every reset). Reset it on sign out.
2. In `DynamicSuccessPage`, "Got it" returns to OldDot when that flag is set (keeping the existing `classicRedirect` check): clear the 2FA setup data, clear the flag, call `closeReactNativeApp`.
3. Mark 2FA as enabled in the `TwoFactorAuth_Validate` success data (`requiresTwoFactorAuth: true`, `needsTwoFactorAuthSetup: false`) so the verify step moves to success right away.
4. In the login-required reset, keep `HAS_LOADED_APP` and the personal details (like the delegate reset already does) so the 2FA screens stay mounted while OpenApp runs.

### What specific scenarios should we cover in automated tests?
- Sign in on HybridApp as a Classic user with required 2FA pending -> stays in NewDot and the flag is stored; same for an empty `nvp_tryNewDot`; a NewDot user -> flag not set; Classic user without pending 2FA -> OldDot opens right away.
- Success page "Got it" with the flag set and `nvp_tryNewDot` missing -> closes NewDot; NewDot user -> 2FA Enabled page.
- After a valid code in the login-required path, a guarded 2FA screen stays mounted while OpenApp is in flight.
- The validate success data marks 2FA as enabled.

### What alternative solutions did you explore? (Optional)
- Only keeping `nvp_tryNewDot` through the reset: still disagrees with the sign-in decision when `classicRedirect` is missing, and #103081 with this change did not fix the issue.
- Caching the last agent check inside `withAgentAccessDenied`: hides the symptom in shared UI code; the reset dropping the identity is the cause.
- Sending the user to OldDot before 2FA (reverting #81984): brings back OldDot skipping the required 2FA screen.
```

## Ready-to-paste PR

**Title:** `Return HybridApp Classic users to OldDot after the required 2FA setup`

**Body:**

```markdown
### Explanation of Change
A HybridApp user who would open OldDot after signing in is kept in NewDot until the required 2FA setup is done, but that decision was not stored. The 2FA success screen tried to re-derive it from `nvp_tryNewDot`, which the Onyx reset after the 2FA validation drops, so "Got it" kept the user in NewDot. The same reset dropped `HAS_LOADED_APP` and the personal details while marking the app as loading, so `withAgentAccessDenied` unmounted the 2FA screens and the verify step came back empty.

- `HybridApp.ts` now stores `shouldReturnToOldDotAfter2FASetup` on `HYBRID_APP` when it keeps a would-be-OldDot user in NewDot for the required 2FA setup (reset on sign out).
- `DynamicSuccessPage` uses it on "Got it": clears the 2FA setup data and the flag, then closes NewDot.
- `TwoFactorAuth_Validate` success data marks 2FA as enabled so the verify step advances right away.
- The login-required 2FA reset keeps `HAS_LOADED_APP` and the personal details (like the delegate reset) so the 2FA screens stay mounted while OpenApp runs.

Upwork job for this issue: https://www.upwork.com/jobs/~022104617040252326734 — please process the bounty payment through this job once the PR is merged.

### Fixed Issues
$ https://github.com/Expensify/App/issues/102437
PROPOSAL: <link to the posted proposal comment>

### Tests
Prerequisites: HybridApp build (Android or iOS); User A owns a workspace connected to Xero.
1. Create User B in HybridApp, switch to Expensify Classic ("Switch to Expensify Classic" / "Go to Expensify Classic"), then sign out.
2. As User A, add User B to the Xero workspace as an Admin.
3. Sign in as User B with the magic code.
4. Verify the "Two-factor authentication required" screen ("Your Xero accounting connection requires two-factor authentication.") appears in New Expensify; tap "Enable".
5. Copy the recovery codes, tap Next, scan the key in an authenticator app and enter the code.
6. Verify the flow goes straight to the success screen (the verify step does not come back with an empty code field).
7. Tap "Got it" and verify Expensify Classic opens and stays open.
8. Repeat with a user who uses New Expensify (did not switch to Classic) and verify "Got it" opens the 2FA Enabled page in New Expensify.
9. Settings > Security > Two-factor authentication for a user without required 2FA: enable it and verify the flow is unchanged.
- [ ] Verify that no errors appear in the JS console

### Offline tests
2FA validation needs a connection; with the device offline the verify step shows the existing offline blocking view and nothing changes.

### QA Steps
Same as tests.
- [ ] Verify that no errors appear in the JS console

### PR Author Checklist
<paste the checklist from .github/PULL_REQUEST_TEMPLATE.md and tick the items after running the tests on all platforms>

### Screenshots/Videos
<Android: Native / Android: mWeb Chrome / iOS: Native / iOS: mWeb Safari / MacOS: Chrome / Safari recordings of the steps above>
```

Notes for the submitter:
- Expensify's PR template asks not to use GitHub closing keywords (`Fixes`/`Closes`); the issue is linked with the `$ <issue URL>` line instead.
- Expensify flow: post the proposal on the issue -> C+ (@thesahindia) reviews (🎀👀🎀) -> internal engineer assigns -> open the PR from a fork with the PROPOSAL link filled in.
- `contributingGuides/AI_ETIQUETTE.md` asks PR authors to include manual-test evidence; the Tests above are written for a HybridApp device run and the Screenshots/Videos section needs those recordings.
