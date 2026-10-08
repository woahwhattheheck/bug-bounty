# HANDOFF · QuantumSavory/QuantumSavory.jl#137 · $400 (repeatable) · HUMAN-IMPLEMENT

Issue: https://github.com/QuantumSavory/QuantumSavory.jl/issues/137 — implement a ProtocolZoo networking protocol primitive. Proposed: BBM92 entanglement-based key distribution (`BBM92Prot`).

## Shared facts (QuantumSavory bug bounty program) — HUMAN-IMPLEMENT
- Base: QuantumSavory.jl main @ a749c6fd56c36048e114f6f79683ee2bf9050847 (v0.8.1). Reviewer: Krastanov.
- Program rule (`QuantumSavory/.github/BUG_BOUNTIES.md`): "Contributors new to the project must not use LLMs or coding
  agents to generate code"; new contributors attend office hours. This packet is analysis/design (permitted use); the
  code is to be written by the submitter. Policy closures already happened on #578 (BBM92) and #484 (teleportation).
- Claim (comment on the issue or email skrastanov@umass.edu; reword in your own words): "I'd like to claim this bounty
  for <topic>. Plan: <2 lines>. I'll attend office hours to go over the design before opening the PR. <name>, GitHub
  @woahwhattheheck."
- Payout: after merge email skrastanov@umass.edu (name, email, PR URL) → upload link; invoice PDF with unique number,
  date, work period, "Award: bug bounty - QuantumSavory.jl #N <title>", amount, name/email/postal address, bill to
  "NumFOCUS for the Julia project"; attach W-9 / W-8BEN. Paid in bulk every two months
  (opencollective.com/julialang/projects/julia-krastanov-cqn).
- PR body skeleton: "Closes #N. Claims one instance of the $X bounty in #N. <own summary>. Tests run: <commands>.
  Discussed at office hours on <date>. Requesting the bounty payout on merge per BUG_BOUNTIES.md."
- Tests (repo AGENTS.md): `julia --project=. -e 'using Pkg; Pkg.test(; test_args=["general/<file without _tests.jl>"])'`;
  `["examples/<name>"]` for example wrappers; `["plotting/cairo"]` for headless CairoMakie. CHANGELOG enforced in CI.

## Analysis — #137 BBM92Prot
**Taken already:** on main — entangler, swapper, tracker, consumer, cutoff, switches, QTCP, MBQC. Open PRs — #247
PurifierProt, #393 BBPSSW, #238 DEJMPS, #485 AIMD, #482 zalm/BK, #589/#590 ASPEN-Net. Closed for policy (not design):
BBM92 (#334, #578), teleportation (#416, #484), GHZ projection (#432), BellPairSampler (#426). Fallbacks to raise at office
hours: teleportation protocol (check overlap with PR #213, a BSM circuit) or GHZ fusion as a process.

**Where to look:**
- `src/ProtocolZoo/ProtocolZoo.jl`: tag pattern L130-290; `EntanglementConsumer` template (two nodes, `period`, re-query
  under lock, `pair_id` check, stale-pair drop path) L720-902; `_protocol_nodes` registry (~L908) a new two-node protocol
  must extend; also `protocol_catalog_metadata` with `attachment=:edge`, `permits_virtual_edge=true`, two shorthand constructors.
- Measurement: `project_traceout!(ref, Z/X; time=now(sim))` (`src/baseops/traceout.jl`) returns ±1 and removes the subsystem.
- Messaging: `put!(channel(net, a=>b; permit_forward=true), tag)` (see `swapping.jl:183`), receive with `messagebuffer`,
  `querydelete!`, `onchange`.
- Maintainer checklists: `.agents/context/zoos/add-protocol.md`, `.agents/context/network/protocol-development.md`.

**Design:** `BBM92Prot` fields: `sim`, `net`, `nodeA`, `nodeB`, `period` (or `nothing` = wait on tag changes), `tag`
(default `EntanglementCounterpart`), optional Z-basis bias (`@domain 0 < bias < 1`), `rng`, internal `_log`. Public
accessors for sifted key and QBER (overall and per basis); tests must not read `_log`.
- Design A (first): consumer flow (query, check reciprocal tag, lock both slots, re-query) → untag both → independent
  basis choice per side → `project_traceout!` each side → log + `LOG_GROUPS.protocol` events.
- Design B (follow-up): per-node processes sending basis announcements over the channel (models classical delay).
- Assume Φ⁺ pairs and document it (`EntanglementConsumer` has the same open TODO).

**Edge cases:** tag removed between query and lock; `pair_id` mismatch / tracker update not yet received; slot unassigned
at measurement (drop path); competing consumers; `period=nothing` must not busy-loop; mismatched bases discard the bit but
keep the record; Clifford and QuantumOptics backends.

**Tests (`test/general/protocolzoo_bbm92_tests.jl`):** (1) perfect pairs: QBER 0, sift rate ≈ 0.5 within a binomial band
(seeded rng); (2) `DepolarizedBellPair(F=F)`: QBER ≈ 2(1−F)/3 both bases; (3) T2 dephasing only: Z QBER ≈ 0, X QBER > 0;
(4) stale-query race mirroring the consumer test; (5) multi-hop chain 1→n; (6) add the type to shorthand-constructor,
validation, virtual-edge and surface test files plus a logging check. Docs: `$TYPEDEF`/`$FIELDS` docstring,
`API_ProtocolZoo.md` entry, CHANGELOG.
