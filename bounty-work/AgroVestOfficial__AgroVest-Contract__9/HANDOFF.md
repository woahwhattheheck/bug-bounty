# AgroVest #9 source handoff

Sponsor: AgroVestOfficial/AgroVest-Contract#9
Prepared source base: 8cb0274f11dee8ad1d1fa90da72b1840520a75c8

Expected preimages:
- contracts/dao/src/lib.rs: 9003a183d8b12e57338236a035100e512965ab9a
- contracts/dao/src/test.rs: e73bcc3dbb93d0cf02840a5f276bdac5c9532c82

Apply fix.patch to a fresh branch from the exact sponsor base.

Change:
- tally_votes loads the proposal and rejects ledger timestamps below proposal.ends_at with existing ProposalNotEnded.
- focused regression covers an early tally.
- the three existing execute tests advance to the exact ends_at boundary before tallying, preserving their original behavior and proving the boundary is inclusive.
- only the Ledger testutils trait import is added.

Focused check after applying:
cargo test -p agrovest-dao test_tally_votes_before_proposal_end_fails

This preparation seat performed static preimage/transformation checks only. No Cargo test or broad suite was run.

Transport note:
The connected GitHub App is pull-only on the sponsor repo, no woahwhattheheck fork was available to this session, and the cloud container has no authenticated GitHub CLI/DNS transport. No sponsor source, issue, or PR was changed here. A fork-capable matching-author publisher should fresh-fence issue/main/competing PRs, apply this exact patch, keep the two-path scope, and publish one canonical contribution if still unowned.
