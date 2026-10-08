# QuantumOptics.jl#407 — benchmark suite analysis (HUMAN-IMPLEMENT)

Issue: https://github.com/qojulia/QuantumOptics.jl/issues/407 ("Update the benchmark suite and bring it into the CI
runner [$400]"). Analysis of existing code only; excerpts are short quotes of upstream sources. Implementation must be
written by hand (see HANDOFF.md).

| Repo | Branch @ SHA | Last commit |
|---|---|---|
| qojulia/QuantumOptics.jl | master @ f9fd606a8cb9bf0cfb821786117253cbdc110911 | 2026-09-11 |
| qojulia/QuantumOptics.jl-benchmarks | master @ c3e7a1fdb60457fd21508cf8b04598420cc9d548 | 2020-11-24 |
| qojulia/QuantumOptics.jl-website | master @ 9244c2c59e983c82018d8190cea30ec50ec2e446 | 2025-11-29 |
| qojulia/QuantumOpticsBase.jl | master @ f3c09bf426d7b1c9c84e6fc18084613b0a1943c5 | |

## 1. What the issue asks vs. what's done

| # | Ask (abridged) | Status on master |
|---|---|---|
| A | Benchmark-on-CI infrastructure (like QuantumClifford.jl) running on each PR | **Done by maintainers**: `.github/workflows/benchmark.yml` runs `MilesCranmer/AirspeedVelocity.jl@action-v1` on PRs; hardened in #481 (2026-02-06), #530 (2026-07-23); cold-start latency benchmark #539 (2026-08-18, `benchmark/precompile/`). |
| B | Include existing benchmarks, reusing the existing suite | **Not done.** PR-CI suite (`benchmark/benchmarks.jl`, 119 lines) covers only 4 solver RHSs; the in-depth suite (38 examples) lives in QuantumOptics.jl-benchmarks, not in CI. |
| C | Easy to add new micro-benchmarks | **Not done.** No structure/docs, no `benchmark/README.md`. |
| D | Fix comparison runs vs. Python packages (qutip) | **Broken** (§3). |
| E | Add comparative Julia packages (QuantumToolbox.jl) | **Not started.** |
| F | Makefile to update the comparative-benchmarks webpage | **Not done.** Only a `make.jl` with stale paths and a removed keyword. |

Remaining work is B–F; a CI-only PR would duplicate maintainer work. Issue: "Whoever has made a claim takes precedence" —
read all comments before claiming.

## 2. How the existing pieces work
### 2.1 PR-CI micro-suite (QuantumOptics.jl/benchmark/)
- `benchmark/Project.toml`: BenchmarkTools, LinearAlgebra, OrdinaryDiffEqLowOrderRK, PkgBenchmark, QuantumOptics,
  StochasticDiffEq.
- `benchmark/benchmarks.jl` defines `const SUITE = BenchmarkGroup()` (discovered by AirspeedVelocity).
  `prob_list = ("schroedinger", "master", "stochastic_schroedinger", "stochastic_master")` creates tagged groups, each
  with "qo types" and "base array types" subgroups. `bench_*` helpers build SciML `ODEProblem`/`SDEProblem`s whose RHS
  calls `timeevolution.dschroedinger!` / `timeevolution.dmaster_h!` directly, on raw arrays (`pure=true`) and QO types
  (`pure=false`), for `dim in (1//2, 20//1, 50//1, 100//1)` on a `SpinBasis`. Benchmarks are
  `@benchmarkable solve(prob, DP5(); save_everystep=false)` (ODE) and `solve(prob, EM(), dt=1/100; ...)` (SDE), problem
  built in `setup=`.
- `.github/workflows/benchmark.yml`: on `pull_request`, `tune: 'false'`, `job-summary: 'true'`; benchmarks base and head
  and posts a comparison table.
- `benchmark/precompile/scenarios.jl`: cold-start latency scenarios via `QuantumSavory/julia-precompile-benchmark@v3`.

**Defect (verified):** tagged groups use underscores but the SDE loop writes into names with spaces
(`zip(("stochastic schroedinger", "stochastic master"), ...)` → `SUITE[name]["base array types"][...]`). BenchmarkTools
1.8.0 auto-creates missing keys on `getindex`, so no error: the tagged groups `"stochastic_schroedinger"`/
`"stochastic_master"` stay empty and SDE benchmarks land in untagged groups; `@tagged "stochastic_master"` selects
nothing. Fix in the same PR.

