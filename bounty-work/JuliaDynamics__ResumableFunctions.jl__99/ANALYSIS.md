# ResumableFunctions.jl#99 — analysis for a hand-written implementation

Base: master @ 60268086ff9e5bf338c126bcbd7220a865c5e27e (v1.0.8). JuliaLowering: standalone
`JuliaLang/JuliaLowering.jl@65ecb79` (2025-11-14) and the copy in `JuliaLang/julia` master (`JuliaLowering/`, 1.14.0-DEV).
Toolchain: Julia 1.13.1. No implementation code in this document.

## 1. Summary
- **Remaining scope.** Issue edited after PR #100: #100 "fixed most of the issues without JuliaLowering.jl, using a local
  reimplementation of the language's scoping rules"; the remaining bounty "covers moving that work to JuliaLowering for a
  more centralized source of truth on scoping". Minimum deliverable: replace `ScopeTracker`/`scoping()` (`src/utils.jl`,
  ~300 lines) with JuliaLowering scope resolution. The title also describes the larger goal (state machine from lowered
  code). Agree which is paid with the reviewer first.
- **Feasibility (checked on 1.13.1).** Standalone JuliaLowering (`65ecb79` + JuliaSyntax `99e975a7`) loads and lowers
  `Expr`-built functions. After `resolve_scopes` every identifier is a binding id; the binding table has name, kind
  (`:local`/`:argument`/`:global`), `is_internal`, `is_captured`. Provenance maps each binding occurrence back to the exact
  input `Identifier` node. Linear IR has explicit `enter`/`leave`/`pop_exception`.
- **Recommended path (two PRs).** Phase A "scope oracle": stages 1–3 only for renaming, rest unchanged, with fallback.
  Phase B "IR-level state machine": build the step function from linear IR — the only fix for the try/catch/finally and
  closure failures in §6 (caused by source-level `@goto`/`@label` rewriting).
- **Main constraint.** JuliaLowering is unregistered, lives in the julia monorepo, is not default lowering in 1.13; the
  package supports `julia = "1.10"`. Anything built must be optional and version-gated, old code kept as fallback.

## 2. How the current transform works (`src/macro.jl`, `src/transforms.jl`, `src/utils.jl`, `src/types.jl`)
1. Validate/split: checks `length=`, `MacroTools.splitdef`; `get_args` collects arg names/types.
2. Desugar (postwalk): `transform_arg_yieldfrom`/`transform_yieldfrom` turn `@yieldfrom` into a loop over `generate()`
   yielding each value; `transform_for` turns every `for` (incl. multi-iterator) into `while` with `_iterator_n`,
   `_iterstate_n`, `_iteratornext_n`; `continue` → `@goto _iteratorlabel_n`.
