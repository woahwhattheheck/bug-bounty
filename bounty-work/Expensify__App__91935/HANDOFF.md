# Expensify/App#91935 — Spend report: re-selecting Date sorts descending instead of the default Date/ASC

| | |
|---|---|
| Issue | https://github.com/Expensify/App/issues/91935 |
| Bounty | Upwork, **$250** |
| Upwork job | https://www.upwork.com/jobs/~022059919919895211074 |
| Payout path | Expensify hires the selected contributor through the Upwork job and pays there after merge + deploy (fleet evidence: "$250 via Upwork" on Expensify/App#99074). woahwhattheheck contributor details are already stored by Melvin (#86498 issuecomment-5746723803; also re-posted on #91935). |
| Our proposal in thread | https://github.com/Expensify/App/issues/91935#issuecomment-5563758078 (woahwhattheheck, 2026-09-07: opt-in per-column default sort direction so Date re-activates as ASC). A second woahwhattheheck proposal (grouping order, issuecomment-5753370713) is also in thread. |
| Labels / state (2026-10-08) | OPEN · Bug, External, Help Wanted, Weekly · C+ @rojiphil · no proposal selected |
| Base | `Expensify/App` `main@4bb683286b0b877945f9e95fa512cd199f23a852` |
| Patch | `fix.patch` (2 commits, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`) |
| Apply | `git checkout -b fix/issue-91935 4bb683286b0b && git am fix.patch` |

## What this is

The fleet already built this fix on 2026-09-08 (fork branch `woahwhattheheck/App:paid/expensify-91935-candidate-20260908-sol`, head `588d2f2`, Slack #bug-bounty "SOL-EXPENSIFY-91935"). This handoff re-applies those two commits onto current `main` (clean cherry-pick, author reset to the noreply address, test file reformatted with oxfmt) and re-runs validation, so the PR can be opened straight from `fix.patch` if our proposal is selected.

## Thread status

- Opened 2026-05-28 (applause-bot). C+ @rojiphil restated the target behavior: Date -> Total -> Date should return to the default Date/ASC (plus RBR pre-sort).
- ~15 proposals over four months (earliest from yusufdeveloper2903 / MobileMage on 05-28; trasnake87, emkhalid, masaki12214, KFC-19, bconnnnn and others later; several cover the same Date/ASC fix). No 🎀👀🎀 / assignment yet.
- KI retest: "Issue not reproducible during KI retests. (First week)"; C+: "Awaiting 2nd week retest result."; Melvin later moved the issue to Weekly after 14 days without updates.
- Current main fact: the RBR pre-sort referenced in the issue and in our proposal (`rbrTransactionIDs` / `isDefaultSort` in the report transaction list) no longer exists in `src/` on `main@4bb6832` — the Sept 2026 report-transactions refactor (e.g. `2abaf1e` "drop rbrIDs alias") moved sorting into `useMoneyRequestReportSortedTransactions`, which sorts by the selected column only. The part that still reproduces in code is: the list opens at Date/ASC (`useMoneyRequestReportSortedTransactions` initial state), but `SortableHeaderText` always emits DESC when an inactive column is pressed, so Date -> Total -> Date gives Date/DESC.
- Slack collision check (`91935`): only fleet-internal history (our own lane, last activity 2026-09-20). No outside PR linked.

## Root cause

`SortableHeaderText` computes the next order as `isActive && sortOrder === DESC ? ASC : DESC`, so activating any inactive column yields DESC. The Spend report table opens at Date/ASC, but there is no way for a column to say "my first click is ASC", so Date can never be re-selected in the direction the table opens with. Search intentionally wants DESC-first, so the shared default cannot simply flip.

## Change summary

| File | Change |
|---|---|
| `src/components/Search/SortableHeaderText.tsx` | New optional `defaultSortOrder` prop (default DESC, so Search and other tables are unchanged); an inactive column emits `defaultSortOrder`, an active column keeps toggling. |
| `src/components/Search/SortableTableHeader.tsx` | `ColumnConfig.defaultSortOrder` passed through to `SortableHeaderText`. |
| `src/components/MoneyRequestReportView/MoneyRequestReportTableHeader.tsx` | Date column sets `defaultSortOrder: ASC`. |
| `tests/unit/SortableHeaderTextTest.tsx` (new) | Inactive column -> DESC by default; inactive column with ASC default -> ASC; active DESC -> ASC and active ASC -> DESC regardless of the default. |

## Validation (Node 26.5.0, `npm ci --ignore-scripts` + `bun scripts/applyPatches.ts`)

```
TZ=utc NODE_OPTIONS="--experimental-vm-modules --max_old_space_size=8192" npx jest tests/unit/SortableHeaderTextTest.tsx
-> Tests: 4 passed, 4 total
(with main's SortableHeaderText.tsx: 1 failed, 3 passed — "uses an opt-in ascending default for an inactive column")
node node_modules/typescript/bin/tsc --build tsconfig.app.json   -> exit 0
node node_modules/typescript/bin/tsc --build tsconfig.jest.json  -> exit 0
bun scripts/lint/index.ts <4 touched files>                      -> exit 0
npx oxfmt --check <4 touched files>                              -> formatted
```

Not covered here: a manual run on web/native of Date -> Total -> Date in a report (Tests in the PR draft).

## Ready-to-paste proposal update (edit our existing comment 5563758078 in place)

ProposalPolice does not treat a contributor's own earlier proposal as a duplicate, so editing the existing comment keeps our original timestamp.

```markdown
## Proposal

### Please re-state the problem that we are trying to solve in this issue.
The report expense table opens sorted by Date ascending. After sorting by another column (e.g. Total), tapping Date sorts descending, so the user can't get back to the default order.

### What is the root cause of that problem?
`SortableHeaderText` picks the next order only from whether the column is already active: `isActive && sortOrder === DESC ? ASC : DESC`. Any inactive column therefore starts at DESC. The report table (`useMoneyRequestReportSortedTransactions`) opens at Date/ASC, but nothing lets the Date column say its first tap is ASC, so Date -> Total -> Date always ends on Date/DESC.
(Update for current main: the old RBR pre-sort that depended on Date/ASC was removed in the report-transactions refactor, so the sort direction is what is left to fix.)

### What changes do you think we should make in order to solve the problem?
- Add an optional `defaultSortOrder` to `SortableHeaderText` (default DESC, so Search keeps its DESC-first behavior) and to the `SortableTableHeader` column config.
- An inactive column uses `defaultSortOrder`; an active column keeps toggling ASC/DESC.
- In `MoneyRequestReportTableHeader`, set `defaultSortOrder: ASC` for the Date column.

### What specific scenarios should we cover in automated tests?
- Inactive column with no default -> DESC (Search unchanged).
- Inactive column with an ASC default -> ASC (report Date after another column).
- Active column toggles DESC -> ASC and ASC -> DESC whatever its default is.

### What alternative solutions did you explore? (Optional)
- Flipping the shared default to ASC: changes Search, which sorts DESC first and stores the order in the URL.
- Forcing ASC in the report's `onSortPress` when switching to Date: works, but hides the rule in one handler instead of the column config other tables can reuse.
```

## Ready-to-paste PR

**Title:** `Return the report expense table to Date ascending when Date is selected again`

**Body:**

```markdown
### Explanation of Change
The report expense table opens sorted by Date ascending, but `SortableHeaderText` always starts an inactive column at descending, so Date -> Total -> Date ended on Date/DESC. This adds an optional per-column `defaultSortOrder` (DESC by default, so Search is unchanged), passes it through `SortableTableHeader`, and sets ASC for the report table's Date column. Active columns still toggle as before.

Upwork job for this issue: https://www.upwork.com/jobs/~022059919919895211074 — please process the bounty payment through this job once the PR is merged.

### Fixed Issues
$ https://github.com/Expensify/App/issues/91935
PROPOSAL: https://github.com/Expensify/App/issues/91935#issuecomment-5563758078

### Tests
1. Open a report with at least two expenses with different dates and amounts.
2. Verify the expense table is sorted by Date ascending (arrow up on Date).
3. Tap the Total column header and verify the list is sorted by Total descending.
4. Tap the Date column header and verify the list is sorted by Date ascending again (arrow up).
5. Tap Date again and verify it toggles to descending.
6. Go to Reports/Search, tap an inactive column header and verify it still starts descending.
- [ ] Verify that no errors appear in the JS console

### Offline tests
Same as tests; sorting is local and works offline.

### QA Steps
Same as tests.
- [ ] Verify that no errors appear in the JS console

### PR Author Checklist
<paste the checklist from .github/PULL_REQUEST_TEMPLATE.md and tick the items after running the tests on all platforms>

### Screenshots/Videos
<Android: Native / Android: mWeb Chrome / iOS: Native / iOS: mWeb Safari / MacOS: Chrome / Safari recordings of the steps above>
```

Notes for the submitter:
- Expensify's PR template asks not to use GitHub closing keywords; the issue is linked with the `$ <issue URL>` line.
- Expensify flow: C+ (@rojiphil) reviews proposals (🎀👀🎀) -> internal engineer assigns -> PR from a fork with the PROPOSAL link.
- Competition: several earlier proposals describe the same Date/ASC root cause (trasnake87 posted a current-main jest test, masaki12214 a header-row wrapper variant); the C+ picks the first proposal with a correct root cause, and the issue is also pending the KI retest result.
