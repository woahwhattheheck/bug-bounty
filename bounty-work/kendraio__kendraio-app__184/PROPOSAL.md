# Proposal: MusicBrainz integration for Kendraio App (issue #184)

**Applicant:** woahwhattheheck (GitHub)  
**Issue:** https://github.com/kendraio/kendraio-app/issues/184  
**Bounty:** USD 500, paid through Open Collective (https://opencollective.com/kendraio)  
**Timeframe:** 2 weeks of mentored work after agreement on this proposal

## 1. Summary

I propose to integrate MusicBrainz into Kendraio App as a reusable, low-code building block plus a set of ready-to-use Flows:

1. A **MusicBrainz Flow block** (`"type": "musicbrainz"`) that any Flow author can drop into a Flow to **search**, **look up** and **browse** MusicBrainz, and to **prepare a release for submission** to MusicBrainz.
2. A **MusicBrainz service** inside the app that does the MusicBrainz-specific work once, for every Flow: correct identification (User-Agent), the one-request-per-second limit, retries when MusicBrainz is busy, caching and input validation.
3. **Demo Flows** under `/musicbrainz/...` that cover the user journeys in the issue: look up an entity, browse connected entities, search, and let an artist submit a release.
4. **Documentation** in the Flow Blocks Reference and **automated tests**.

To make the call concrete, I have already built a working version of all of this. It is ready for you to review and change during the mentoring window. Nothing is final until we agree on the proposal.

## 2. How it maps to the issue's deliverables

| Issue deliverable | What I deliver |
|---|---|
| Proposal agreed in advance (shared Google Drive) | This document. I will copy it into the shared Drive folder and update it after our call. |
| Flows to **look up** information about a MusicBrainz entity | `musicbrainz` block with `operation: "lookup"` (any entity, MBID plus `inc=` options). Demo Flows: `/musicbrainz/artist`, `/musicbrainz/releaseGroup`, `/musicbrainz/release`, `/musicbrainz/recording` |
| Flows to **browse** entities connected to an entity | `operation: "browse"` (for example the release groups of an artist, the releases in a release group, or the releases a recording appears on). Every result row links to the next Flow. |
| Flows to **search** for entities | `operation: "search"`. A form's fields become MusicBrainz search fields directly. Demo Flows: `/musicbrainz/searchArtists`, `/musicbrainz/searchReleases`, `/musicbrainz/searchRecordings` |
| Flows where artists can **upload information about a release** to MusicBrainz | `operation: "seed-release"` plus the `/musicbrainz/submitRelease` Flow. The artist fills in a form (title, artist credit, type, status, date, country, label, catalog number, barcode, format, track list with lengths, links). The block opens the MusicBrainz release editor already filled in, where the artist reviews and submits it under their own MusicBrainz account. |

### Why release editor seeding for uploads

MusicBrainz's web service does not accept new releases. Its documented route for third-party applications is [release editor seeding](https://wiki.musicbrainz.org/Development/Release_Editor_Seeding): the application POSTs the release details to `musicbrainz.org/release/add`, and MusicBrainz opens its editor with them filled in. This approach:

- needs no OAuth application, client secret or server component in Kendraio;
- keeps the artist in control, because they review and submit the edit under their own account, which MusicBrainz's editing rules expect;
- can be tried safely on `test.musicbrainz.org` (the `siteRoot` option).

If you want to go further, a phase 2 could use MusicBrainz OAuth to submit things the web service does accept directly, such as ISRCs, barcodes, tags and ratings. Section 7 lists this as an open question.

## 3. Design

### MusicBrainz block (low-code)

```json
{
  "type": "musicbrainz",
  "operation": "browse",
  "entity": "release-group",
  "linkedEntity": "artist",
  "releaseType": ["album", "ep"],
  "resultsOnly": true,
  "valueGetters": { "linkedMbid": "context.queryParams.mbid" }
}
```

- Any option can be set statically or computed from the incoming data or the Flow context with JMESPath (`valueGetters`), the same pattern other Kendraio blocks use.
- `resultsOnly` outputs just the list of results, so a Grid block can follow directly.
- Invalid input (a malformed MBID, an unsupported `inc=` value, a browse combination MusicBrainz does not support) produces a readable message in the block before anything is sent.
- Empty input (for example a search form that has not been submitted yet) is not sent at all.

### MusicBrainz service (being a good API citizen)

MusicBrainz asks clients to follow [its rules](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) or risk having their IP address blocked:

- **User-Agent:** `KendraioApp/<app version> ( https://github.com/kendraio/kendraio-app )`. MusicBrainz's CORS policy explicitly allows this header. Flow authors can set their own.
- **One request per second:** a single queue is shared by every MusicBrainz block in the app. It cannot go faster than one request per second against musicbrainz.org; a faster limit is allowed only for self-hosted mirrors.
- **Busy handling:** HTTP 503 and 429 responses are retried with back-off before an error is shown.
- **Fewer requests:** identical requests in flight are shared, and responses are cached for five minutes. Flows re-run often, and two blocks on the same page often ask for the same thing.
- **CORS-safe headers only:** the existing HTTP block adds an `ngsw-bypass` header to every GET. MusicBrainz's CORS preflight does not allow that header (it allows only `Authorization, Content-Type, User-Agent`), so browser requests made that way fail. The new service sends only `Accept` and `User-Agent`.

### Packaging

- The Flows ship in `src/assets/adapters/musicbrainz/`, so they work at `https://app.kendra.io/musicbrainz/<flow>` without any install step.
- They are also packaged as an installable `musicbrainz` adapter in the app's built-in adapter repository, which adds a MusicBrainz dashboard and services menu entry.
- If you prefer, I can also publish the Flows to the Flow cloud, or add the adapter to `kendraio-adapter`.

## 4. Quality and transparency

- **Unit tests** (Jasmine/Karma, 35 specs) cover URL building and validation, Lucene query building, release seeding, rate limiting with a simulated clock, retries, caching, CORS-safe headers, the block's behaviour and template, and a check that every demo Flow only makes valid MusicBrainz requests and only links to Flows that exist.
- **Live check:** every demo Flow was run end-to-end against musicbrainz.org (Björk → Homogenic → editions → track list → recording → appearances), at most one request per second.
- **Docs:** a new page in the Flow Blocks Reference (`docs/workflow/blocks/musicbrainz.rst`) with examples for each operation, the release data format and the list of demo Flows.
- I will write a short report on the work for Kendraio's channels, and can record a screencast of the Flows.

## 5. Plan for the two-week mentored window

| When | What |
|---|---|
| Before starting | Zoom call: walk through this proposal and the working version, agree scope and changes. Proposal copied to the shared Drive. |
| Week 1 | Apply feedback from the call (naming, Flow layout, which entities and fields to show, styling). Open the PR against `develop`. Publish the Flows where you want them (assets, Flow cloud and/or adapter repository). |
| Week 2 | Review rounds, docs polish, write-up and screencast, final sign-off. Optional phase-2 items if agreed. |

## 6. Evaluation criteria (from the issue)

- **Task completion:** every deliverable in the issue is covered (see section 2) and working today.
- **Transparency:** an open PR, documented design decisions, tests and a write-up.
- **Interoperability:** a generic block that any Flow can use. It outputs plain MusicBrainz JSON that works with the existing Mapping, Grid and Template blocks, and supports MusicBrainz mirrors and the test server.
- **Ease of use:** form-to-search with no query syntax, clickable navigation between related entities, a guided release submission form, and readable errors.

## 7. Questions for the call

1. Is release editor seeding acceptable for "upload information about a music release", or do you also want OAuth-based submission (ISRCs, barcodes, tags) as phase 2?
2. Where should the Flows live long term: shipped in the app (current), the Flow cloud, or the `kendraio-adapter` repository?
3. Should the existing 2019 cloud Flow `musicbrainz/musicbrainzSearchArtists` be replaced by or redirected to the new search Flow?
4. Which other entities matter most for Kendraio users (labels, works and ISWCs, events)? The block already supports them, so only demo Flows would be needed.
5. Mentor and review contacts, and the preferred channel (GitHub, Slack).

## 8. Payment

Paid through Open Collective (https://opencollective.com/kendraio) on completion and merge, as stated in the issue. Once the work is accepted, I will submit an expense for the USD 500 bounty to the Kendraio collective.
