# Graphs.jl #448 — very_nauty wrapper: analysis for hand implementation

Bounty: $400, NumFOCUS / QuantumSavory bounty program (paid by invoice). This is an analysis of existing code and
design only, for the implementer to write by hand (the program allows AI for analysis; new contributors must
hand-author code and attend office hours).

## 1. Eligibility and competition
- Rules: QuantumSavory `BUG_BOUNTIES.md` "Usage of AI": new contributors must hand-write code and attend office hours;
  after a first approved PR, AI use must be disclosed (model, prompts, hand fixes, line-by-line read + tested).
- Claim: issue comment or email to skrastanov@umass.edu. Payout: email Krastanov, then upload a PDF invoice
  ("Award: bug bounty - …", billed to "NumFOCUS for the Julia project") + W-9/W-8BEN. Paid bimonthly.
- Competing work:
  - Graphs.jl #507 (mahmudsudo): changes requested 2026-04-22, no update since.
  - Graphs.jl #529 (singhharsh1708): private `function chromatic_number end` / `edge_chromatic_number`, `(g, alg)`
    signature, discloses AI use, unreviewed.
  - Graphs.jl #528 (AJ0070): generic external-algorithm declaration mechanism with MethodError hint.
  - VNGraphs #26: changes requested 2026-04-21 (split up, revert workflow edits). VNGraphs #14
    (GraphsInterfaceChecker) open. VNGraphs #18/#19, #33–#37 closed (#33–#37 on 2026-09-12: "LLM work from new
    contributors is not acceptable for bounties").
- The maintainer's agent already shipped native ccall bindings and VNGraphs v1.1.0 (2026-09).
- Precedence: raise it with Krastanov in the claim comment / office hours (fleet note 2026-09-20).

## 2. Binaries
- `very_nauty_jll` 1.1.2+0 exists for 18 platforms incl. Windows; product `libvn_graph`, ships `include/vn_graph.h`.
- Yggdrasil recipe `V/very_nauty/build_tarballs.jl` builds from a JuliaGraphs/very_nauty GitSource with a single
  `cc -shared vn_graph.c`. No recipe work needed unless the C source changes (then bump commit + version 1.1.3).

## 3. C API
- Layout: `struct _graph{a: node_t**, d: node_t*, b: size_t*, v: char*, c: int*, l: int*, nnodes, nedges}`;
  nodes are 0-based, adjacency lists unsorted.
- Exported: lifecycle (new, clear, empty, complete, add_node, set_adj_list_initial_size); edges (add_edge ignores
  duplicates, append_edge allows multi-edges, has_edge, del_edge); degree helpers; components (nclusters, connected,
  cluster_sizes, max_cluster); coloring (greedy, sequential, sequential_repeat, chromatic_number,
  chromatic_number_special, edge_chromatic_number, ncolors, check_coloring); clique_number; line_graph,
  local_complement; random generators gnp/gnm/grg (+ torus/lognormal); callback iterators; I/O + histogram helpers.
- Not bound by VNGraphs today: complete, set_adj_list_initial_size, append_edge, greedy/sequential color,
  chromatic_number_special, line_graph, iterators, most I/O.

Edge cases:
1. Timeout is user-CPU seconds, 0 = none, timeout returns -1 (trick.c:235–238, vn_graph.c:1576); `clock_t` width varies.
2. No edges: `chromatic_number` returns 1 whenever there are no edges, including nnodes=0 (correct answer 0).
   `edge_chromatic_number` returns 0/1. `nclusters(empty)` = 0.
3. Self-loops corrupt degree counts and the complete-graph shortcut (vn_graph.c:181, 1500) — reject them.
4. Global state (`cg`, `clqdata`, `adj_list_initial_size`, libc `rand()`) → not thread-safe; use one process-wide lock.
5. `exit(2)` / `exit(1)` paths (vn_graph.c:1556, 323) and unchecked mallocs cannot be caught from Julia.
6. Stack VLAs in line_graph (edge-chromatic path), local_complement, max_cluster can overflow on large inputs.
7. `nclusters` overwrites colour/cluster arrays (`c`, `l`) — read colourings under the lock right after colouring.
8. `rand()` cannot be seeded from Julia.
9. Ownership: line graph must be freed with `graph_clear`; `cluster_sizes` buffer with `Libc.free` (VNGraphs leaks it).

