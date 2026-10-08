# Appium #19883 literal module-object follow-up

Status: SOURCE COMPLETE / NOT PUBLISHED UPSTREAM

This packet consumes the stale `APPIUM19883-LITERAL-MODULE-OBJECT-20261008-SOL56` lane and layers only the issue's literal imported-driver form on top of the retained rev2 source.

## Fences

- Sponsor issue: appium/appium#19883 (OPEN / unassigned at recovery time).
- Sponsor base branch: `appium4`.
- Sponsor base used by retained rev2: `8297d31fb18b4d0b9e2b377332cfc680281ec6ed`.
- Retained rev2 patch: `bounty-work/appium__appium__19883/fix.patch`.
- Retained rev2 patch blob: `92d605f62d0c7fc292a3c7d151feba0346ce94a8`.
- Retained producer evidence: 6/6 new + 64/64 relevant regression cases on Node 22/26 (70/70 total). Reuse this evidence; do not rerun a broad suite.
- No `woahwhattheheck/appium` fork existed in the connector during this recovery, so no upstream/fork source ref was invented.

## Follow-up

Apply `literal-module-object.followup.patch` AFTER retained `fix.patch`.

The follow-up:
1. Widens only the programmatic Appium args type so `main({useDrivers: [XCUITestDriver]})` and one-driver ESM namespace wrappers are accepted.
2. Keeps CLI/config schema behavior string-only. The preflight validator filters direct module values only when the caller supplied programmatic args; all ordinary strings and every other server option still pass normal validation.
3. Registers direct driver classes in memory rather than in `extensions.yaml`.
4. Gives directly supplied drivers precedence for matching `automationName`. The default automation identity is the class name minus `Driver` (for example `XCUITestDriver -> XCUITest`); a class may expose static `automationName` to override it.
5. Resolves a direct class or an ESM module namespace only when exactly one distinct export is driver-like. Ambiguous namespaces fail instead of guessing.
6. Adds one focused regression that passes a namespace object containing the same default/named driver class, proves it is returned directly, proves capability matching resolves it, and proves the manifest remains unchanged.
7. Updates the embedding guide to show the exact issue form first while retaining absolute-path/`file:` strings as an alternative.

## Validation state

The regression is AUTHORED, NOT RUN in this recovery seat. No broad test/build was run. The follow-up was source-reviewed against the exact sponsor base and retained rev2 diff. A publisher should apply the two patches to a fresh `appium4` checkout, run only the existing resolved-driver unit file plus the project-required focused typecheck if needed, then publish once under the original claimant.

## Upstream submission notes

- Do not claim that the old rev2 path-only alternative alone satisfies the literal issue example.
- Preserve the issue's exact direct-import form in the PR summary.
- Appium CLA remains a contributor-side gate.
- Compensation is discretionary Open Collective sizing after acceptance/merge; no fixed award or payment is asserted here.
