# LatterFix #16 Soroban 21 compatibility handoff

Source issue: LatterFixxx/LatterFix-Smart-contract#16.

## Fresh sponsor fence

- Sponsor branch: `main`
- Sponsor main commit: `15c07c0f0f51787e8ca654c7e5f781446fec8332`
- `Cargo.toml` blob: `6d1aae7d88ea6453089ee40adb85c020be25f34a`
- `Cargo.lock` blob: `16d0772e027a127c064eb20622fdb2b3b1e1eac2`
- `README.md` blob: `97a251451e654686c00d228cff07a062bef2f47a`
- Existing `.github/workflows/formal-verification.yml` blob: `99de066e8d368f1653803781ba52ed5d5f43a967`
- Sponsor issue was OPEN/unassigned with GrantFox OSS / Maybe Rewarded / Official Campaign | FWC26 labels and no sponsor PR found at the source fence.

## Why this patch

The dependency graph already resolves `soroban-sdk` and `soroban-sdk-macros` to `21.7.7`, the final 21.x release, while `Cargo.toml` still declares `21.7.0`. The repo's README and docs.rs metadata still use `wasm32-unknown-unknown`. Current Stellar SDK guidance requires `wasm32v1-none` and `stellar contract build` on modern Rust.

The patch therefore avoids contract-logic churn and:
1. pins both normal and test Soroban SDK requirements to exactly `21.7.7`;
2. declares Rust 1.84 as the minimum because that is where `wasm32v1-none` is available;
3. moves docs/deploy instructions to `wasm32v1-none` and `stellar contract build`;
4. adds one focused compatibility workflow: host unit tests with warnings denied, then a Stellar CLI contract build.

`Cargo.lock` needs no version churn because it already resolves the requested 21.7.7 graph.

## Patch receipt

- File: `fix.patch`
- SHA-256: `dedcb21916e98cbefa4f3695925d7caefb27dcd0ace2331f4fd63edd2bc63f6d`
- Local validation: `git apply --check` PASS against the exact manifest and README compatibility preimage; focused static assertions PASS.
- No Cargo build/test execution is claimed from this source seat because the cloud container cannot materialize crates from GitHub/crates.io and this GitHub connection has no fork-creation primitive.
- A fork-capable matching-author publisher should fresh-fence sponsor main and existing #16 PRs, apply this patch, then run only the issue-required compatibility workflow / focused host test and contract build. Release on any source drift.
