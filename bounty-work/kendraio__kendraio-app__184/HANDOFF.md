# HANDOFF: kendraio/kendraio-app#184, MusicBrainz integration (Open Collective, USD 500)

- **Issue:** https://github.com/kendraio/kendraio-app/issues/184 (OPEN, labels `bounty` and `enhancement`, no assignee, opened 2021-04-27 by dahacouk)
- **Bounty:** USD 500 via Open Collective, https://opencollective.com/kendraio. The payee needs an Open Collective account and submits an expense after merge. Also announced at https://community.interledger.org/kendraio/500-usd-developer-bounty-402b
- **Base:** `develop@1d35c79b88f7f26476b7c68d9f216e792de2be64` (default branch; last upstream commit 2026-08-05)
- **Submit as:** woahwhattheheck
- **Deliverables in this directory:**
  - `fix.patch`: one commit, author woahwhattheheck, 24 files, +3475/-1
  - `PROPOSAL.md`: ready to share, as the issue requires
  - this file

## Upstream process (facts from the issue) and status

- **The issue sets a process.** It says: *"Formal notice: Don't proceed unless we have a Zoom video call first"*. It also asks for a proposal agreed in advance (kept in a shared Google Drive folder), followed by a 2-week mentored window.
  - `PROPOSAL.md` in this directory is the ready-to-share proposal for that step. It presents the working implementation as available for review and changes.
  - The PR body below has a placeholder for the proposal link and the call date.
- **13 issue comments could not be read.** GitHub's issue page lazy-loads the timeline, and the REST API is blocked here. The visible metadata shows no assignee and no linked PR.
- **The bounty dates from 2021** (Grant for the Web budget). The collective still holds the funds (see below). Competing PR #614 asked maintainers on 2026-08-20 whether the bounty is still active; there is no maintainer reply yet.

## Funding and payout evidence

