# HANDOFF · gogs/gogs#1929 (existing PR gogs/gogs#8421) · IssueHunt $20

Status: **HANDOFF** (help_request: validation + fixes on top of the existing original-author PR; no new PR)

- Issue: https://github.com/gogs/gogs/issues/1929 ("Allow public download/clone via git://"), OPEN, labels feature + help wanted, no assignee
- Bounty: https://oss.issuehunt.io/r/gogs/gogs/issues/1929 (IssueHunt, depositAmount 2000 cents = **$20**, status ready)
- Carrier PR: https://github.com/gogs/gogs/pull/8421 by @woahwhattheheck, branch `woahwhattheheck:feat-git-protocol-server-1929`, OPEN, non-draft, review requested from @unknwon (code owner)
- Payout evidence: IssueHunt repo rewardedAmount is 0, so there is no payout history in either direction (no merged-but-unpaid issues found). Maintainer is active (Go 1.27 upgrade #8415 and #8416 merged recently).
- Base for this patch: carrier PR head `2c3ce8c8c64f9b857ebfa6e345c2a6dfc069a1fe` (its merge-base with upstream `main` is `dbbd717e923694c36f41b0360515b4374bbe6ee0`, the current `main` tip, so the PR is up to date with main)
- Result head after applying locally: `986c4c6eb0335ad72bc90fa40adbf8778d8c0cda` (2 commits, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`)
- **Live PR head now: `5f1cd49535370197b78eb46b482f2c97ce7ed723`**. The patch content is already on #8421 (see below).

## Current state (reviewer re-check, 2026-10-08)

- A fleet publisher fast-forwarded the PR branch `feat-git-protocol-server-1929` from `2c3ce8c8` to `8a580253` (`fix(gitdaemon): canonicalize wiki request paths and enforce wiki access policy`) and then to `5f1cd495` (`test(gitdaemon): cover canonical wiki paths and formatter alignment`). Both commits are authored as `woahwhattheheck`, with the same email as the earlier PR commits.
- The tree of `5f1cd495` is `f85318dc80f02106c47562ee13fc0f08b7661534`. This is byte-identical to the tree produced by `git am --3way fix.patch` on `2c3ce8c8` (blobs `gitdaemon.go` `f7a395f6`, `gitdaemon_test.go` `4e5ddf9a`). **Nothing in fix.patch remains to push.** fix.patch is kept as the record of the change.
- The PR is 12 commits on top of `main@dbbd717e` (the current `main` tip). The full PR diff applies cleanly to `main` (7 files, +658).
- Focused validation re-run at `5f1cd495` with Go 1.27.1 (output in the Validation section): gofmt (1.27.1 binary), go vet, go test on gitdaemon+conf, and -race -shuffle on gitdaemon all pass.
- Wiki-gate probe at `5f1cd495`: 22 crafted request paths were sent through `parseRequest`, then through a real `git upload-pack --advertise-refs` in a root that holds `alice/repo.git` and `alice/repo.wiki.git`. Every path Git resolves to the wiki is flagged `wiki=true`. These include `/alice/repo.wiki`, `alice/repo.wiki` (no leading slash), `/ALICE/REPO.WIKI`, a Kelvin-sign `K` variant and a trailing tab. Traversal, `./`, `//` and trailing-slash forms are rejected. `*.wiki` is a reserved repository-name pattern in `internal/database/repo.go`, so the single `.wiki` suffix split cannot shadow a real repository. Owner and repository lookups match on `lower_name`, which is consistent with the lowercased canonical path.
- The live PR body has **no `Closes #1929` line**. It still cites head `71b6bb35` and says no Go toolchain was available. Its existing "Current-head delivery and IssueHunt compensation" section asks for the $20. The ready-to-paste sections below fix the head and validation text and add `Closes #1929`.
- PR checks page: `Go` and `Shell` `pull_request` runs are listed as "completed with no jobs". Workflow runs for an outside contributor usually need maintainer approval.

## What was done

The PR's Go code had not been compiled or tested by any seat, and the last commit (`2c3ce8c8`, `[skip ci]`) kept CI from running. I ran it with Go 1.27.1 (`GOTOOLCHAIN=go1.27.1`, because go.mod requires go 1.27.0 and the local toolchain is 1.24.7).

Findings at `2c3ce8c8`:

| Check | Result at 2c3ce8c8 |
|---|---|
| `go vet ./internal/gitdaemon/ ./internal/conf/ ./cmd/gogs/internal/web/` | pass |
| `go test -count=1 ./internal/gitdaemon/ ./internal/conf/` | pass (incl. `TestInit`) |
| `gofmt -l` on the touched Go files | **fails**: `internal/gitdaemon/gitdaemon.go` and `internal/gitdaemon/gitdaemon_test.go` |
| Wiki access gate (code review + `git upload-pack` probe) | **bypass**: `git://host/<owner>/<repo>.wiki` serves the wiki even when it is disabled or external |

`TestInit` does not need a golden update. `TestInitHelper` reflects only `App`, `Server`, `SSH`, etc. into the rendered ini, and the PR keeps the new keys in a separate `conf.GitProtocol` struct, so `internal/conf/testdata/TestInit.golden.ini` is unchanged and still matches.

### Commit 1: `style(gitdaemon): gofmt struct literal alignment (#1929)`
The "gofmt" commit `2c3ce8c8` left the `request{...}` literal in `parseRequest` and the `TestParseRequest` table misaligned after `gitProtocol`/`expProtocol` were added. `.golangci.yml` enables the `gofmt` formatter, so the golangci-lint job in `.github/workflows/go.yml` would fail on both files. This commit is pure `gofmt -w` output.

### Commit 2: `fix(gitdaemon): pass a canonical repository path to Git (#1929)`
- **Root cause:** `parseRequest` handed the client-supplied path straight to `git upload-pack`. Meanwhile `handleConn` decided whether the request targets a wiki with `strings.HasSuffix(req.path, ".wiki.git")`. When a request omits the `.git` suffix (`/alice/repo.wiki`), the parsed path is `alice/repo.wiki`, so the wiki check is false. `git upload-pack alice/repo.wiki` then resolves to `alice/repo.wiki.git` by itself (non-strict `enter_repo` suffix search). As a result, the wiki of any public repository could be cloned anonymously even with the wiki disabled or set to an external wiki, which is exactly what PR commit `e6131a52` set out to block.
- **Reproduced:**
  - Before the fix (worktree at `7e4a1883`), a probe test printed `parseRequest("git-upload-pack /alice/repo.wiki\x00host=example.com\x00")` → `path="alice/repo.wiki" repo="repo" wikiGate=false`.
  - `git upload-pack --advertise-refs alice/repo.wiki`, run in a root that contains only `alice/repo.wiki.git`, advertised that wiki's refs (`...HEAD multi_ack thin-pack side-band ...`).
- **Change:**
  - `parseRequest` lowercases the path first.
  - It strips `.git`, then strips `.wiki` with `strings.CutSuffix` and records the result in a new `request.wiki` field. It validates the remaining names, which now also rejects an empty name such as `/alice/.wiki.git`.
  - It builds the path given to Git from the validated names: `<owner>/<repo>.git` or `<owner>/<repo>.wiki.git`.
  - `handleConn` passes `req.wiki` to `canServeAnonymousGit` instead of re-deriving it from the path.
- **Tests:** in `TestParseRequest`, added an `expWiki` assertion and new cases for `wiki repository without .git suffix` (the bypass), `mixed-case wiki repository` and `empty wiki repository name`. `path without .git suffix` now expects the canonical `alice/repo.git`.

Files changed by the patch: `internal/gitdaemon/gitdaemon.go`, `internal/gitdaemon/gitdaemon_test.go` (2 files, +65/-27).

## Validation (focused only; exact commands and output at 986c4c6e)

```
$ export GOTOOLCHAIN=go1.27.1
$ go version
go version go1.27.1 linux/amd64
$ gofmt -l internal/gitdaemon/ internal/conf/conf.go internal/conf/static.go cmd/gogs/internal/web/web.go
(no output, exit 0)
$ go vet ./internal/gitdaemon/ ./internal/conf/ ./cmd/gogs/internal/web/
(no output, exit 0)
$ go test -count=1 ./internal/gitdaemon/ ./internal/conf/
ok  	gogs.io/gogs/internal/gitdaemon	0.018s
ok  	gogs.io/gogs/internal/conf	0.092s
$ go test -count=1 -race -shuffle=on ./internal/gitdaemon/
ok  	gogs.io/gogs/internal/gitdaemon	1.172s
$ go test -count=1 -v -run TestParseRequest ./internal/gitdaemon/ | grep -E -- '--- (PASS|FAIL)' | grep -i 'wiki\|suffix\|TestParseRequest '
--- PASS: TestParseRequest (0.00s)
    --- PASS: TestParseRequest/wiki_repository (0.00s)
    --- PASS: TestParseRequest/wiki_repository_without_.git_suffix (0.00s)
    --- PASS: TestParseRequest/mixed-case_wiki_repository (0.00s)
    --- PASS: TestParseRequest/path_without_.git_suffix (0.00s)
    --- PASS: TestParseRequest/empty_wiki_repository_name (0.00s)
```

All gitdaemon tests at the fixed head: `TestReadPacketLine`, `TestParseRequest`, `TestAnonymousGitReadPolicy`, `TestSendError`, `TestGitSessionLimits`, `TestGitSessionAdmission` all PASS. The conf package (`TestInit` and the rest) passes unchanged. No full-repo suite was run. The end-to-end `handleConn` path needs a database and was not run.

Reviewer re-run at the live PR head `5f1cd495`, in a fresh shallow clone with the same tree as `986c4c6e`:

```
$ export GOTOOLCHAIN=go1.27.1
$ ~/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.1.linux-amd64/bin/gofmt -l internal/gitdaemon/ internal/conf/conf.go internal/conf/static.go cmd/gogs/internal/web/web.go
(no output, exit 0)
$ go vet ./internal/gitdaemon/ ./internal/conf/ ./cmd/gogs/internal/web/
(no output, exit 0)
$ go test -count=1 ./internal/gitdaemon/ ./internal/conf/
ok  	gogs.io/gogs/internal/gitdaemon	0.085s
ok  	gogs.io/gogs/internal/conf	0.160s
$ go test -count=1 -race -shuffle=on ./internal/gitdaemon/
ok  	gogs.io/gogs/internal/gitdaemon	1.057s
$ go test -count=1 -v -run 'TestParseRequest|TestAnonymousGitReadPolicy' ./internal/gitdaemon/
--- PASS: TestParseRequest (20/20 subtests)
--- PASS: TestAnonymousGitReadPolicy (9/9 subtests)
```

## How to apply

**Source: already applied.** PR #8421 head `5f1cd495` contains this exact change (tree `f85318dc`), so there is nothing to push. Running `git am` on the current head fails because the change is already present. Resetting the branch to `2c3ce8c8` would drop `8a580253` and `5f1cd495`.

To verify that the live head matches this patch:

```
git fetch https://github.com/gogs/gogs refs/pull/8421/head
git rev-parse FETCH_HEAD            # 5f1cd49535370197b78eb46b482f2c97ce7ed723
git checkout -q --detach 2c3ce8c8c64f9b857ebfa6e345c2a6dfc069a1fe
git am --3way bounty-work/gogs__gogs__1929/fix.patch
git rev-parse HEAD^{tree} FETCH_HEAD^{tree}   # both f85318dc80f02106c47562ee13fc0f08b7661534
```

The remaining publisher step is the PR body update below. Neither `8a580253` nor `5f1cd495` carries `[skip ci]`.

## Notes for the publisher (facts, not changes)

- The PR body still names `71b6bb35` as the head, says the Go tests were not run, and has no `Closes #1929`. It can now cite the live head `5f1cd495` and the validation above. The suggested replacement sections are below. The `## Bounty` section below can replace the existing "Current-head delivery and IssueHunt compensation" section so the body does not carry two compensation sections.
- `.github/CONTRIBUTING.md` asks for a Discussions proposal for new features and says "Communicate on the issue you are intended to pick up before starting working on it". #1929 is labelled `help wanted`.
- Complementary PR #8360 (UI exposure of the git:// clone URL) is separate and unaffected.
- Minor observations, left unchanged:
  - The stderr drain goroutine reads concurrently with `cmd.Wait()`. This is harmless because output is discarded; `cmd.Stderr = io.Discard` would be a simpler form.
  - The accept loop logs and continues on every error, the same way the existing SSH server loop does in `internal/ssh/ssh.go`.

## Ready-to-paste PR body sections (for gogs/gogs#8421)

Title (unchanged): `server: add built-in Git protocol (git://) server`

Replace the stale head/validation paragraphs and the existing compensation section of the body with:

```
Closes #1929

## Test plan

Head: 5f1cd49535370197b78eb46b482f2c97ce7ed723, Go 1.27.1

- `gofmt -l internal/gitdaemon/ internal/conf/conf.go internal/conf/static.go cmd/gogs/internal/web/web.go` → clean
- `go vet ./internal/gitdaemon/ ./internal/conf/ ./cmd/gogs/internal/web/` → clean
- `go test -count=1 ./internal/gitdaemon/ ./internal/conf/` → ok (both packages, including `TestInit`)
- `go test -count=1 -race -shuffle=on ./internal/gitdaemon/` → ok

The daemon now hands Git a canonical `<owner>/<repo>[.wiki].git` path built from the validated names. A suffix-less request such as `git://host/owner/repo.wiki` therefore goes through the same wiki visibility check as `owner/repo.wiki.git` and cannot reach a disabled or externally hosted wiki. `TestParseRequest` covers this case.

## Bounty

This PR implements the funded IssueHunt issue #1929 (https://oss.issuehunt.io/r/gogs/gogs/issues/1929). I am claiming that bounty: please release the $20 IssueHunt reward to @woahwhattheheck when this is merged. I will submit the claim on IssueHunt after merge.
```

Checklist items from `.github/pull_request_template.md` that can now be ticked: test cases added (gitdaemon unit tests); CHANGELOG entry added.