The CI suite never calls the user-level API (`timeevolution.master(...)`, `mcwf`, operator arithmetic, `ptrace`,
`wigner`, …), so regressions in high-level layers or QuantumOpticsBase are invisible to PR CI.

### 2.2 Cross-framework comparison suite (QuantumOptics.jl-benchmarks)
Layout: `benchmarks-QuantumOptics.jl/` (37 scripts + `benchmarkutils.jl`, 1714 lines total); `benchmarks-QuTiP/` (40
scripts incl. 3 `*_cython.py`, + `benchmarkutils.py`); `benchmarks-QuantumOpticsToolbox/` (13 Matlab files); helpers
`runall.py`, `collect_results.py`, `extract_code.py`, `hardware_specs.py`, `plot_results.py`, `make.jl`, `clear.sh`.

Each example: `setup(N)` (untimed), `f(...)` (timed), sweep over `cutoffs`, `benchmarkutils.check(name, checks)`,
`benchmarkutils.save(name, results)`. Julia times with `@belapsed ... samples=… evals=…` (min); Python with
`timeit.repeat` then `min(t)/evals`.

Data flow:
1. `runall.py` runs `hardware_specs.py` then every Julia script (QuTiP/Matlab loops commented out).
2. Each script writes `results/results-<framework>-<version>-<name>.json` (list of `{"N","t"}`); Julia label from
   `git rev-parse` in the installed QuantumOptics dir; QuTiP label `qutip.version.version`.
3. `checks/<example>.json`: Julia writes if missing; Python only reads → Julia must run first on a fresh clone.
   `checks/`, `results/`, `results-collected/` are gitignored.
4. `collect_results.py` (hard-coded 52 names) merges into `results-collected/<example>.json` keyed by version label;
   `name[variant]` → `version/variant`.
5. `extract_code.py` strips each implementation to setup/benchmark bodies by string search into `sourcecode/` and
   executes each extracted file.
6. `make.jl` runs 4 and 5, copies `sourcecode/` → `../QuantumOptics.jl-website/src/_benchmarks-sourcecode/` and
   `results-collected/` → `../QuantumOptics.jl-website/src/benchmark-data/`.

### 2.3 Website (QuantumOptics.jl-website)
Jekyll; `_config.yml` sets `source: src`, `data_dir: src/benchmark-data`. `src/_benchmarks/*.html` pages; source panes use
`{% include_relative _benchmarks-sourcecode/<file> %}`. `src/js/benchmark-charts.js` fetches
`/benchmark-data/<canvas id>.json` and rewrites legend labels (`QuantumOptics.jl-<sha>` → `QuantumOptics.jl`,
`QuTiP-<ver>` → `QuTiP`, `/fft`, `/cython` suffixes kept; FFT series deleted). `src/benchmark-data/` and
`src/_benchmarks-sourcecode/` are gitignored despite the README. QuantumToolbox.jl needs a new label regex and new
source panes in `source.html`.

## 3. Verified bitrot in the comparison suite

| # | Where | Problem | Evidence |
|---|---|---|---|
| 1 | QuTiP solver scripts (`timeevolution_*.py`, 21 files) | `qt.Options()` no longer exists in QuTiP 5 (options are a dict) | qutip 5.3.1: `hasattr(qutip,"Options")` False; `timeevolution_master_cavity.py` → `AttributeError` |
| 2 | same | `qt.mesolve(H, psi0, tspan, J, [n], options=options)` passes `e_ops` positionally; now keyword-only | `inspect.signature(qutip.mesolve)` = `(H, rho0, tlist, c_ops=None, *, e_ops=None, args=None, options=None)`; `mcsolve` likewise, `ntraj` keyword-only |
| 3 | `*_cython.py` (3) | QuTiP-4 string-coefficient options (`rhs_reuse`, `nsteps`); QuTiP 5 compiles string coeffs via `QobjEvo`, needs Cython | code + QuTiP 5 API; keep or drop (§5.4) |
| 4 | `timeevolution_master_timedependent_cavity.jl` | `HJ(t::Float64, rho::DenseOperator)` — `DenseOperator` is now a constructor function, not a type (`QuantumOpticsBase/src/operators_dense.jl` 59–65) | Julia 1.13.1: `ArgumentError("invalid type for argument …")` |
| 5 | `benchmarkutils.jl` | version label via `Base.functionloc(QuantumOptics.eval, Tuple{Nothing})` + `git rev-parse` — only works for a dev'd checkout, hides QuantumOpticsBase version | code; use `pkgversion(...)` |
| 6 | `make.jl` | `cp(...; remove_destination=true)` removed in Julia 1.0 (now `force=true`); hard-coded `@assert`ed website path | code |
| 7 | `runall.py` | QuTiP/Matlab loops commented out; no single-framework/example run; no quick mode (N up to 150 dense ME → hours) | code |
| 8 | `benchmarkutils.py` `check()` | opens `../checks/<name>.json` unconditionally → fresh clone fails unless Julia ran first | code + `.gitignore` |
| 9 | `hardware_specs.py` | parses `qutip.about()` with `split("\n")[4:]`; QuTiP 5.3.1 header is longer; uses `lscpu` (Linux-only) | `qutip.about()` on 5.3.1 |
| 10 | Matlab toolbox | 10 examples; needs Matlab licence + unmaintained toolbox | ask maintainers whether to drop |

