# Design: subprocess plugin API for Gazelle (bazel-gazelle#938)

_Ready to paste as a comment on https://github.com/bazel-contrib/bazel-gazelle/issues/938. An implementation of this design, with tests, is in the linked PR._

## Summary

Gazelle runs a language plugin, an executable written in any language, as a subprocess and talks to it with **JSON-RPC 2.0 over stdin/stdout, one JSON message per line**. The methods mirror the v2 extension interfaces (`v2/language`, `v2/config`, `v2/resolve`) one-to-one. Users register plugins with a repeatable `-plugin` flag or a `# gazelle:plugin` directive in the root build file. They don't need a custom `gazelle_binary`. Plugins then take part in a run like compiled-in extensions: their directives are recognized, their rules are merged and indexed, and their dependencies are resolved against the same rule index as Go and proto, in both directions. `-lang`, `gazelle:lang`, `map_kind`, `resolve`/`resolve_regexp` and `# keep` all work unchanged.

This builds on the original prototype by @alexeagle and @achew22 (the protobuf-over-stdio "rosetta" language). It also tries to answer @jayconrod's concern in the issue: maintaining a second copy of the plugin API should cost as little as possible.

## Goals

- Plugins in any language (Node for the TypeScript compiler API, Python for `ast`, Rust, Java, and so on), with no dependency beyond a JSON library.
- Full coverage of the extension API: Configure, KnownDirectives, Kinds (with load info), Generate, Fix, Imports (indexing), Resolve with index lookups, Find (cross-resolve), and lifecycle hooks.
- No codegen or new toolchain in Gazelle's build, and no new Go module dependencies.
- Works with `bazel run //:gazelle`, using plugins built by Bazel (`py_binary`, `js_binary`, `go_binary`).
- Tolerates version skew between plugin and Gazelle.

Non-goals for v1: running plugin requests in parallel, persistent plugin daemons across runs, and sandboxing.

## Transport: JSON-RPC 2.0 over JSON Lines (why not protobuf or gRPC)

| | JSON-RPC / JSON Lines (chosen) | protobuf over stdio (prototype) | gRPC |
|---|---|---|---|
| Plugin author deps | none (every language has JSON) | protoc + codegen per plugin language | gRPC stack, ports/sockets |
| Gazelle build | stdlib only | `.proto` + generated `.pb.go` kept in sync | heavy deps |
| Bidirectional calls (resolve needs the index) | natural (ids, as in LSP/MCP) | needs a custom envelope | yes |
| Debuggability | `cat` the stream | binary | binary |
| Schema evolution | unknown fields ignored | yes | yes |

The **schema is the Go structs in `v2/plugin/protocol`**, which is a single file of documented types. Field names are lowerCamelCase, which is exactly the proto3 JSON mapping. If maintainers later want a `.proto`, they can add one that describes the same wire format without breaking any plugin. Bazel persistent workers made the same choice when they added a JSON mode next to protobuf.

Framing: each message is one line of UTF-8 JSON. JSON encoders escape newlines inside strings, so no length headers are needed. The plugin's stderr is passed through to the user.

## Lifecycle and methods

```
gazelle                                   plugin
   | initialize {protocolVersion, repoRoot, repoName, flags...} ->
   |   <- {protocolVersion, name, kinds[], knownDirectives[], capabilities}
   | (walk, parents first)
   | configure {config: parentValue, rel, file} -> <- {config: newValue}
   | fix {config, rel, file, shouldFix} -> <- {edits[]}            (if caps.fix)
   | generate {config, dir, rel, file, subdirs, regularFiles, genFiles, otherGen, otherEmpty}
   |   <- {gen[], empty[], imports[] (opaque per rule), relsToIndex[]}
   | imports {config, rel, rule} -> <- {imports[{lang,imp}], embeds[], notImportable}
   | onResolve -> <- {}                                            (if caps.lifecycle)
   | resolve {config, rel, rule, from, imports} ->
   |   <- index/find {import:{lang,imp}, lang}      (plugin -> gazelle, 0..n times)
   |   -> {results[{label, relLabel, selfImport, embeds}]}
   |   <- {attrs, attrExprs, deleteAttrs}
   | find {config, import, lang} -> <- {results[]}                 (if caps.find)
   | onFinish -> <- {}                                             (if caps.lifecycle)
   | shutdown -> <- {} ; close stdin ; wait (kill after 5s)
```

Requests are strictly sequential. Gazelle's walk is already single-threaded, so the protocol never has more than one request in flight in each direction. The only plugin-to-Gazelle request is `index/find`, and only while the plugin is handling `resolve` or `find`.

| Go API (v2) | Protocol |
|---|---|
| `Language.Name` | `initialize` → `name` |
| `Generator.Kinds` (incl. `LoadedFrom`) | `initialize` → `kinds` |
| `Configurer.KnownDirectives` | `initialize` → `knownDirectives` |
| `Configurer.Configure` | `configure` |
| `Fixer.Fix` | `fix` (edits by rule index: rename kind/name, set/delete attrs, delete rule) |
| `Generator.Generate` | `generate` |
| `Indexer.Imports` | `imports` |
| `Resolver.Resolve` + `RuleIndex.Find` | `resolve` + `index/find` callback |
| `Finder.Find` | `find` |
| `OnResolver` / `OnFinisher` | `onResolve` / `onFinish` |

