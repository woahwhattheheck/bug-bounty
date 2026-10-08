# HANDOFF · JuliaGraphs/Graphs.jl#448 · Open Collective (julialang / NumFOCUS) $400 · HUMAN-IMPLEMENT

| | |
|---|---|
| Issue | https://github.com/JuliaGraphs/Graphs.jl/issues/448 (OPEN, labels `bounty`, `bounty:400`, unassigned) |
| Bounty rules | https://github.com/QuantumSavory/.github/blob/main/BUG_BOUNTIES.md |
| Payout evidence | julialang Open Collective project https://opencollective.com/julialang/projects/julia-krastanov-cqn. The program reports more than $8,000 awarded in 2024–25, and there were 17 "Award: bug bounty" expenses in 2025–26. |
| Deliverable | Analysis packet, no implementation code. It was returned to the coordinator in the engineer report (2026-10-08) because this seat cannot write analysis files. Save it as `ANALYSIS.md` next to this file. |
| Status | **HUMAN-IMPLEMENT**: Bryce writes the code by hand. No `fix.patch` is included. |

## Why there is no patch

The program's "Usage of AI" rule says contributors new to the project must not use LLMs or coding agents to generate code. Analysing existing code with such tools is allowed. New contributors must also attend office hours.

Krastanov enforces this. On 2026-09-12 he closed VNGraphs.jl PRs #33–#37, including #37 with the comment "LLM work from new contributors is not acceptable for bounties".

The analysis packet covers:

- the existing code
- the C library's behaviour and edge cases
- the binary and JLL status
- maintainer guidance
- the competing PRs
- a design in prose
- a test plan

## Key facts (details in the analysis packet)

- **No Yggdrasil work is needed.** `very_nauty_jll` 1.1.2+0 exists for 18 platforms, and VNGraphs.jl already uses it.
- **VNGraphs.jl master (v1.1.0)** already has native bindings, written by the maintainer's agent in September 2026.
- **What is still open:**
  - correctness fixes (`has_edge` uses the wrong index base; a `cluster_sizes` buffer leaks)
  - the full AbstractGraph interface, plus GraphsInterfaceChecker tests
  - fast conversions or views
  - algorithm dispatch (`chromatic_number(g, alg)` and related)
  - docs
- **Graphs.jl declarations** are already proposed by #529 (which follows Krastanov's #507 review) and by #528 (a generic mechanism). Coordinate with those; don't add a third.
- **Contested:** Graphs.jl #507 is stale but its author has already emailed about payment, and #529 and #528 are open. VNGraphs.jl #26 has changes requested and #14 is open.
- **Precedence:** claim it with Krastanov in the claim comment / office hours (fleet note 2026-09-20 asked him about precedence for Bryce).

## Claim — ready to paste

You can claim by commenting on the issue or by emailing skrastanov@umass.edu. The email has already been sent, so use the comment only if precedence has not been confirmed.

Issue comment:

```
Hi @Krastanov, I'd like to work on this bounty. Name: <full name>, GitHub: @woahwhattheheck. Relevant background: <projects>. I plan to split the work as suggested in the #507 / VNGraphs#26 reviews:
(1) VNGraphs correctness fixes (has_edge 0-based indexing + Bool, cluster_sizes leak, locking around very_nauty's global state);
(2) full AbstractGraph interface + GraphsInterfaceChecker tests;
(3) fast conversions/views;
(4) VNAlgorithm dispatch for chromatic/edge-chromatic/clique number, building on whichever Graphs.jl declaration route you prefer (#529 or #528).
I'll join office hours to go over the plan. Could you confirm which parts are still open for me?
```

## PR body template (for each PR Bryce opens)

```
Part of #448 (very_nauty wrapper bounty, $400). <what this PR covers in one or two lines>

- <change 1>
- <change 2>
Tests: <commands run and results>

Bounty claim: I'm working on the #448 bounty (claimed by email/comment on <date>) and request the award for this work once the bounty scope is merged. Payout details will be sent per BUG_BOUNTIES.md.
```

The tracking issue lives in Graphs.jl, but the main code goes into VNGraphs.jl. A "Closes #448" line belongs only on the final PR that completes the checklist. Use the form `Closes JuliaGraphs/Graphs.jl#448` for that PR if it is opened in VNGraphs.jl.

## Payout steps after merge (from BUG_BOUNTIES.md)

1. Email skrastanov@umass.edu with your name, email and the bounty PR URLs.
2. Upload a PDF invoice at the link you receive. It must include:
   - a unique invoice number, the date, and the period the work was done
   - the line "Award: bug bounty - Graphs.jl #448 very_nauty wrapper"
   - $400
   - your name, email and postal address
   - billed to "NumFOCUS for the Julia project"
3. Upload a W-9 (US) or W-8BEN (non-US).
4. NumFOCUS pays in bulk every two months, through the julialang Open Collective project.

## Validation

None: this packet contains no code. The facts in the analysis packet come from checked-out sources at the SHAs listed there, `nm -D` on the JLL artifact, and GitHub pages read on 2026-10-08.

## Competition

Graphs.jl #507 (stale, but its author emailed about payment), #529 and #528 are open, and VNGraphs.jl #26 and #14 are open. The lane is crowded, and the maintainer is doing the core binding work himself. Confirm scope with Krastanov before investing time.
