# HANDOFF · JuliaDynamics/ResumableFunctions.jl#99 · QuantumSavory bug bounty (NSF/CQN, paid via NumFOCUS) $600 · HUMAN-IMPLEMENT

Issue: https://github.com/JuliaDynamics/ResumableFunctions.jl/issues/99 (OPEN, unassigned, labels `bounty:600`, `bug bounty`; no linked PRs)
Program rules: https://github.com/QuantumSavory/.github/blob/main/BUG_BOUNTIES.md
Payout evidence: BUG_BOUNTIES.md reports >$8000 awarded in 2024–25 (https://opencollective.com/julialang/projects/julia-krastanov-cqn);
discovery found 17 "Award: bug bounty" expenses there in 2025–26, latest 2026-08-03.
Base: master @ 60268086ff9e5bf338c126bcbd7220a865c5e27e (v1.0.8). Reviewer: Stefan Krastanov.
Competition: none open. PR #100 (thofma, scoping) merged 2024-11-21 — the work this bounty builds on. PR #92 closed 2024.

## Status: HUMAN-IMPLEMENT (no patch)
The program's "Usage of AI (Important!)" section: "Contributors new to the project must not use LLMs or coding agents to
generate code. They may use these tools to analyze existing code and to review code they have written themselves. New
contributors participating in the bounty program must attend office hours to discuss their pull request."
`ANALYSIS.md` is an analysis of existing code + JuliaLowering + design/test plan (permitted use). Implementation, tests
and docs are to be written by the submitter. After a first approved PR, AI use must be disclosed (agent/model/version,
prompts, hand fixes, line-by-line read, local tests), and "please do not use an LLM to respond to these points".

Other expectations: "polished, tested, and documented — not simply a code dump"; squash messy commits; big changes in
separate commits; $800+ projects need proof of skill (this is $600). Office hours: https://quantumsavory.org/community/office-hours/

## Claim (post on #99, or email skrastanov@umass.edu with name, GitHub username, optionally past projects)
Draft — adjust to your own words:
```
Hi @Krastanov, I'd like to claim this bounty and work on it.

Proposed plan (happy to adjust):
1. Replace the ScopeTracker/scoping() renaming added in #100 with JuliaLowering's scope resolution (macro expansion,
   desugaring, resolve_scopes), mapping each binding back to the user's identifier via provenance, keeping the current
   pass as a fallback when JuliaLowering isn't available.
2. As a follow-up, build the step function from JuliaLowering's linear IR so yields inside nested try/catch/finally,
   closures over variables that change across a yield (#134), and varargs + kwargs (#135) work.

Before I start: is the $600 scope (1), or (1) + (2)? And how would you like the JuliaLowering dependency handled while it
is unregistered (package extension with a pinned commit, vendoring, or waiting until it ships with Base)?

I'll join office hours to discuss the approach before opening a PR.

Name: <FULL NAME>
GitHub: @woahwhattheheck
```

## Payout after merge
1. Email skrastanov@umass.edu with name, email, bounty PR URL.
2. Upload a PDF invoice via the link you receive: unique invoice number; submission date; work period;
   "Award: bug bounty - ResumableFunctions.jl#99 <PR URL>" (the word "award" is required); total $600; name, email,
   postal address; "Bill to: NumFOCUS for the Julia project".
3. Upload a W-9 (US) or W-8BEN (non-US). Payouts are processed in bulk every two months.

## Focused validation for the implementer
`julia --project -e 'using Pkg; Pkg.test(test_args=["main"])'`, then as touched: `"repeated_variable"`, `"globals"`,
`"typeparams"`, `"yieldfrom"`, `"logging"`, `"selfreferencing_functional"`, `"inference_recursive_calls"`,
`"performance"`, plus a new edge-case file.