## 4. VNGraphs master gaps (fe263b3)
- Bug: `has_edge` passes 1-based ids to the 0-based C call, returns `Cint` not `Bool`, no bounds check;
  `add_edge!` subtracts 1 — inconsistent.
- Missing: edges, in/outneighbors, rem_edge!, add_vertex!, copy, ==, show.
- Supertype: `AbstractSimpleGraph` generics assume a `fadjlist` field (SimpleGraphs.jl:125–158). Either implement
  `fadj`/`badj` views or switch to `AbstractGraph{Cuint}` — ask the maintainer.
- Conversions go edge-by-edge (slow).

## 5. Graphs.jl pattern
- Master (v1.15.0) has no external-algorithm mechanism.
- Existing functions VNGraphs can add methods to with its own algorithm types: `clique_number` (cliques.jl:183),
  `connected_components`, `is_connected`, `greedy_color` (returns `Coloring`).
- Krastanov's guidance on #507: generic declarations fitting `greedy_color`/`Coloring`; private, bare
  `function f end`; `f(g, ::Algorithm)` with timeout as an algorithm field; Documenter note, no untested examples;
  CHANGELOG wording "declared private functions without any methods"; mind invalidations; error hints in `__init__`.
- Don't open a third declaration PR; let him choose #529 or #528.

## 6. Design (separate PRs)
1. Correctness: fix `has_edge`, fix `cluster_sizes` leak, add global lock, reject loops/directed graphs.
2. Full AbstractGraph interface (supertype per §4).
3. GraphsInterfaceChecker tests (build on VNGraphs #14).
4. Fast conversions: build each `fadjlist` directly from `d`/`a` (+1, sort); optionally pre-size with
   `set_adj_list_initial_size` and restore under the lock; optional read-only zero-copy view.
5. Algorithm dispatch: `VNAlgorithm(; timeout)` types with methods for `chromatic_number`/`edge_chromatic_number`
   (once declared), `clique_number(g, alg)`, optionally `greedy_color` → `Coloring`. Special-case nv=0; map -1 to a
   documented timeout error or `nothing` (maintainer's choice).
6. Docs + CHANGELOG, keep the existing docs CI job.

## 7. Test plan
- Interface checker on empty, single-vertex, path, Petersen, disconnected graph.
- Round-trips on random and empty graphs, including after mutation.
- Known values:

  | Graph | χ | χ' |
  |---|---|---|
  | K_n | n | n−1 (n even) / n (n odd) |
  | odd cycle | 3 | 3 |
  | even cycle | 2 | 2 |
  | Petersen | 3 | 4 |
  | K_{m,n} | 2 | max(m, n) |
  | star | 2 | degree |
  | wheel W_n | 3 / 4 by parity | — |

  ω agrees with `Graphs.clique_number`; component counts agree with Graphs.jl.
- Brute-force χ for nv ≤ 7 plus `check_coloring` on results.
- Edge cases: nv=0, one vertex, one edge, self-loop / directed input (ArgumentError), duplicate edges, out-of-range
  `has_edge`, negative timeout.
- Timeout on a hard instance (tolerant of fast machines). GC/leak loop. Threads: concurrent calls match serial.
- Aqua and JET (`JET_TEST=true`).

## 8. Order of work
1. Get precedence + scope from Krastanov; book office hours.
2. PR 1 → 2 and 3 → 4, 5, 6 with clean commits and CHANGELOG entries.

Sources: Graphs.jl dffc7a64 + PR heads #507/#529/#533; VNGraphs.jl fe263b3; very_nauty d6d28d3; very_nauty_jll
03581b8 (`nm -D` on linux artifact); Yggdrasil V/very_nauty; GraphsInterfaceChecker 29c0096; BUG_BOUNTIES.md;
GitHub pages read 2026-10-08.
