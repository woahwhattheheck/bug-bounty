# HANDOFF · woahwhattheheck/pocketpay-sdk#2 → Stellar-PocketPay/pocketpay-sdk#307

Status: **HANDOFF**. This was a help request to verify the fleet carrier at its current head. The carrier passes. No new source change was needed.

| Field | Value |
|---|---|
| Upstream issue | https://github.com/Stellar-PocketPay/pocketpay-sdk/issues/307 ("Implement SDK safe amount model"). OPEN, unassigned, 0 comments, no linked PR (checked 2026-10-08 ~05:55 UTC) |
| Carrier (fork PR) | https://github.com/woahwhattheheck/pocketpay-sdk/pull/2. OPEN, no reviews |
| Carrier branch / head | `fix/ppsdk307-amount-overflow-20261008` @ `62ec4dd3b9df855d06bbbe39e70d72c74064c3e2` (commits `3c309b0`, `62ec4dd`) |
| Base | sponsor `Stellar-PocketPay/pocketpay-sdk:main` @ `ddd18b381d2dc7286eabf10046f2f9c768b3a6fb`. Fork `main` is the same SHA. Sponsor main has not moved. |
| Platform | GrantFox. Labels: `GrantFox OSS`, `Official Campaign \| FWC26`, `Maybe Rewarded`, `expert`, `security`, `payments`, `sdk`, `feature` |
| Amount | Not verified. The issue carries only the "Maybe Rewarded" label. |
| Payout evidence | Nothing specific to this repo was found in this pass. GrantFox is on the owner's green list. |
| Upstream PRs for #307 | None. `is:pr 307` on the sponsor repo returns 0 results. None of the 25 visible same-account PRs (#462 to #486) mention #307. |

## Fleet context (facts)

