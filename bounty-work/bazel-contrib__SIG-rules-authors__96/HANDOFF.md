# HANDOFF · bazel-contrib/SIG-rules-authors#96 → bazel-contrib/bazel-gazelle#938 · Open Collective $1,000

Status: **HANDOFF, ready for submission**

| | |
|---|---|
| Bounty issue | https://github.com/bazel-contrib/SIG-rules-authors/issues/96 (label `bounty-1000USD`, open, no assignee, no linked PRs) |
| Implementation issue | https://github.com/bazel-contrib/bazel-gazelle/issues/938 "Binary plugin API" (open since 2020-10, no assignee, no linked PRs) |
| Platform | Open Collective, Bazel Rules Authors SIG: https://opencollective.com/bazel-rules-authors-sig |
| Amount | $1,000 USD |
| Target repo / base | `bazel-contrib/bazel-gazelle` `master` @ `a6598082134d0084ca599a65fcfd68afb45c452e` (2026-10-07, "v2/resolve: plumb in walk.Cache to Imports, Find, Resolve (#2469)") |
| Patch | `fix.patch` (1 commit, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`, 28 files, +4359/−2) |
| Design comment for #938 | `DESIGN.md` (ready to paste) |

## Payout evidence (the SIG pays $1,000 bounties)

Open Collective GraphQL (`expenses(account:{slug:"bazel-rules-authors-sig"})`) shows three PAID $1,000.00 bounty expenses:

- 2024-10-24, Xavier Bonaventura: "Bounty for flipping disallow empty glob" (SIG #37). Status PAID.
- 2025-11-24, Markus Hofbauer: "Flip default for --incompatible_strict_action_env with https://github.com/bazelbuild/bazel/pull/26587 to resolve https://github.com/bazel-contrib/SIG-rules-authors/issues/42". Status PAID.
- 2026-02-25, Markus Hofbauer: "Flip default for --incompatible_no_implicit_file_export with https://github.com/bazelbuild/bazel/pull/27674 to resolve https://github.com/bazel-contrib/SIG-rules-authors/issues/41". Status PAID.

The SIG README says the SIG accepts money through https://opencollective.com/bazel-rules-authors-sig. Bounties are paid as OC expenses that cite the merged PR and the SIG issue.

## Issue summary

#938 (alexeagle, 2020) asks for a plugin API where Gazelle runs a language extension as a subprocess, so extensions can be written in any language (for example, Node for the TypeScript compiler API, or Python). The original prototype mirrored the Go API in protobuf over stdio. jayconrod raised a concern about the cost of keeping a second API in sync. The SIG put a $1,000 bounty on it on 2024-04-16 (#96).

## What was built

There is no root cause here because this is a feature. The implementation targets Gazelle's new **v2 extension interfaces**, which jayconrod is actively migrating to (`v2/language`, `v2/config`, `v2/resolve`).

- **Protocol** (`v2/plugin/protocol`): JSON-RPC 2.0 over JSON Lines on stdin/stdout. The schema is Go structs with lowerCamelCase JSON names (the proto3 JSON mapping). Methods are `initialize` (name, kinds with `loadedFrom`, known directives, capabilities), `configure`, `fix`, `generate`, `imports`, `resolve`, `find`, `onResolve`, `onFinish`, and `shutdown`. There is also a plugin-to-Gazelle `index/find` callback during resolve/find, which applies `gazelle:resolve` overrides, then the index, then finders, and returns `relLabel` and `selfImport`.
- **Client adapter** (`v2/plugin`, `Language`): implements every v2 interface. Per-directory config is an opaque JSON value stored in `Config.Exts`, so plugins are stateless. Attribute values that fit JSON go in `attrs`, and `select()`/`glob()` and other expressions go in `attrExprs` as Starlark source. Errors carry severities. A crash produces one critical error with the exit status, and Gazelle exits without writing files.
- **Loader** (`v2/plugin`, `Loader`): the repeatable `-plugin=path` flag (resolved through runfiles, then cwd, then workspace dir, then PATH, with runfiles env forwarded) and the `# gazelle:plugin path [args]` directive, which is only allowed in the root build file. It is wired into `update.Run` right after flag parsing, so the default binary and every `gazelle_binary` support plugins.
- **Go SDK** (`v2/plugin/server`): `server.Main(p)`, optional interfaces, and `server.IndexFind`.
- **Reference plugin** (`v2/plugin/examples/sh`): a shell plugin (`sh_library`/`sh_binary`/`sh_test` from rules_shell, deps from `source` lines, `# gazelle:sh_enabled` directive). It exists in **Python with the stdlib only** (`sh_plugin.py`) and in **Go** (`sh.go` + `cmd/sh_plugin`), and the tests require identical output from both.
- **Docs**: `v2/plugin/README.md` (user and author guide, transcript, method table), a `-plugin` flag and `gazelle:plugin` directive in `gazelle-reference.md`, and a "Plugins in other languages" section in `extend.md`.
- **Build metadata**: BUILD files for the new packages (generated with Gazelle's own go + test_filegroup extensions, matching the `//:gazelle_local` set), `//v2:all_files`, the `update` deps, and a regenerated `internal/go_repository_tools_srcs.bzl` (`go run internal/list_repository_tools_srcs.go -check` passes).

## Files changed

```
extend.md                                       |  23 +
gazelle-reference.md                            |   8 +
internal/go_repository_tools_srcs.bzl           |  15 +
v2/BUILD.bazel                                  |   1 +
v2/cmd/gazelle/update/BUILD.bazel               |   1 +
v2/cmd/gazelle/update/update.go                 |  26 +-
v2/plugin/BUILD.bazel                           |  65 +++
v2/plugin/README.md                             | 211 +++++++
v2/plugin/convert.go                            | 362 ++++++++++++
v2/plugin/convert_test.go                       | 212 +++++++
v2/plugin/examples/BUILD.bazel                  |   9 +
v2/plugin/examples/sh/BUILD.bazel               |  26 +
v2/plugin/examples/sh/cmd/BUILD.bazel           |   9 +
v2/plugin/examples/sh/cmd/sh_plugin/BUILD.bazel |  28 +
v2/plugin/examples/sh/cmd/sh_plugin/main.go     |  27 +
v2/plugin/examples/sh/sh.go                     | 287 ++++++++++
v2/plugin/examples/sh/sh_plugin.py (100755)     | 259 +++++++++
v2/plugin/loader.go                             | 244 ++++++++
v2/plugin/loader_test.go                        |  66 +++
v2/plugin/plugin.go                             | 707 ++++++++++++++++++++++++
v2/plugin/plugin_test.go                        | 440 +++++++++++++++
v2/plugin/protocol/BUILD.bazel                  |  29 +
v2/plugin/protocol/jsonrpc.go                   | 241 ++++++++
v2/plugin/protocol/jsonrpc_test.go              | 199 +++++++
v2/plugin/protocol/protocol.go                  | 554 +++++++++++++++++++
v2/plugin/server/BUILD.bazel                    |  27 +
v2/plugin/server/server.go                      | 203 +++++++
v2/plugin/server/server_test.go                 |  82 +++
```

## Validation (focused, new packages and the one modified package only)

The patch was applied with `git am` on a clean worktree of `origin/master` @ a659808, then:

```
$ go test -count=1 ./v2/plugin/... ./v2/cmd/gazelle/update/
ok   github.com/bazel-contrib/bazel-gazelle/v2/plugin            0.250s
?    github.com/bazel-contrib/bazel-gazelle/v2/plugin/examples/sh [no test files]
?    github.com/bazel-contrib/bazel-gazelle/v2/plugin/examples/sh/cmd/sh_plugin [no test files]
ok   github.com/bazel-contrib/bazel-gazelle/v2/plugin/protocol   0.036s
ok   github.com/bazel-contrib/bazel-gazelle/v2/plugin/server     0.013s
ok   github.com/bazel-contrib/bazel-gazelle/v2/cmd/gazelle/update 0.420s
```

Test names (`go test -v ./v2/plugin/...`, all PASS):
TestRuleRoundTrip, TestApplyAttrEditErrors, TestApplyAttrEdit, TestKindFromProtocol, TestFindFlagPlugin, TestGoReferencePlugin, TestResolveOverride, TestPythonReferencePlugin (runs the real `sh_plugin.py` with python3 3.13), TestPluginDirective, TestPluginDirectiveOutsideRoot, TestFixFindLifecycle (two plugins at once: fix renames/deletes rules, one plugin's `find` resolves the other plugin's imports, lifecycle hooks fire in order), TestStartErrors (missing exe, bad protocol version, duplicate name, collision with built-in), TestPluginCrash, TestCallWithCallback, TestCallError, TestCallbackWithoutHandler, TestReadMessage (1 MiB line, no trailing newline), TestReadMessageInvalid, TestWriteMessageOneLine, TestUnmarshalNumbers, TestServe, TestIndexFindOutsideRequest.

Other checks:

```
$ go vet ./v2/plugin/... ./v2/cmd/gazelle/...          → clean
$ gofmt -l v2/plugin v2/cmd/gazelle/update              → clean
$ go run internal/list_repository_tools_srcs.go -dir $PWD -check internal/go_repository_tools_srcs.bzl → OK
```

End-to-end smoke test with the real CLI (`go build ./v2/cmd/gazelle`, `go build ./v2/plugin/examples/sh/cmd/sh_plugin`): `gazelle_v2 -plugin=sh_plugin -r` on a repo with Go and shell code generated `go_library` (built-in Go extension) and `sh_library`/`sh_binary` with `deps = ["//lib:util"]` side by side. `-plugin=sh_plugin.py -lang=sh -mode=diff` printed the same BUILD files.

Perf: 2,000 directories / 4,000 scripts, `gazelle -r`: 1.06s wall with the Go plugin and 1.15s with the Python plugin (~10k round trips).

Not run here: `bazel test` (no Bazel in this container). The BUILD files were generated by Gazelle itself. The only hand edit is the runfiles dep label `@io_bazel_rules_go//go/runfiles`, which matches `cmd/gazelle/BUILD.bazel` and `v2/internal/module/BUILD.bazel`. `//v2/plugin:plugin_test` declares `data = ["//v2/plugin/examples/sh:sh_plugin.py"]`. The Python test skips if `python3` isn't on PATH in the sandbox.

## How to apply

```
git clone https://github.com/bazel-contrib/bazel-gazelle && cd bazel-gazelle
git checkout -b subprocess-plugins a6598082134d0084ca599a65fcfd68afb45c452e   # or current master
git am /path/to/fix.patch
go test ./v2/plugin/... ./v2/cmd/gazelle/update/
```

## Competition

None. #938 and SIG #96 have no linked branches or PRs, and a search of bazel-gazelle PRs for "plugin subprocess" returns 0. Closed related PRs (#1737 "Allow plugins to efficiently reuse Gazelle's filesystem walk", #1846 "new language plugin guide") are not subprocess plugins. Aspect CLI's Starlark plugin system is outside Gazelle and can't run language-native parsers, which is the motivation of #938. There was no Slack fleet TAKE for this target before ours.

## Submission notes (facts)

- bazel-gazelle's CONTRIBUTING requires the Google Individual CLA for the submitting GitHub account (woahwhattheheck).
- Post `DESIGN.md` as a comment on bazel-gazelle#938 linking the PR. The issue asks for design discussion, and jayconrod is the active maintainer of the v2 API.
- After the PR is opened, comment on SIG-rules-authors#96 with the PR link so the SIG can track the bounty.

## Open Collective expense steps (after merge)

1. Sign in or create an Open Collective account for the payee (woahwhattheheck / Bryce).
2. Open https://opencollective.com/bazel-rules-authors-sig/expenses/new.
3. Choose **Invoice** (payment for work done).
4. Description, in the same format as the SIG's prior paid bounties: `Subprocess plugin API for Gazelle with https://github.com/bazel-contrib/bazel-gazelle/pull/<PR#> to resolve https://github.com/bazel-contrib/SIG-rules-authors/issues/96`.
5. Add one line item: "Bounty: SIG-rules-authors#96 Subprocess plugin API for Gazelle", amount **$1,000.00 USD**, with the merged PR URL as the reference.
6. Pick the payout method (PayPal, or bank transfer through Wise), fill in the legal name and address, and submit.
7. Comment on https://github.com/bazel-contrib/SIG-rules-authors/issues/96 with the merged PR and the expense link, and ask the SIG leads (Alex Eagle, Helen Altshuler, Keith Smiley) to approve the payout.

---

## Ready-to-paste PR

**Title:** `v2/plugin: subprocess plugin API for language extensions (JSON-RPC over stdio)`

**Body:**

```markdown
Closes #938

This adds a subprocess plugin API, so Gazelle language extensions can be written in any language. A plugin is an executable that Gazelle starts and talks to with **JSON-RPC 2.0 over stdin/stdout, one JSON message per line**. Plugins take part in a run exactly like extensions compiled into a `gazelle_binary`: their directives are recognized, their rules are generated, merged, and indexed, and their dependencies are resolved against the shared rule index in both directions. `-lang`, `gazelle:lang`, `map_kind`, `gazelle:resolve`, and `# keep` all work unchanged.

Design writeup (also posted on #938): the protocol mirrors the v2 interfaces one-to-one, and the schema is a single file of Go structs (`v2/plugin/protocol`) with proto3-compatible JSON names. That means no codegen or new dependencies in Gazelle, and plugin authors only need a JSON library. This addresses the "second API to maintain" concern raised in #938.

### Usage

    gazelle -plugin=tools/gazelle/my_plugin            # repeatable

    gazelle(
        name = "gazelle",
        data = ["//tools/gazelle:my_plugin"],
        extra_args = ["-plugin=$(rlocationpath //tools/gazelle:my_plugin)"],
    )

    # or, in the root BUILD file:
    # gazelle:plugin tools/gazelle/my_plugin.py

### What's included

- `v2/plugin/protocol`: wire schema and a small JSON-RPC connection. Methods: `initialize` (name, kinds incl. `loadedFrom`, known directives, capabilities), `configure`, `fix`, `generate`, `imports`, `resolve`, `find`, `onResolve`, `onFinish`, `shutdown`, plus an `index/find` callback that plugins use during `resolve`/`find`. The callback applies `gazelle:resolve` overrides, then the index, then finders, and returns `relLabel`/`selfImport`.
- `v2/plugin`: `Language` adapts a plugin process to every v2 interface. Per-directory configuration is an opaque JSON value stored in `Config.Exts`, so plugins are stateless. `select()`/`glob()` values round-trip as Starlark source. Errors carry `v2/errors` severities. A crashed plugin is reported once as a critical error, and Gazelle then exits without writing files. `Loader` implements `-plugin` (resolved through runfiles, cwd, workspace dir, or PATH, with the runfiles env forwarded so Bazel-built plugins work) and the root-only `gazelle:plugin` directive.
- `update.Run` starts plugins right after flag parsing, so the default binary and every `gazelle_binary` support them.
- `v2/plugin/server`: a helper for writing plugins in Go.
- `v2/plugin/examples/sh`: a reference plugin for shell scripts (`rules_shell` kinds, deps from `source` lines), implemented in **Python with the standard library only** and in **Go**. Tests run Gazelle end to end with both and require identical BUILD files.
- Docs: `v2/plugin/README.md` (guide, transcript, method table), plus the `-plugin` flag and `gazelle:plugin` directive in `gazelle-reference.md` and a section in `extend.md`.

### Testing

    go test ./v2/plugin/... ./v2/cmd/gazelle/update/

The tests cover Go and Python reference plugins end to end, the directive registration path and its error outside the root, `gazelle:resolve` overrides through `index/find`, fix/find/lifecycle with two plugins at once (one plugin's `find` resolves the other's imports), startup errors (missing executable, protocol version, name collisions), crash handling, the JSON-RPC transport (callbacks, errors, 1 MiB lines), and attribute round-tripping.

Performance: 2,000 directories / 4,000 scripts take ~1.15s for a full `gazelle -r` with the Python plugin (~10k round trips).

### Bounty

This implements the Rules Authors SIG bounty bazel-contrib/SIG-rules-authors#96 ($1,000). I'm claiming that bounty. Once this is merged, I'll submit the expense to the SIG's Open Collective (https://opencollective.com/bazel-rules-authors-sig) and ask for the $1,000 payout. I'll also link this PR on #96.
```
