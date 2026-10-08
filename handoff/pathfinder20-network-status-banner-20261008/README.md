# GrantFox Pathfinder #20 — network status banner handoff

Target: ShippedLabs/Stellar-Path-Finder#20
Sponsor branch: main
Fenced source: src/app/page.tsx blob b3bcbefcdedcb172e6f848f58b34ca36474cce3c
Referenced endpoint helper: src/lib/horizon-client.ts blob 90ce76d131d75f12b30d044d37948cf4dd580b49

This packet contains exact postimages for the two issue-scoped files:
- files/src/lib/network-health.ts (new)
- files/src/app/page.tsx (replacement postimage)

Behavior:
- lightweight GET to the selected network's Horizon root URL
- AbortController-backed 3 second deadline; timeout, fetch failure, or non-2xx => degraded
- health check runs on initial mount and whenever the selected network changes
- stale async results are ignored after effect cleanup
- switching network re-enables the informational notice
- degraded state shows a dismissible amber status banner above the search form
- search/form state is never disabled or blocked by health state

Validation in this source-bank lane is intentionally focused: exact sponsor-source preimage fence plus deterministic postimage assertions/readback. No broad build or test suite is claimed.

Publisher instructions: fresh-fence sponsor main, issue #20 ownership, and existing upstream PRs. If still clean, copy these two postimages onto one matching-author fork branch, run only issue-relevant checks if practical, and publish one canonical PR with Closes #20, /claim #20, and an affirmative request for eligible GrantFox/FWC26 compensation. Stop on source drift, a new assignee, or an existing upstream carrier.
