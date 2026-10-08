# HANDOFF · QuantumSavory/QuantumSavory.jl#138 · $400 (repeatable) · HUMAN-IMPLEMENT

Issue: https://github.com/QuantumSavory/QuantumSavory.jl/issues/138 — new interactive example. Proposed: superdense coding over a noisy link.

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

## Analysis — #138 interactive superdense-coding example
**Distinct from:** hijirii's fork PR (line/ring/star/mesh topologies); closed #582 (butterfly network coding), #523 (qumode
transduction); open #236 (multiplexed). Superdense coding appears only as a small non-interactive example in
`docs/src/manual.md`; `SDEncode`/`SDDecode` already exist in CircuitZoo.

**Layout (copy `examples/simpleswitch`):** `setup.jl`, `1_interactive_visualization.jl` (GLMakie),
`2_wglmakie_interactive.jl` (Bonito, for areweentangledyet), `README.md`, test wrapper `test/examples/<name>_tests.jl`.

**Mechanics:** two-node `RegisterNet`, Bob has one extra free slot; `EntanglerProt` generates pairs with a noisy state
(e.g. `DepolarizedBellPair(F)`) and T2 backgrounds. Alice process: find an `EntanglementCounterpart` slot, lock, untag both
halves, `SDEncode` a random 2-bit message, `put!` her qubit into `qchannel(net, 1=>2)`. Bob process:
`@yield take!(qc, freeSlot)` (errors if occupied), `SDDecode`, log sent/received bits. `RegisterNet` channels have no
background noise; for channel noise build `QuantumChannel(sim, delay, background)` — ask the reviewer first.

**Shows:** sliders for F, T2, channel delay, success probability; live symbol error rate, per-bit error rates, goodput vs
a classical 1-bit baseline next to `registernetplot_axis`.

**Analytic oracles:** depolarized pairs → symbol error = 1−F, BER = 2(1−F)/3; pure dephasing flips only bit 1 (Z-encoded);
perfect pairs → zero errors. **Tests:** seeded assertions (zero errors with perfect pairs; deliveries > 0); keep GL out of
the tested path; render a static CairoMakie PNG as evidence.