### Configuration without shared memory

In Go, `Configure` mutates `Config.Exts`. Over a process boundary, each plugin instead returns **an opaque JSON value per directory**. Gazelle stores it in `Config.Exts["plugin:<name>"]`, so it's inherited by subdirectories through `Config.Clone`. Gazelle sends it back with every later request for that directory and as the parent value when configuring children. Plugins therefore keep no per-directory state, and ordering bugs can't happen. `capabilities.configure` (`all` | `buildFiles` | `directives` | `none`) lets a plugin skip the round trip for directories it doesn't care about. The reference plugin uses `directives`, so it's only called where its own directive appears.

### Rules and values

A rule is `{kind, name, attrs, attrExprs, keep}`. JSON-representable values (strings, bools, ints, lists, string-keyed dicts) go in `attrs`. Anything else (`select()`, `glob()`, calls) goes in `attrExprs` as Starlark source, which Gazelle parses with buildtools. Existing rules are sent the same way, so a plugin can see and preserve `select()`s. Numbers are decoded exactly (`json.Number`), so large ints don't lose precision.

### Resolution

`index/find` resolves an import the same way built-in extensions do: first `gazelle:resolve` / `gazelle:resolve_regexp` overrides, then the rule index, then extensions implementing `Finder`. During `resolve`, each match also carries `relLabel` (already relativized to the rule being resolved) and `selfImport` (`FindResult.IsSelfImport`). The plugin doesn't need to reimplement label logic. A plugin's own `find` is not re-entered while that plugin is waiting on its own `index/find`, which would deadlock a single-threaded plugin.

### Errors

A request either fails (a JSON-RPC error, optionally with `data.severity`) or succeeds with an `errors: [{message, severity}]` list. Severities map to `v2/errors` (`warning`, `error`, `critical`), so `-strict` behaves as it does for built-in extensions. If the plugin crashes or writes a non-protocol line, Gazelle kills it, reports one critical error with the exit status, and exits without writing build files.

### Versioning

`initialize` negotiates an integer `protocolVersion` (Gazelle sends its maximum, and the plugin answers with the version it speaks). New optional fields can be added without bumping the version, because both sides must ignore unknown fields. Optional features are negotiated with `capabilities`.

## Registration (the loader)

- **Flag**: `-plugin=path` (repeatable). Relative paths are resolved through Bazel runfiles (`$(rlocationpath ...)`), then the current directory (`$(rootpath ...)` under `bazel run`), then the workspace directory, then `PATH`. Gazelle forwards its runfiles env vars, so Bazel-built plugins find their runfiles.
- **Directive**: `# gazelle:plugin path [args...]`, only in the root build file (Gazelle reports an error elsewhere). The path is relative to the repo root.
- **Bazel**:

```starlark
gazelle(
    name = "gazelle",
    data = ["//tools/gazelle:ts_plugin"],
    extra_args = ["-plugin=$(rlocationpath //tools/gazelle:ts_plugin)"],
)
```

Plugins are started in `update.Run` right after flag parsing, before kinds and loads are computed and before the walk. They are appended to the extension list as `compat.CompleteLanguage`s. Because both the default binary and every `gazelle_binary` share `update.Run`, both support plugins. Name collisions with built-in extensions or other plugins are errors.

## Performance

On 2,000 directories with 4,000 shell scripts (every script sources two others), a full `gazelle -r` with the **Python** reference plugin takes ~1.15s wall time, and ~1.06s with the Go version of the same plugin. That is about 10k round trips. Per-directory `configure` round trips are opt-in through `capabilities.configure`.

## Developer experience

- `v2/plugin/README.md`: user and author guide, full message transcript, and method table.
- `v2/plugin/server`: a small Go helper (`server.Main(p)`, optional interfaces, `server.IndexFind(ctx, ...)`).
- Reference plugin for shell scripts (`sh_library`/`sh_binary`/`sh_test` from `rules_shell`, deps from `source` lines). It is written twice, once in **Python with the standard library only** (`examples/sh/sh_plugin.py`) and once in **Go** (`examples/sh/sh.go`). The tests run Gazelle end to end with both and require identical output.

## Follow-ups (not needed for v1)

1. Starlark sugar: a `plugins` attribute on `gazelle()` that adds the `data` and `-plugin` args.
2. Optional parallelism: allow multiple in-flight `generate` requests. The ids are already there.
3. List plugins in `gazelle -version`.
4. Optional `.proto` mirror of `v2/plugin/protocol` for plugin authors who prefer protobuf codegen, with the same JSON wire format.
5. SDKs for TypeScript and Python on top of the transport (the reference plugin's `Conn` class is ~40 lines).