3. Scoping (PR #100): `ScopeTracker` stack of Symbol→Symbol maps seeded with args, kwargs, function name, type params;
   `scoping()` renames each local to `name_k`; `transform_remove_local` drops `local`.
4. Field inference (`get_slots`): throwaway inference function with `@yield v` → `Base.inferencebarrier(v)` and `@nosave`
   excluded; `@eval` in caller module, `code_typed(optimize=false)`, read slot names/types (union same names); drop
   `catch e` vars; unreachable → `Any`.
5. Struct: `mutable struct <name>_FSMI{where..., slotT...} <: FiniteStateMachineIterator{rtype}` with `_state::UInt8` +
   one field per slot. On ≥1.10, generated `typed_fsmi` (`FSMIGenerator`) re-infers with concrete arg types at caller
   world age; recursion/self-referencing functionals fall back to `typed_fsmi_fallback`.
6. User-facing constructor keeps the original signature, builds the struct, copies args into fields.
7. Step method `(_fsmi::T)(_arg=nothing)`, rewritten in order: `transform_slots` (`x` → `_fsmi.x`); `transform_arg`
   (`x = @yield v` → `@yield v; x = _arg`); `transform_exc` (after each yield `_arg isa Exception && throw(_arg)`);
   `transform_try` (splits a `try` only at direct top-level `@yield`s, segments joined by `@goto _TRY_n`, single `finally`
   moved after the label); `transform_yield` (`_state = n`, `return v`, `@label _STATE_n`, `_state = 0xff`);
   `transform_nosave`. A dispatch prelude jumps on `_state` to each label.
8. `IteratorSize`/`length` for `length=`; `Base.iterate`/`generate` drive the machine.

Structural limitations:
- Control flow rebuilt at source level; Julia forbids `@goto` into try/catch and out of try/finally, so any yield not
  directly in a `try` body fails at definition time (inside `if` within `try`, inside `catch`, nested `try`,
  try/finally in a loop with `continue`/`break`).
- Variables become fields by name; closures capture through `Core.Box` from the inference function while the field
  receives the raw value (#134).
- Scoping is a re-implementation with per-construct special cases; unknown forms fall into a generic rename branch.
- User macros in the body are not expanded before transforms (#55, #54).

## 3. What PR #100 covers (thofma, ebe3af3, +367 `src/utils.jl`, +246 `test/test_main.jl`)
- Fixed: #14 (nested-for `#temp#`), #32 (named-tuple field names), #93 (`(; a) = b`), #69, #70, `let` incl.
  `let a = b, b = a, c = b`, generators/comprehensions (nested, filters), renaming locally bound callables.
- thofma tried JuliaLowering in 2024 and found it "not in a state to be used here".
- Not covered: non-special-cased forms; `global` in body; soft/hard scope differences; `@isdefined` (#119, wontfix);
  varargs + kwargs (#135); all control-flow problems. #104 (`@NamedTuple`) passes on current master.
- PR #92 (Krastanov, closed): "undo `_fsmi.` inside `let`" — called "too limited and ad-hoc".

## 4. JuliaLowering.jl
Status: canonical copy is `JuliaLang/julia` master `JuliaLowering/` (v1.0.0-DEV, JuliaSyntax path source); standalone repo
frozen at `65ecb79` since 2025-11 pinning JuliaSyntax `99e975a7`. Not registered. In 1.13.1 `Core._lower` is still flisp
but passes can be called directly. `Pkg.develop(path=standalone)` + `using JuliaLowering` works on 1.13.1 (~100 s first
precompile). A hard dependency can't be released in General — options: weak-dep extension, vendoring, or wait for Base.

| Stage | Function | What it gives the state machine |
|---|---|---|
| 0 | `expr_to_syntaxtree(expr, lnn)` | tree with stable node `_id`s |
| 1 | `expand_forms_1(mod, st, true, world)` | macro expansion with hygiene via scope layers; `Expr`-macro compat |
| 2 | `expand_forms_2` | desugaring: `for` → `iterate`, destructuring, kwarg functions, `scope_block` |
| 3 | `resolve_scopes` | identifiers → `BindingId`; `ctx.bindings.info[id]` has name, kind, `is_internal`, `is_captured` |
| 4 | `convert_closures` | closures → structs (`eval_closure_type`); captured+mutated → `Core.Box` |
| 5 | `linearize_ir` | flat IR: slots, SSA, `goto`/`gotoifnot`, `enter`/`leave`/`pop_exception`, `finally_tag` slot |
| 6 | `to_lowered_expr` / `to_code_info` | `CodeInfo` with debuginfo |

Observations: (1) in `x = 0; let x = x + 1; y = x; end; x` the outer and let-bound `x` get different bindings; RHS `x`
resolves to the outer; a closure marks outer `x` captured. (2) For every stage-3 `BindingId` node,
`flattened_provenance(node)` ends at exactly one stage-0 `Identifier` (same id/name) — Phase A depends on this.
(3) Internal temporaries (`next`, `state`, `collection`, `tmp`, `rhs_tmp`, `#self#`) have `is_internal = true`.
(4) Try regions are `%k = enter #catch`, `leave %k`, `pop_exception %k`; a `for` loop's collection and iteration state
are SSA values, not slots. (5) A placeholder call like `M.__yield__(v)` survives as an ordinary IR call; `@yield` itself
must be replaced before stage 1 or its error stub fires.

## 5. Mapping onto the transform
**Phase A** (replaces `scoping()` + `transform_remove_local`): swap `@yield`/`@yieldfrom`/`@nosave` for markers; wrap the
body in the full original signature (where-params, kwargs, callable-struct form); run stage 0 + stages 1–3 in
`__module__` with compat mode; for each non-internal `:local` binding follow provenance to the input node and record
node → unique symbol; rename in the stage-0 tree and convert back with `Expr(::SyntaxTree)`; then existing `for`/
`yieldfrom` passes (or ignore-list their synthesized names); everything after unchanged; fall back to old `scoping()` if
JuliaLowering is absent or throws `LoweringError`. Phase A does not fix §6 control-flow/Box failures.

**Phase B** (IR-to-IR state machine, as C#/Python compile generators):
1. Lower the marker-substituted function with its original signature through stage 5 (handles varargs/kwargs → #135,
   #169, #170).
2. Each marker call = suspension point k.
3. Liveness: slots and SSA values live across k become fields; spill before suspend, reload on resume; values not live
   across a yield stay locals.
4. Suspend inside regions R1⊃…⊃Rm: spill, `_state = k`, `leave` all m tokens without running `finally`, `return v`.
5. Resume by re-entering regions: entry dispatch jumps to R1's `enter`; after each `enter` a second dispatch on `_state`
   jumps to the next inner `enter`, finally to resume label k; each region gets a fresh handler; every `leave`/
   `pop_exception` refers to its dominating `enter`; state 0 falls through.
6. Resume prologue: reload values, `_state = 0xff`; if the sent argument is an Exception throw it inside the re-entered
   regions, else it becomes the value of `@yield`.
7. `finally`: lowering's `finally_tag` slot is just another live value; user `return`/`break`/`continue` keep semantics.
8. Closures: captured+mutated binding is a `Core.Box` in a slot — store the box itself so machine and closure share it
   (fixes #134 by construction).
9. Field types: infer a copy of the same IR with markers → `Base.inferencebarrier`; read slot/SSA types, `widenconst` as
   `_generate_fsmi` does.
10. Install the step method: (a) macro returns top-level `Expr(:method, …, CodeInfo)` (verify flisp passes it through
    from a macro) or (b) a generated function returning prebuilt `CodeInfo` (existing `FSMIGenerator` /
    `Expr(:meta, :generated, …)` precedent). Keep `Base.@__doc__`.
11. Then deletable: `transform_for/try/slots/arg/exc/yield/remove_local`, `ScopeTracker`, most of `get_slots`;
    `@yieldfrom` stays a source-level desugaring.

## 6. Edge cases (master 6026808, Julia 1.13.1; top-level `@resumable` + `collect`)

| Case | Current | Fixed by |
|---|---|---|
| `@yield` in `if` inside `try`, then error → yielding `catch` | FAIL `syntax: Attempt to jump into catch block` | Phase B |
| `@yield` in inner `catch` of nested `try` | FAIL same | Phase B |
| `for` with `try … finally`, `continue`, `@yield` | FAIL `goto from a try/finally block is not permitted` | Phase B |
| closure `() -> x`, `x` reassigned after yield (#134) | FAIL `Cannot convert Int64 to Core.Box` | Phase B |
| `f(xs...; k=1)` (#135) | FAIL `invalid "..." on non-final argument` | Phase B or `forward_args` fix |
| `let x = i` shadowing in loop | OK `[1, 2, 10]` | regression test |
| `@NamedTuple` in body (#104) | OK | regression test; #104 likely closable |
| `while` + `break` + `@yield` | OK | regression test |

Further cases: throwing into a generator suspended inside `try`; `finally` on user `return` after resume; `catch e` live
across a later yield; `rethrow()` after resume; `let i` without assignment; `let` in comprehension; closures created
before/called after yield, mutating captured var, returned as yielded value, do-blocks; multi-iterator `for`;
`break`/`continue` around yields; user `@goto`/`@label` vs generated labels; yield in `while` condition; #169
(`Vararg{T,N}`), #170 (parametric varargs, zero args), defaults, kwarg splatting, callable structs/self-referencing
functionals (#90), `where` params, `length=`; `@inferred` on `test_performance.jl`/`test_inference_recursive_calls.jl`
cases, field count must not grow, `Union{}` widens to `Any`; logging metadata (#165), `@yield` from a user macro (#55),
`@isdefined` (#119), `@nosave`, `@yieldfrom` of resumable/plain iterators; `test_globals.jl`; JET (#159), coverage (#46),
ExplicitImports/Aqua (weak-dep effects).

## 7. Plan (one commit/PR per step)
1. Agree scope with reviewer (A only vs A+B), dependency mechanism, supported Julia versions.
2. Regression tests first: `test/test_lowering_edgecases.jl` via `@doset`; passing rows `@test`, failing `@test_broken`.
3. Dependency wiring: extension with a narrow internal interface ("rename map for a function Expr", later "lowered IR"),
   inert when absent.
4. Phase A: markers, stages 1–3, provenance map, rename, convert back; replace `scoping()` with fallback; run main,
   repeated_variable, globals, logging, typeparams on both paths.
5. Phase A docs: `docs/src/manual.md`, comment block in `src/utils.jl`, CHANGELOG.
6. Phase B part 1 (bodies without try regions): liveness, spilling, dispatch, suspend/resume, send protocol, method
   install; fall back for bodies with try regions. Turns closure/varargs/loop rows green.
7. Phase B part 2: try regions (re-entry, suspension inside try/catch/finally); throw-into and `rethrow` tests.
8. Phase B part 3: inference on shared IR, delete obsolete passes (with agreement), re-run performance/inference/JET/coverage.
9. Docs + internals page; benchmarks via the repo's existing benchmark CI.

## 8. Open questions / risks
- Distribution: frozen standalone vs monorepo master; which commit to pin; whether an extension needing
  `Pkg.add(url=…)` is acceptable.
- Versions: JuliaLowering `CodeInfo` construction needs ≥1.12-DEV (`_CodeInfo_need_ver`); keep old path on 1.10/1.11.
- Macro-expansion cost: lowering runs once per definition; ~100 s first precompile — measure.
- `eval_closure_type` during macro expansion, under precompilation and Revise — check early.
- Hygiene: Phase A returns renamed `Expr` (no change); Phase B emits non-`Expr` code — check `@macroexpand` users and JET.

## 9. Focused validation
`julia --project -e 'using Pkg; Pkg.test(test_args=["main"])'`, then as touched: `"repeated_variable"`, `"globals"`,
`"typeparams"`, `"yieldfrom"`, `"logging"`, `"selfreferencing_functional"`, `"inference_recursive_calls"`,
`"performance"`, plus the new file. `"jet"` only on release Julia ≥1.12; `"aqua"`/`"explicitimports"` after dep changes.
