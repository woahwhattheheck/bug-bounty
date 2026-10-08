# HANDOFF · QuantumSavory/QuantumSavory.jl#132 · $200 · HUMAN-IMPLEMENT

Issue: https://github.com/QuantumSavory/QuantumSavory.jl/issues/132 — improve Makie visualization. Proposed scope: show quantum states in flight in network plots (#97), optionally message buffers (#96). Agree scope with the reviewer first.

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

## Analysis — #132 (in-flight states, issue #97)
**Scope:** visualization issues #96 (message buffers; PR #586 closed), #97 (states in channels; no PR), #98 (state
tooltips; related open PR #450). Recommend #97, #96 optional.

**Today:** `QuantumChannel.put!` (`src/quantumchannel.jl` L59-65) swaps the qubit into a one-slot channel register,
advances its noise to arrival time, then `DelayQueue.put!` spawns a ConcurrentSim `latency` process holding it until
arrival — in-flight qubits can't be inspected. Makie extension (`ext/QuantumSavoryMakie/QuantumSavoryMakie.jl` ~L150)
`update_plot` skips states whose register isn't in the network (TODO: "maybe it is in a temporary message buffer
register?"), so entanglement lines to in-flight halves disappear. Marker buffers are fixed size and NaN-padded (L58-61)
because GLMakie buffers can't be resized.

**Design:** core — `QuantumChannel` records each in-flight item (channel register, send time, arrival time), added on
`put!`, removed on delivery, existing constructors kept, documented accessor. Plot — marker layer lerping source→dest by
(now − sent)/delay over `net.qchannels`; map a channel register's subsystem to its marker so entanglement links still
draw; capacity theme attribute with NaN padding; `inspector_label` tooltip reusing `get_state_vis_string`.

**Edge cases:** zero delay (`RegisterNet` default); several items per edge and bidirectional traffic (offset markers);
arrived-but-not-taken items; tooltip shows arrival-time state (document); map (Tyler) coordinates; exceeding capacity.

**Tests:** `general/quantumchannel` — in-flight count 1 between `put!` and arrival, then 0, correct timestamps; new
plotting file included from `cairo_tests.jl` — two-node net with `quantum_delay=10`, run to t=5, assert marker at the
midpoint, save PNG.