Otherwise the Julia scripts use current API names (`timeevolution.master/mcwf/schroedinger/master_dynamic`, `ptrace`,
`wigner`, `qfunc`, `transform(bp, bx)`, `randoperator`, `sprand`, `DenseOperator(b, data)` as constructor;
`master_dynamic(tspan, rho0, f; rates, fout, ...)` matches `src/master.jl:252`). Smoke-run each anyway.

## 4. Where each change goes

| Ask | Files | Notes |
|---|---|---|
| B/C port examples to PR-CI | `QuantumOptics.jl/benchmark/benchmarks.jl` (optionally split into `benchmark/<area>.jl`); `benchmark/Project.toml` | reuse comparison `setup`/`f` bodies at 1–2 small sizes; tagged groups per area (operators, states, metrics, timeevolution); fix stochastic group-name defect |
| C docs | new `benchmark/README.md` | naming/tags, setup outside timed region, CI size limits, local run (§7) |
| D QuTiP | `benchmarks-QuTiP/*.py`, `benchmarkutils.py`, new pinned `requirements.txt` | options dict, keyword `e_ops`, cython decision, tolerant `check()` or committed reference checks |
| D Julia side | `benchmarks-QuantumOptics.jl/benchmarkutils.jl`, `timeevolution_master_timedependent_cavity.jl`, new `Project.toml` (+ Manifest optional) | `pkgversion` labels, fix `DenseOperator` annotation, reproducible env |
| E QuantumToolbox.jl | new `benchmarks-QuantumToolbox.jl/`; `collect_results.py`; `extract_code.py`; website `benchmark-charts.js`, `_benchmarks/source.html` | start with time evolution (master, mcwf, schroedinger for cavity, JC, particle) |
| F Makefile | new `QuantumOptics.jl-benchmarks/Makefile`; retire/fix `make.jl`, `runall.py`, `clear.sh` | targets env, per-framework runs, collect, extract, specs, website, clean; `WEBSITE_DIR ?= ../QuantumOptics.jl-website`; `QUICK=1` |

## 5. Design options
- 5.1 Where the comparison suite lives: keep separate repo (no Python/Matlab deps in package, but it bitrotted 6 years)
  vs move into `QuantumOptics.jl/benchmark/comparison/` (discoverable; scheduled workflow keeps it alive; Python tooling in
  main repo). Ask maintainers. Micro-suite stays in the main repo regardless.
- 5.2 Comparison in CI: never per-PR. Options (a) local Makefile only; (b) `workflow_dispatch`/monthly QUICK job uploading
  `results-collected/` as artifact, failing loudly on API breakage; (c) full run on a dedicated machine. (b) is the cheap
  bitrot alarm; published numbers from a quiet machine.
- 5.3 Breadth vs CI time: AirspeedVelocity runs every benchmark on two revisions with `tune: false` — dense N ≤ ~50,
  sparse ≤ ~200, allocations in `setup=`, `evals=1` only for mutating work, short `tspan`; tag groups.
- 5.4 QuTiP "[cython]": drop, or redefine as string vs Python-function coefficients under QuTiP 5 (needs Cython + the
  `/cython` label regex).
- 5.5 Fair timing: pin BLAS threads to 1 both sides, set `JULIA_NUM_THREADS`, one warm-up both sides, match
  `reltol=1e-6, abstol=1e-8`, check `qt.destroy(N)` default sparse format, justify/remove Julia-only
  `set_zero_subnormals(true)`.
- 5.6 Version labels: package versions + dirty marker, include QuantumOpticsBase.