- 2026-10-07 23:37 EDT: GF-PPSDK307-SAFE-AMOUNT-OVERFLOW-R1 found the gap. The provider stopped its commit before any change was made, and the lane was released.
- 23:48 EDT: GF-PPSDK307-R2-CB6 took the lane. At 23:50:50 it posted DELIVERED/RELEASE: carrier head 62ec4dd, fork PR #2, upstream PR creation returned an integration 403, and no broad tests were run.
- 2026-10-08 01:54 EDT: **GF-PPSDK307-UPSTREAM-20261008-GPT6-VARX** took the single upstream PR publication at head 62ec4dd (https://tokenjunkielabs.slack.com/archives/C0BVANHNB26/p1791438850775339). This pass does not touch that lane. It supplies the test evidence for that PR.

## What the carrier changes (4 files, +40/-2 vs ddd18b3)

- `src/utils/index.ts` (+16/-0, purely additive). Before this change, `validateAmount` called `safeParseAmount(amount)` but used the result only for the zero check. A syntactically valid amount above `MAX_STROOPS` (2^63-1 stroops, 922337203685.4775807) therefore returned `true`. Every payment, vault, soroban and transaction preflight that calls the legacy validator is affected: `payments/validation.ts`, `payments/intent.ts`, `payments/preview.ts`, `payments/trustline.ts`, `payments/qrParser.ts`, `vault/intents.ts`, `soroban/index.ts`, `soroban/client-factory.ts`, `transactions/build-validation.ts`, `transactions/offline-preparation.ts`. The carrier adds a final `if (!parsed.valid)` branch that throws `INVALID_AMOUNT` and carries the parser's `validation.reason` (`exceeds_maximum`). This branch runs after the existing format, zero and precision checks, and by then the only way `parseAmount` can still fail is `exceeds_maximum`, so the "Exceeds the maximum Stellar amount" message is accurate.
- `tests/safe-amount.test.ts` (+8): `validateAmount(formatStroops(MAX_STROOPS))` is `true`, and `MAX_STROOPS + 1n` throws `INVALID_AMOUNT` / `exceeds_maximum`.
- `tests/utils.test.ts` (+12, commit 62ec4dd): `922337203685.4775807` is accepted, `922337203685.4775808` throws `INVALID_AMOUNT` with `reason: exceeds_maximum`, and `922337203686` throws `INVALID_AMOUNT`.
- `docs/amount-model.md` (+4/-2): documents the legacy codes and the int64 rejection.

## Validation (focused only)

Clone: `/home/user/work/clones/woahwhattheheck__pocketpay-sdk__2`, detached at `62ec4dd3b9df855d06bbbe39e70d72c74064c3e2`. Dependencies came from the lockfile via `npm ci --ignore-scripts --no-audit --no-fund` (186 packages, Node 22.22.0, npm 10.9.4).

### 1. Test files touched by the carrier, at head 62ec4dd: PASS

```
$ npx vitest run tests/utils.test.ts tests/safe-amount.test.ts --reporter=verbose
 RUN  v3.2.7
 ✓ tests/safe-amount.test.ts > legacy helpers no longer lose precision silently > keeps validateAmount behaviour unchanged
 ✓ tests/safe-amount.test.ts > legacy helpers no longer lose precision silently > rejects amounts above Stellar int64 stroops through legacy validateAmount
 ✓ tests/safe-amount.test.ts > parseAmount — large values > rejects anything above the protocol maximum
 ✓ tests/utils.test.ts > Utils Module > validateAmount > should reject zero
 ✓ tests/utils.test.ts > Utils Module > validateAmount > should reject non-numeric strings
 ✓ tests/utils.test.ts > Utils Module > validateAmount > should reject amounts with too many decimals
 ✓ tests/utils.test.ts > Utils Module > validateAmount > should throw INVALID_AMOUNT_PRECISION for over-precision
 ✓ tests/utils.test.ts > Utils Module > validateAmount > rejects values above the signed int64 stroop limit
 ... (all other cases in both files ✓)
 Test Files  2 passed (2)
      Tests  116 passed (116)
   Duration  1.23s
```

### 2. Negative control: sponsor-main `src/utils/index.ts` with the carrier's tests: the 2 new cases FAIL

```
$ git checkout ddd18b3 -- src/utils/index.ts && npx vitest run tests/utils.test.ts tests/safe-amount.test.ts
 × legacy helpers no longer lose precision silently > rejects amounts above Stellar int64 stroops through legacy validateAmount
   → expected the call to throw
 × Utils Module > validateAmount > rejects values above the signed int64 stroop limit
   → expected function to throw an error, but it didn't
 Test Files  2 failed (2)
      Tests  2 failed | 114 passed (116)
$ git checkout 62ec4dd -- src/utils/index.ts      # restored; working tree clean
```

The regressions catch the bug. The other 114 cases, including every pre-existing `validateAmount` case, pass with and without the fix.

### 3. Legacy codes are unchanged: direct probe of `validateAmount` at base ddd18b3 vs head 62ec4dd

Each line shows input → code and reason at head. The script is at `scratchpad/probe307.ts` and runs with `npx tsx` against the clone's `src/utils/index.ts`.

```
"1"                        ok true
"0.0000001"                ok true
"0"                        INVALID_AMOUNT not_positive
"0.0000000"                INVALID_AMOUNT not_positive
"10abc"                    INVALID_AMOUNT invalid_format
""                         INVALID_AMOUNT invalid_format
"  10  "                   INVALID_AMOUNT invalid_format
"1e3"                      INVALID_AMOUNT invalid_format
"-1"                       INVALID_AMOUNT invalid_format
"1.12345678"               INVALID_AMOUNT_PRECISION too_precise
"0.00000000"               INVALID_AMOUNT_PRECISION too_precise
"922337203685.4775807"     ok true
"922337203685.4775808"     INVALID_AMOUNT exceeds_maximum
"922337203686"             INVALID_AMOUNT exceeds_maximum
"922337203686.12345678"    INVALID_AMOUNT_PRECISION too_precise
"99999999999999999999"     INVALID_AMOUNT exceeds_maximum

$ diff probe-base.txt probe-head.txt
< "922337203685.4775808"     ok true          > INVALID_AMOUNT exceeds_maximum
< "922337203686"             ok true          > INVALID_AMOUNT exceeds_maximum
< "99999999999999999999"     ok true          > INVALID_AMOUNT exceeds_maximum
```

Only the three above-`MAX_STROOPS` inputs change. Each moves from `true` to `INVALID_AMOUNT`. All `INVALID_AMOUNT` (format and zero) and `INVALID_AMOUNT_PRECISION` results are byte-identical between base and head. The `MAX_STROOPS` boundary itself is still accepted. Precision is checked before range, so an over-long fraction on an oversized value still reports `INVALID_AMOUNT_PRECISION`, as it did before.

### 4. Type-check

```
$ npx tsc --noEmit -p tsconfig.json
8 errors, all in src/payments/qrParser.ts (ValidationErrorField / ValidationErrorCode literals)
```

The same 8 errors in the same file appear at sponsor main ddd18b3 with the carrier's 4 files reverted. They come from #455 (the QR parser), which predates the carrier. The carrier adds no type errors. Same-account upstream PR #470 ("fix: restore QR parser contract and CI", open) is titled for that area. Its contents were not checked in this pass.

No full suite, coverage, presubmit or build was run.

## Deliverable

- `fix.patch`: `git format-patch ddd18b3..62ec4dd` of the carrier's 2 commits, exported unchanged. Applying it with `git am` on a scratch worktree at ddd18b3 gives tree `0deec3da748929ed62e72ef02dc7fb80979651c7`, the same tree as carrier head 62ec4dd. The carrier commits keep their existing author line, `woahwhattheheck <brycembusiness2@gmail.com>`. This pass created no new commits.
- How to apply (fresh branch from sponsor main):
  ```
  git checkout -b fix/issue-307 ddd18b381d2dc7286eabf10046f2f9c768b3a6fb
  git am fix.patch
  ```
  The PR can also be opened straight from the carrier branch `woahwhattheheck:fix/ppsdk307-amount-overflow-20261008` @ 62ec4dd. That is the path the VARX publication TAKE names.

## Reviewer-facing context (facts)

- #307's text ("Implement SDK safe amount model") overlaps #270, which merged as PR #344 (`6887c90`, 2026-07-27). #344 shipped `src/utils/amount.ts` (`SafeAmount`, `parseAmount`, `formatStroops`, bigint arithmetic), `docs/amount-model.md` and `tests/safe-amount.test.ts`. This PR does not rebuild those. It closes the one remaining gap against #307's acceptance criteria. Criterion 4 asks that "payment and vault helpers use the shared amount model", and criterion 6 asks for coverage of "large values". The legacy `validateAmount` that those helpers call discarded the shared parser's range rejection. The PR body below states this so a reviewer can see what #307 adds over #270.
- The repo's PR template asks for `npm run presubmit` output. That run was not part of this focused pass. CI on the upstream PR will show it.

## Ready-to-paste upstream PR (for the publisher)

Head: `woahwhattheheck:fix/ppsdk307-amount-overflow-20261008` @ 62ec4dd (or a fresh branch from `fix.patch`). Base: `Stellar-PocketPay/pocketpay-sdk:main`.

**Title:** `fix(payments): reject amounts above int64 stroops in shared validateAmount (#307)`

**Body:**

```markdown
## Related Issue

- Closes #307

/claim #307

## Implementation Scope

- **Problem addressed:** The safe amount model from #270 (#344) parses exactly and rejects values above the Stellar maximum (`MAX_STROOPS`, 2^63-1 stroops). But the legacy `validateAmount` that the payment, vault, Soroban and transaction preflights call ignored the parser's `{ valid: false }` result, except for the zero check. A syntactically valid amount such as `922337203685.4775808` or `99999999999999999999` therefore passed shared validation and reached transaction building. This PR makes `validateAmount` fail closed on the parser's range rejection, so every helper that relies on it now honours the shared amount model's limits.
- **Modules changed:** `src/utils/index.ts` (additive branch in `validateAmount`), `docs/amount-model.md`
- **Public API impact:** None. The signature is unchanged. Existing error codes are unchanged: `INVALID_AMOUNT` for format, zero and (new) above-maximum, and `INVALID_AMOUNT_PRECISION` for more than 7 decimals. The over-maximum error carries `validation.reason: 'exceeds_maximum'` from the shared parser.

Callers covered through `validateAmount`: `payments/validation.ts`, `payments/intent.ts`, `payments/preview.ts`, `payments/trustline.ts`, `payments/qrParser.ts`, `vault/intents.ts`, `soroban/index.ts`, `soroban/client-factory.ts`, `transactions/build-validation.ts`, `transactions/offline-preparation.ts`.

## Tests Added / Changed

- [x] New tests added: `tests/utils.test.ts` (int64 boundary: `922337203685.4775807` accepted, `922337203685.4775808` and `922337203686` rejected with `INVALID_AMOUNT` / `exceeds_maximum`), `tests/safe-amount.test.ts` (`formatStroops(MAX_STROOPS)` accepted, `MAX_STROOPS + 1n` rejected through legacy `validateAmount`)
- [x] Failure paths covered: above-maximum rejection, exact boundary acceptance, and unchanged legacy codes for zero, format and precision

## Commands Run (local verification)

    npx vitest run tests/utils.test.ts tests/safe-amount.test.ts
    Test Files  2 passed (2)
         Tests  116 passed (116)

Against the previous `src/utils/index.ts`, the two new cases fail (`2 failed | 114 passed`) and every pre-existing case passes. A direct comparison of `validateAmount` before and after over zero, format, precision and boundary inputs shows that only above-maximum inputs change (from `true` to `INVALID_AMOUNT`). All `INVALID_AMOUNT` and `INVALID_AMOUNT_PRECISION` results for other inputs are identical.

`npx tsc --noEmit` reports no errors in the changed files. The only errors are 8 existing ones in `src/payments/qrParser.ts`, which are present on `main` at ddd18b3 too.

## Acceptance Criteria Coverage

| Criterion | Status | Evidence / Location |
| :--- | :---: | :--- |
| A safe amount type and parser are implemented | ✅ | `src/utils/amount.ts` (`SafeAmount`, `parseAmount`, `safeParseAmount`), from #344 |
| Invalid decimal input is rejected | ✅ | `parseAmount` + `validateAmount`; `tests/safe-amount.test.ts`, `tests/utils.test.ts` |
| Floating-point unsafe behaviour is avoided | ✅ | bigint stroops; `xlmToStroops` throws beyond the safe range; tests in `tests/safe-amount.test.ts` |
| Payment and vault helpers use the shared amount model | ✅ (this PR closes the gap) | `validateAmount` now enforces the shared parser's range result for every payment/vault/Soroban/transaction caller |
| Formatting rules are consistent | ✅ | `formatStroops` / canonical 7-decimal output, `tests/safe-amount.test.ts` |
| Tests cover zero, small decimals, large values, invalid precision, trailing zeros | ✅ | `tests/safe-amount.test.ts`; int64 boundary added in both test files |
| Documentation explains the amount rules | ✅ | `docs/amount-model.md` (legacy helper section updated) |

## Reviewer Notes

- The change is additive (+16/-0 in `src/utils/index.ts`). The new branch runs after the existing format, zero and precision checks. At that point the only remaining parser rejection is `exceeds_maximum`.
- Precision is still checked before range, so an over-long fraction on an oversized value reports `INVALID_AMOUNT_PRECISION`, as before.

## Bounty

This PR resolves #307 under the GrantFox OSS / Official Campaign FWC26 program. When it is merged, please assign the #307 GrantFox reward to @woahwhattheheck.
```
