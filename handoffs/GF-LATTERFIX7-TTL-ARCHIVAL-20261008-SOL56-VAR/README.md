# GF-LATTERFIX7-TTL-ARCHIVAL-20261008-SOL56-VAR

GrantFox/FWC26 source handoff for **LatterFixxx/LatterFix-Smart-contract#7 — Contract State Archival & TTL Extension Strategy**.

## Sponsor fence used

- Issue: https://github.com/LatterFixxx/LatterFix-Smart-contract/issues/7
- Sponsor branch: `main`
- Latest same-repository main commit previously fenced by the adjacent #16 carrier: `15c07c0f0f51787e8ca654c7e5f781446fec8332`
- Exact source blobs re-read immediately before authoring this patch:
  - `src/storage.rs`: `9729e898d16c46cb4564462194f9c8f974e59a00`
  - `src/lib.rs`: `24971696d19d54d85ca2ddcfb2cdf9bb4b8cfb45`
  - `README.md`: `97a251451e654686c00d228cff07a062bef2f47a`
  - `tooling/ttl_bot.py`: `b55ce524caf4d16780d6813b56bff44b743128a2` (audited, unchanged)

Re-read those blobs / current main before publishing. Do not apply if any touched preimage has drifted without reconciling it first.

## What the patch fixes

The repository already had good partial TTL infrastructure, so this patch does not rebuild it.

1. **Active persistent reads now renew near-archival entries.**
   `get_persistent` renews only after a successful read, using the existing threshold/target policy.
2. **The renewal bounds are explicit.**
   Existing `TTL_EXTENSION_THRESHOLD`, `DEFAULT_PERSISTENT_TTL`, and `MAX_PERSISTENT_TTL` are documented as the minimum trigger, normal target, and ceiling.
3. **Maintenance refresh no longer traps on optional/missing global keys.**
   `refresh_all_persistent_ttl` checks existence before extending.
4. **Maintenance bots get a real contract entrypoint.**
   `refresh_persistent_storage(admin)` is admin-authenticated and refreshes known persistent globals without rewriting business state.
5. **Focused retention + authorization regressions are included.**
   One test proves a low-TTL persistent entry is renewed by an active read; one proves the maintenance endpoint rejects a non-admin and safely skips absent globals.
6. **README distinguishes instance/code TTL from application-data TTL.**

This deliberately leaves the current off-chain `tooling/ttl_bot.py` unchanged. Its current simulated `current_ttl = threshold - 100` path is not relied on by the acceptance fix. The new on-chain helper gives a bot a deterministic, threshold-aware maintenance surface; replacing the bot's placeholder RPC query can be a separate cleanup if the maintainer wants it.

## Apply

```bash
git checkout <fresh-sponsor-main>
git am --3way < <(git show woahwhattheheck/bug-bounty:handoff/gf-latterfix7-ttl-archival-20261008-sol56-var:handoffs/GF-LATTERFIX7-TTL-ARCHIVAL-20261008-SOL56-VAR/fix.patch)
```

The banked file is a unified diff rather than a mail-formatted patch; normal application is:

```bash
git apply --3way fix.patch
git add src/storage.rs src/lib.rs src/storage_ttl_test.rs README.md
git commit -m "fix(storage): renew persistent TTL on reads and maintenance"
```

## Focused validation

Authored acceptance-focused tests only:
- `persistent_read_renews_entry_near_archival`
- `maintenance_refresh_is_admin_only_and_skips_missing_keys`

Suggested focused command after applying:

```bash
cargo test storage_ttl_test
```

**Execution status in this seat:** not run. The cloud container could not resolve `github.com`, so it could not obtain the repository checkout; the connector has read/write source access but exposes no fork/sync primitive. No broad suite was attempted.

## Compensation / claim intent

This handoff is source for the existing GrantFox/FWC26 bounty issue and is intended to preserve the contributor's affirmative reward/claim eligibility. Do not add disclaimers that waive or negate compensation.