## 6. Edge cases
1. Fresh-clone ordering (QuTiP checks exist only after Julia runs) — commit reference `checks/` or order Makefile targets.
2. mcwf checks compare sums of single trajectories (`ntraj=evals`) — seed and average, or relax.
3. Time-dependent parity: QuTiP list-format/`QobjEvo` with `args` vs QO `master_dynamic` with a function; same frame and
   `ωl` sign.
4. `[fft]` variant mapped to `version/fft` and deleted by JS — keep hidden or present deliberately.
5. `collect_results.py` matches by substring — new QuantumToolbox filenames must not cross-match; prefer exact parsing.
6. AirspeedVelocity base vs head: anything in `benchmarks.jl` must load against base too; guard new APIs with `isdefined`.
7. `benchmark/Project.toml`: list every new dep (SparseArrays, StableRNGs); prefer `StableRNGs` over `Random.seed!`.
8. Hardware specs: collect versions programmatically (`qutip.__version__`, numpy/scipy, `versioninfo()`); `lscpu` Linux-only.
9. Runtime: QUICK mode with 1–2 cutoffs for smoke/CI.
10. Website: `QuantumToolbox.jl-<ver>` legend regex + source pane; charts must render when a framework lacks an example.

## 7. Test plan and how to run
7.1 Micro-suite:
    cd QuantumOptics.jl
    julia --project=benchmark -e 'using Pkg; Pkg.develop(path="."); Pkg.instantiate()'
    julia --project=benchmark -e 'include("benchmark/benchmarks.jl"); foreach(k -> println(k, " => ", collect(keys(SUITE[k]))), keys(SUITE))'
Subset in a `--project=benchmark` REPL: `run(SUITE[@tagged "master"]; verbose=true)`. Compare revisions like CI with the
AirspeedVelocity CLI (`benchpkg QuantumOptics --rev=master,dirty --path=.`, `benchpkgtable ...`; check `--help`).
Acceptance: no empty groups; tags match names; suite loads on base and head; CI duration before/after recorded.

7.2 Comparison suite: Python venv with pinned qutip (5.3.1), numpy, scipy (+Cython only if string variant kept); Julia
`--project=benchmarks-QuantumOptics.jl` instantiate (same for QuantumToolbox folder). `QUICK=1` smoke: no exceptions;
non-stochastic examples pass `check()` at `eps=1e-5` across frameworks; one results file per (framework, example);
`collect_results.py` → one JSON per example with all framework keys; `extract_code.py` regenerates and executes `sourcecode/`.

7.3 Makefile: `make -n all` order env → julia → qutip → qtoolbox → collect → extract → specs → website;
`make QUICK=1 all` works on a fresh clone and is idempotent; `WEBSITE_DIR` override honoured; `make clean` removes only
generated dirs.

7.4 Website: after `make website`, `jekyll serve`; `/benchmarks.html` shows three clean series, source panes for all
three, no 404s for `/benchmark-data/*.json`.

## 8. Questions for maintainers
1. Keep comparison suite in QuantumOptics.jl-benchmarks or move into `QuantumOptics.jl/benchmark/comparison/`?
2. Is the website still deployed from QuantumOptics.jl-website (last commit 2025-11-29), and by whom?
3. Drop or keep the Matlab toolbox and QuTiP "[cython]" variants?
4. CI time budget for the micro-suite?
5. Commit reference `checks/` values?
6. Scheduled/manual QUICK comparison workflow wanted?

Suggested split: (1) micro-suite fixes/expansion + README; (2) Julia comparison fixes + project file; (3) QuTiP 5 port +
requirements.txt; (4) QuantumToolbox.jl suite; (5) Makefile, retire `make.jl`/`runall.py`; (6) website legend/source panes.

## 9. Local verification behind this analysis
- QuTiP 5.3.1 (throwaway venv): `hasattr(qutip,"Options")` False; `mesolve`/`mcsolve` keyword-only `e_ops`;
  `benchmarks-QuTiP/timeevolution_master_cavity.py` → `AttributeError: … no attribute 'Options'`.
- Julia 1.13.1 + BenchmarkTools 1.8.0: `getindex` on a missing `BenchmarkGroup` key auto-creates it (silent empty-group
  defect); a function used as an argument type → `ArgumentError: invalid type for argument`.
- Not run: full load of `benchmark/benchmarks.jl` (shared CPUs busy) — §7.1 commands are the first thing to run.
