# ant-design/ant-design #11600 — submission packet

Status: original source recovered and ready for upstream publication. GitHub issue #11600 is closed; this contribution adds regression coverage for functionality already implemented. The advertised IssueHunt reward is $35 and remains subject to merge and maintainer approval.

## Provenance

- Original author: woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>
- Original patch commit: 0f2ba9ba7f2684a91652ca7e8be36019dd835275
- Original tested upstream master: 36627e209ec37c3ea6784b093053b1d4207b6d38
- Upstream master observed during recovery on 2026-10-08: f59036b4bd7bb4dea9c4bea5dfeaabf0cdc2c6b3
- Old components/select/__tests__/a11y.test.ts blob, still identical at the observed master: 74e52ad1628072fb183c9fd71b09cbed27983d46
- Exact replacement a11y.test.tsx blob: d75191486f4a12149726df9e07f136913a2756c2
- Original format-patch author, date and message are preserved in fix.patch.

## Files

- fix.patch: original two-file Ant Design change, recovered from the complete two-part handoff.
- a11y.test.tsx: exact replacement source for independent byte comparison.
- PR_BODY.md: ready-to-submit body with retained evidence, accurate scope and explicit compensation request.
- react-component-select.patch: original optional, separate companion change. It is not required by the Ant Design PR and has not been submitted.

## Retained validation

The original handoff reports passing the Select tests with all snapshots, touched-file eslint/biome/prettier, and TypeScript no-emit check at the tested base above. Recovery preserved the exact tested source and checked the current old-file preimage; no tests or builds were rerun. This recovery does not claim fresh execution of the original checks.

## Upstream publication

Target ant-design/ant-design, base master, using the original woahwhattheheck contribution.
Title: test(Select): cover popup listbox and option ARIA roles with axe

The upstream fork woahwhattheheck/ant-design was unavailable (404). The active GitHub integration does not expose fork creation; the available browser session was signed out. This carrier contains the ready patch so a publisher with an authorized fork capability can finish delivery.

Before publication, check for a newer existing PR/owner, use a fork in the Ant Design repository network, check the upstream file preimage, and apply fix.patch preserving its original author. Open one PR with PR_BODY.md and record its URL. This carrier is a delivery packet, not the upstream PR.

## Compensation

Issue: https://github.com/ant-design/ant-design/issues/11600
Reward: https://oss.issuehunt.io/r/ant-design/ant-design/issues/11600

@woahwhattheheck is claiming the advertised $35 IssueHunt bounty for this contribution and requests the applicable reward/payment on acceptance. After merge, submit that same merged PR URL on the IssueHunt issue page for maintainer approval. No separate duplicate claim, award or payment is represented by this recovery.