- **Collective status:** Open Collective API on 2026-10-08 shows `kendraio` active and not archived. Host: Kendraio Foundation - Nonprofit Host (approved). **Balance: EUR 1,446.68**, enough for USD 500.
- **Funding source:** "Grant for the Web bounty budget" EUR 1,671.28 credited 2021-04-25.
- **Past payout:** "Kendraio Player bounty" EUR 417.82 paid out 2021-04-26 (the previous bounty, #169). This shows Kendraio pays bounties.
- **Recent activity:** the last collective transaction was 2021-05-24, so the collective is quiet. The repo itself is active (commits through 2026-08 by Luke Stanley, PRs merged).
- **Payment rail:** Open Collective is on the green-platform list (maintainer-agreed). The payout is an Open Collective expense after merge.

## What the issue asks for

The issue asks for Flow-based interfaces in Kendraio App to:

- **look up** a MusicBrainz entity
- **browse** connected entities
- **search** entities
- let artists **upload information about a release** to MusicBrainz

It also asks for a written proposal and documentation.

## State before this change

- There was no MusicBrainz integration in the repo. The only existing piece is a 2019 Flow-cloud Flow, `musicbrainz/musicbrainzSearchArtists`: an HTTP block calling `musicbrainz.org/ws/2/artist`, with no User-Agent and no rate limiting.
- That Flow also hits a CORS problem. The HTTP block adds an `ngsw-bypass` header to every GET. MusicBrainz's CORS preflight answers `Access-Control-Allow-Headers: Authorization, Content-Type, User-Agent`, so a browser rejects a request that carries `ngsw-bypass`.
  - Verified with `curl -X OPTIONS ... -H "Access-Control-Request-Headers: ngsw-bypass"`, which returns the header list without `ngsw-bypass`.
- MusicBrainz requires a meaningful User-Agent and at most 1 request per second per IP. Above that rate, all requests from the IP get 503 until the rate drops.

## Change summary

**New `musicbrainz` Flow block** (`src/app/blocks/musicbrainz-block/`), registered in `AppModule`, the Flow renderer switch and the Add Block palette.

| Operation | What it does |
|---|---|
| `search` | Any search entity. `query` is a Lucene string or a field/value object, so a form's output can be used directly. Supports `limit`, `offset` and `dismax`. |
| `lookup` | Any entity by MBID, with `inc=` validated per entity. |
| `browse` | Linked entities, validated against the combinations MusicBrainz supports. Supports `releaseType`, `releaseStatus` and paging. |
| `seed-release` | Builds MusicBrainz release-editor seeding fields and renders a native POST form (`ngNoForm`, opens in a new tab) to `<siteRoot>/release/add`. `siteRoot` can point at test.musicbrainz.org. |

- Every option can be static or come from `valueGetters` (JMESPath over `data` and `context`).
- `resultsOnly` outputs just the result list.
- Empty input is never sent. Errors are shown in the block, and superseded responses are ignored.

**New `MusicBrainzService`** (`src/app/services/musicbrainz.service.ts`, `providedIn: 'root'`):

- One app-wide FIFO queue: at least 1000 ms between requests, never less for `*.musicbrainz.org`. Mirrors can be configured faster.
- Retries 503/429 with exponential back-off.
- Shares in-flight requests and caches responses for 5 minutes (LRU, 100 entries).
- Sends `User-Agent: KendraioApp/<package.json version> ( https://github.com/kendraio/kendraio-app )` and `Accept: application/json` only. These are the headers MusicBrainz's CORS policy allows.
- Readable `MusicBrainzError` messages.

**Nine demo Flows** in `src/assets/adapters/musicbrainz/`, served at `/musicbrainz/<id>` through the existing assets loader. Rows link to the next Flow with `link-action` (`?mbid=`).

| Flow | Purpose |
|---|---|
| `dashboard` | Links to the other Flows |
| `searchArtists`, `searchReleases`, `searchRecordings` | Search |
| `artist` | Lookup, plus browse of the artist's release groups |
| `releaseGroup` | Lookup, plus browse of its releases (format, tracks, label, catalog number, barcode) |
| `release` | Lookup, plus the track list (m:ss) |
| `recording` | Lookup (ISRCs, works, genres), plus browse of the releases it appears on |
| `submitRelease` | Form with track list, mapping, then seed-release |

**Installable adapter package** `src/assets/adapters/musicbrainz.json` (dashboard, services menu, workflows and attachments), registered in the built-in adapter repository (`index.json`, `kendraio-adapter-repo.json`).

**Docs:** `docs/workflow/blocks/musicbrainz.rst`, added to the `docs/index.rst` toctree.

**Tests:** 35 focused specs across `musicbrainz.service.spec.ts`, `musicbrainz-block.component.spec.ts` and `musicbrainz-flows.spec.ts`.

### Files changed

```
docs/index.rst                                              |    1 +
docs/workflow/blocks/musicbrainz.rst                        |  207 +
src/app/app.module.ts                                       |    2 +
src/app/blocks/musicbrainz-block/musicbrainz-block.component.{ts,html,scss}
src/app/blocks/musicbrainz-block/musicbrainz-block.component.spec.ts
src/app/blocks/musicbrainz-block/musicbrainz-flows.spec.ts
src/app/components/blocks-workflow/blocks-workflow.component.html |  1 +
src/app/dialogs/add-block-dialog/block-types.ts             |   17 +
src/app/services/musicbrainz.service.ts                     |  622 +
src/app/services/musicbrainz.service.spec.ts                |  269 +
src/assets/adapters/index.json                              |   12 +
src/assets/adapters/kendraio-adapter-repo.json              |    3 +-
src/assets/adapters/musicbrainz.json                        | 1011 +
src/assets/adapters/musicbrainz/{artist,dashboard,recording,release,releaseGroup,
  searchArtists,searchRecordings,searchReleases,submitRelease}.json
```

The patch does not touch the shared HTTP block or mapping utilities, so there is no regression risk for existing Flows.

## Validation (focused only)

The repo's Karma config launches Electron (`karma-electron`), which is not installed here. So I used a local-only Karma config: the same frameworks, with `karma-chrome-launcher` and Playwright's headless Chromium. It is not part of the patch.

```js
// karma.focused.cjs (local only)
const root = '<repo>'; const nm = p => require(`${root}/node_modules/${p}`);
module.exports = c => c.set({ basePath: `${root}/src`, frameworks: ['jasmine', '@angular-devkit/build-angular'],
  plugins: [nm('karma-jasmine'), nm('karma-chrome-launcher'), nm('@angular-devkit/build-angular/plugins/karma')],
  customLaunchers: { HeadlessNoSandbox: { base: 'ChromeHeadless', flags: ['--no-sandbox'] } },
  browsers: ['HeadlessNoSandbox'], singleRun: true, reporters: ['progress'] });
```

**1. Focused unit specs: 35/35 pass.**

```
npm ci --legacy-peer-deps            # with CYPRESS_INSTALL_BINARY=0 ELECTRON_SKIP_BINARY_DOWNLOAD=1
CHROME_BIN=<chrome-headless-shell> npx ng test --watch=false \
  --include=src/app/services/musicbrainz.service.spec.ts \
  --include=src/app/blocks/musicbrainz-block/musicbrainz-block.component.spec.ts \
  --include=src/app/blocks/musicbrainz-block/musicbrainz-flows.spec.ts \
  --karma-config=karma.focused.cjs --browsers=HeadlessNoSandbox
→ Chrome Headless 148.0.7778.96 (Linux x86_64): Executed 35 of 35 SUCCESS
```

**2. Mutation checks: the tests catch real regressions.**

| Mutation | Result |
|---|---|
| Minimum interval 1000 → 500 ms | 3 specs fail: spacing, clamp, back-off |
| Remove `ngNoForm` from the seed form | The native-submit spec fails (`defaultPrevented` becomes true) |
| Corrupt one `inc` in `artist.json` | The flow-validity and package-sync specs fail |

**3. Static checks.**

- `npx tsc -p src/tsconfig.app.json --noEmit` → exit 0
- `npx eslint` on the new TS files → exit 0
- All Flow JSON files parse

**4. Live MusicBrainz calls** through the proxy, ≤1 request/s, using URLs from the real `buildMusicBrainzUrl`:

| Request | Result |
|---|---|
| Artist search `artist:"Björk" AND country:"IS"` | 200, 8 results, top hit Björk |
| Recording search | 200, 102 results |
| Release search | 200, 34 results |
| Lookup artist `inc=aliases+genres+url-rels` | 200, 13 aliases, 31 genres, 70 URL relationships |
| Browse `release-group?artist=…&type=album\|ep` | 200, albums and EPs only |
| CORS preflight with `Access-Control-Request-Headers: user-agent` | 200, `Access-Control-Allow-Headers: Authorization, Content-Type, User-Agent` |
| `POST /release/add` with seed fields | 302 to MetaBrainz login (editing requires login, as expected) |

**5. End-to-end simulation of all 9 demo Flows.** Each Flow ran with the real block component, the real Kendraio JMESPath mapping utility, real Handlebars templates and live MusicBrainz data. The chain was search Björk → artist → release group → release (track list 5:19) → recording (ISRC GBBTF1100083) → appearances (21 releases), plus two submitRelease cases. Result: **PROBLEMS: none.** Request de-duplication was observed: the two release-page blocks made one HTTP call.

**6. Patch applies cleanly.** `git am fix.patch` on a fresh `origin/develop` worktree → 24 files changed, 3475 insertions.

## How to apply

```
git clone https://github.com/kendraio/kendraio-app && cd kendraio-app
git checkout -b feat/musicbrainz-184 origin/develop
git am /path/to/fix.patch
```

## Competition

**PR #614 "Add MusicBrainz adapter workflows"** by Danop404:

- Opened 2026-08-20, marked ready 2026-08-25. Branch `codex/musicbrainz-adapter`, 1 commit (fc2ea44).
- No maintainer review or reply in 7 weeks. The Vercel check is waiting on team authorization. A third party ("aibitious") posted a revalidation comment.
- It also skipped the proposal and call.

| | PR #614 | Ours |
|---|---|---|
| MusicBrainz rules | No User-Agent, no rate limiting, no 503 handling. Its artist page fires several requests at once. | Global 1 req/s queue, back-off on 503/429, User-Agent, caching and de-duplication |
| Approach | Hand-built URL strings in each Flow via the generic HTTP block. Changes the shared HTTP block's `ngsw-bypass` behaviour for every Flow. | A reusable, documented block. Shared HTTP block untouched. |
| Coverage | Artist search, artist details, artist releases, release details | Search, lookup and browse for artists, release groups, releases and recordings (any entity supported by the block), all cross-linked |
| Submission | Seeds by GET query string. Title, artist, date, label and format only; no tracks. | Proper POST seeding as documented by MusicBrainz: track list with lengths, multiple artist credits, labels, events, URLs, edit note, validation, test-server option |
| Tests | 4 small specs on helper changes. Karma not run. | 35 specs run in a real browser, mutation-checked, plus live end-to-end Flow runs |
| Process | No proposal | `PROPOSAL.md` ready for the required call |

Fleet: no Slack TAKE or other fleet work found for kendraio or MusicBrainz.

---

## Ready-to-paste PR

**Title:** `Add MusicBrainz block and Flows: search, lookup, browse and release submission (closes #184)`

**Body:**

```markdown
Closes #184

This adds the MusicBrainz integration described in #184.
Proposal: <link to the shared Drive copy of PROPOSAL.md> (agreed on the call of <date>).

## What's included

- **`musicbrainz` Flow block**: search, look up and browse any MusicBrainz entity, or prepare a release for submission (`seed-release`). Every option can be static or computed with JMESPath `valueGetters`; `resultsOnly` feeds a Grid directly; invalid input (MBIDs, `inc=` values, browse combinations) is reported in the block before anything is sent.
- **MusicBrainzService**: follows the MusicBrainz API rules for every Flow:
  - User-Agent `KendraioApp/<version> ( https://github.com/kendraio/kendraio-app )`
  - one shared queue at most 1 request per second
  - retry with back-off on 503/429
  - shared in-flight requests and a 5-minute cache
  - only CORS-allowed headers. The HTTP block's `ngsw-bypass` header is rejected by the MusicBrainz CORS preflight, so this block does not use it.
- **Release submission** through MusicBrainz release editor seeding (POST to `/release/add`, opened in a new tab). The artist reviews and submits under their own MusicBrainz account; `siteRoot` can point at test.musicbrainz.org.
- **Demo Flows** under `/musicbrainz/`. Results link from one Flow to the next.
  - `dashboard`
  - `searchArtists`, `searchReleases`, `searchRecordings`
  - `artist`, `releaseGroup`, `release`, `recording`
  - `submitRelease`
- The Flows are also packaged as an installable `musicbrainz` adapter in the built-in adapter repository.
- **Docs**: `docs/workflow/blocks/musicbrainz.rst` in the Flow Blocks Reference.

## Testing

- 35 unit specs (`musicbrainz.service.spec.ts`, `musicbrainz-block.component.spec.ts`, `musicbrainz-flows.spec.ts`) cover:
  - URL building and validation, Lucene queries and release seeding
  - rate limiting with a simulated clock, retries and caching
  - CORS-safe headers
  - the block template (native POST form)
  - checks that every demo Flow makes only valid MusicBrainz requests and links only to existing Flows
- `npx ng test --watch=false --include=src/app/services/musicbrainz.service.spec.ts --include=src/app/blocks/musicbrainz-block/musicbrainz-block.component.spec.ts --include=src/app/blocks/musicbrainz-block/musicbrainz-flows.spec.ts` → 35 of 35 SUCCESS
- All demo Flows were run end-to-end against musicbrainz.org (Björk → Homogenic → editions → track list → recording → appearances) at ≤1 request per second.

## Bounty

This completes the deliverables of the MusicBrainz integration bounty in #184 (USD 500, paid through Open Collective). Once this is merged, I'd like to claim the bounty and will submit an expense to https://opencollective.com/kendraio. Please let me know if anything else is needed for the payout.
```

## Remaining or optional work (to agree on the call)

- Publish the Flows to the Flow cloud and/or add the adapter to `kendraio/kendraio-adapter`, if the maintainers want them there too.
- Replace or redirect the 2019 cloud Flow `musicbrainz/musicbrainzSearchArtists`.
- Phase 2 (optional): MusicBrainz OAuth for direct submissions the web service accepts (ISRCs, barcodes, tags, ratings).
- Screencast and write-up for Kendraio's channels. The issue says preference goes to candidates who document and talk about their work.
