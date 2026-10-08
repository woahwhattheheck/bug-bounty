# HANDOFF · qojulia/QuantumOptics.jl#407 · NumFOCUS bug bounty $400 · HUMAN-IMPLEMENT

- Issue: https://github.com/qojulia/QuantumOptics.jl/issues/407 — open, labels `bounty:400`, `bug bounty`, opened by
  Krastanov 2024-08-01. Reviewers: Stefan Krastanov and/or @david-pl. Duration 2 months.
- Program rules: https://github.com/QuantumSavory/.github/blob/main/BUG_BOUNTIES.md (@40eace9e); QuantumOptics.jl is
  listed as an external project under the program (line 16).
- Payout evidence: rules file reports >$8000 awarded 2024–25 (https://opencollective.com/julialang/projects/julia-krastanov-cqn);
  17 award expenses there in 2025–26. NSF-funded, run by NumFOCUS, paid in bulk every two months.
- Packet: HUMAN-IMPLEMENT. `ANALYSIS.md` covers existing code, where each change goes, design options, edge cases,
  test/benchmark commands. No implementation code, no patch.
- Base: QuantumOptics.jl master@f9fd606a8cb9bf0cfb821786117253cbdc110911; QuantumOptics.jl-benchmarks
  master@c3e7a1fdb60457fd21508cf8b04598420cc9d548; QuantumOptics.jl-website master@9244c2c59e983c82018d8190cea30ec50ec2e446.
- Competition: no linked PRs. Issue comments weren't visible from the analysis environment — check for an existing claim.
- Important: the CI benchmark job (issue item A) already exists on master (maintainer PRs #481, #530, #539). The open
  work is items B–F (see ANALYSIS §1).

## Program rules that apply
- Line 36: first submission / not a known Julia developer → "do not use LLMs".
- Line 38: new contributors must not use LLMs/agents to generate code; may use them to analyze existing code and review
  their own code; must attend office hours (https://quantumsavory.org/community/office-hours/).
- Lines 42–52: after a first approved PR, disclose AI use (agent, model/version, prompts, hand fixes, line-by-line
  understanding, local runs); "please do not use an LLM to respond to these points"; non-compliant PRs are closed.
- Line 22: "polished, tested, and documented — not simply a code dump"; separate reviewable commits.
- Line 26: whoever finishes an abandoned bounty gets it, but the original claimant is contacted first.

## Claim (issue body: "Whoever has made a claim takes precedence")
Comment on #407 or email the maintainer, in your own words: claiming the bounty; planned scope B–F (noting item A already
exists); the ANALYSIS §8 questions (esp. where the comparison suite should live); that you'll attend office hours.

## PR (when the hand-written implementation is ready)
Title referencing the benchmark suite; `Closes #407`; per-commit summary; before/after CI benchmark job duration;
QUICK-mode run output; local website chart screenshot; a line noting it's for the $400 bug bounty and requesting the
award on merge. Open companion PRs in QuantumOptics.jl-benchmarks and the website repo and cross-link.

## Payout (BUG_BOUNTIES.md lines 54–66)
1. After merge, email skrastanov@umass.edu with name, email, PR URL.
2. Upload a PDF invoice via the link received: unique number; submission date; work period;
   "Award: bug bounty - QuantumOptics.jl#407 <PR #>"; total $400; name, email, postal address;
   bill-to "NumFOCUS for the Julia project".
3. Upload W-9 (US) or W-8BEN (non-US).

## Validation
Analysis only — see ANALYSIS §9 (QuTiP 5.3.1 API checks + failing QuTiP script; Julia 1.13.1 / BenchmarkTools 1.8.0
checks). Full micro-suite load not run; commands are in ANALYSIS §7.1.
