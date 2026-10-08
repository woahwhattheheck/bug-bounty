# HANDOFF · opencollective/opencollective#7138 · Open Collective (OFiTech "Fediverse friendly Open Collective" fund, balance $1,269.66) · READY FOR SUBMISSION

Date: 2026-10-08. Engineering only. Nothing was submitted upstream. No PRs, comments, claims, forks or reactions were made on GitHub or Open Collective.

| | |
|---|---|
| Issue | https://github.com/opencollective/opencollective/issues/7138 ("Add BlueSky/Mastodon API Capabilities") |
| Funding | https://opencollective.com/ofitech/projects/fediverse-friendly-open-collective (slug `fediverse-friendly-open-collective`) |
| Platform | Open Collective (fund expense) |
| Amount | No fixed per-task amount. The fund holds **$1,269.66 USD**, disbursed at the fund admins' discretion (see below). |
| Deliverables | `fix.patch` → opencollective/opencollective-api; `fix-frontend.patch` → opencollective/opencollective-frontend |
| Submit as | woahwhattheheck (commit author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`) |

## 1. Funding facts (checked 2026-10-08 via the public Open Collective GraphQL API)

- **Fund:** "Fediverse friendly Open Collective", a PROJECT whose parent and host is **OFiTech (Open Finance Technologies)**, the entity that runs opencollective.com. It was created on 2022-11-13 and is active.
- **Balance:** **$1,269.66 USD**. Total received is $2,584.66, from monthly contributions in 2023 by Fission ($100/month) and Leonardo Kewitz ($10/month).
  - On 2024-12-03 the balance moved out ("Financial contribution to Open Collective Engineering", -$1,269.66) and was added back ("Move to OFiTech", +$1,269.66).
- **What the fund says it pays for** (description, verbatim excerpts):
  - "We would like to look at all occurrences of Twitter in the codebase and make sure the Fediverse is a first class citizen."
  - Things left in mind: "automated posts to Mastodon for some key activities (monthly stats, milestone reached, thank you to new contributor)".
  - **"The collected funds will be disbursed transparently to community members working toward those goals."**
- **This work delivers all three items** the fund lists as remaining: monthly stats, milestone reached, and thanks to new contributors, all posted automatically to Mastodon.
- **Payout history:** the fund has **0 expenses**, ever. Nothing has been paid for this work so far, and no expense for it is pending.
- **Expense settings:** `RECEIVE_EXPENSES` is ACTIVE, and the supported expense types are INVOICE and RECEIPT. Neither the fund nor OFiTech has written an expense policy.
- **Fund admins** (OFiTech admins): François Hodierne (`fhodierne`), Benjamin Piouffle (`betree`), Leonardo Kewitz (`leokewitz`), Sudharaka Palamakumbura, Shannon Wray, Lauren Gardner, Benjamin Nickolls, and OFiTech Admin.
  - Hodierne, Piouffle and Kewitz are Open Collective core engineers who merge into the api and frontend repos. Kewitz is also one of the fund's two donors.
- **Maintainer position on the issue:** #7138 has no maintainer comment, assignee or linked PR. The fund itself was created and is administered by the maintainers' organization.
- **Platform payout track record:** Open Collective pays approved expenses routinely; OFiTech also pays security-bounty expenses (30+ paid in 2026, per `/home/user/work/candidates-oc.md`). This particular fund has no payout history yet.

### Fund expense steps (after merge)

1. Sign in to Open Collective with the team's receiving profile. It has a verified PayPal payout method, per the 2026-10-05 coordination note.
2. Open https://opencollective.com/fediverse-friendly-open-collective/expenses/new. You can also use the "Submit expense" button on https://opencollective.com/ofitech/projects/fediverse-friendly-open-collective.
3. Choose expense type **Invoice**. Pick the receiving profile as payee and the existing PayPal payout method.
4. Fill in the expense:
   - Title: "Automated Mastodon posts (opencollective/opencollective#7138)".
   - One line item in USD for the amount requested.
   - Links to both merged PRs (api and frontend) in the description.
5. Submit. The OFiTech admins listed above review and approve it, and OFiTech, as host, pays it out.
6. The fund has no fixed per-task amount, so the amount is agreed with the fund admins. The PR bodies below already request payment from this fund. The expense itself sets the amount; Bryce decides how much to request, up to the $1,269.66 balance.

## 2. Issue summary

- **Opened:** 2023-12-01 by DrewMcArthur, label `feature`.
- **Ask:** feature parity with the old X/Twitter integration, posting to the Fediverse or Bluesky instead.
- **The issue's own plan:**
  1. Study the X API.
  2. Create a generic microblogging interface.
  3. Connect to the service.
  4. Implement the interface.
  5. Make posting triggers publish to all configured connections.
  6. Add UI to create the connection.
- **MVP:** "get one event working end to end".
- **Task list:** "Create MicrobloggingApiInterface".

## 3. Root cause / what was missing

- The Twitter integration was removed in opencollective-api#10693 ("debt: remove all Twitter-related code", Feb 2025). It deleted:
  - `server/lib/twitter.ts`
  - `cron/monthly/collective-tweet.js` (monthly stats)
  - `cron/10mn/10-milestones.js` (contributor milestones)
  - the `channels.TWITTER` dispatch (new backer thanks)
- Nothing replaced it. `Service.TWITTER` and `channels.TWITTER` remain only as `@deprecated` constants.
- Open Collective therefore had **no automated social posting at all**. The fund's remaining goal (Mastodon posts for monthly stats, milestones and new-contributor thanks) was unimplemented.
- The deprecated Twitter channel was **not** extended. The new code is a separate, service-agnostic microblogging layer.

## 4. Change summary

### API: opencollective/opencollective-api (`fix.patch`, 1 commit)

- **`MicrobloggingService` interface** (`server/lib/microblogging/types.ts`). It defines `verifyCredentials`, `post` and `getTextLimits`, plus typed errors. This is the issue's "MicrobloggingApiInterface".
- **Mastodon implementation** (`server/lib/microblogging/mastodon.ts`):
  - **Instance URL:** normalized (accepts `mastodon.social` or a profile URL), HTTPS only, no credentials in the URL.
  - **Credential check:** `GET /api/v1/accounts/verify_credentials`. On Mastodon ≥ 4.3 it also checks the `write:statuses` scope via `/api/v1/apps/verify_credentials`.
  - **Server limits:** read from `GET /api/v2/instance`, with fallbacks to `/api/v1/instance` and `max_toot_chars`, so non-default limits like 1000 or 5000 characters are respected. The full handle uses the server's `domain`, so split-domain setups work.
  - **Posting:** `POST /api/v1/statuses` with `visibility: public`, `language: en`, an optional `in_reply_to_id` and an `Idempotency-Key` header.
  - **Request safety:** every request reuses the existing webhook SSRF protections (`getPinnedAxiosAgentsForWebhookUrl`: pinned DNS, private/internal addresses rejected), with `maxRedirects: 0` and a 15 s timeout.
- **Post composition** (`posts.ts`, `text.ts`):
  - Texts for new-contributor thanks, contributor milestones (10, 25, 50, 100, 250, 500, 1k, 2.5k, 5k, 10k) and monthly stats.
  - Length is counted the way Mastodon counts it (URLs = 23 chars, remote mentions count their local part, grapheme clusters). Only the body is truncated; the collective URL is always kept.
  - User-provided names are neutralized so they can't inject mentions, hashtags, links or line breaks.
- **Activity-to-post pipeline** (`server/lib/microblogging/index.ts`), hooked into the existing notifications dispatcher (`server/lib/notifications/index.ts`):
  - **Trigger:** `collective.member.created` with role `BACKER`. It runs for full dispatches only, not `onlyChannels` ones.
  - **New-contributor thanks:** mentions the contributor as `@user@instance` when their public profile has a MASTODON social link. Incognito contributors are never named or mentioned. Limited to 10 posts per hour per account; the activity id is the idempotency key.
  - **Milestones:** each milestone is posted once. The last milestone is stored, and milestones already reached when the account is connected are skipped.
  - **Skipped entirely:** private collectives and accounts flagged `needsReconnect`.
  - **Revoked tokens:** a 401 sets `needsReconnect` and stops posting. Other errors go to Sentry, and posting never throws into the dispatcher.
- **Monthly stats CRON** (`cron/monthly/microblogging-monthly-stats.ts`):
  - Runs on the 1st (production guard and `OFFCYCLE`, as in the other monthly jobs).
  - Posts received, spent, new contributors, active contributors and balance for the previous UTC month.
  - Threads each report under the previous one. If that post was deleted (404/422), it starts a new thread.
  - Posts at most once per account per month (`lastPeriod`).
- **GraphQL v2:**
  - `createConnectedAccount` accepts `service: mastodon` with a new `instanceUrl` input field. Reconnecting the same remote account refreshes its token.
  - The mutation still requires collective admin, 2FA and the `connectedAccounts` scope.
  - New `editConnectedAccountPostSettings(connectedAccount, postSettings: ConnectedAccountPostSettingsInput!)` mutation.
  - `ConnectedAccount.username` (admin only) and `settings.posts` / `settings.needsReconnect` are exposed to admins.
  - The schema dump `server/graphql/schemaV2.graphql` is updated; the v1 schema is unchanged.
- **Feature flag:** `config.features.microbloggingPosts`, env `MICROBLOGGING_POSTS`, default **off**. It gates connecting, the pipeline and the CRON job. Documented in `docs/environment_variables.md`.
- **No DB migration needed.** `ConnectedAccounts.service` is a string column validated against the `Service` enum. The token is stored encrypted, as for the other services.

### Frontend: opencollective/opencollective-frontend (`fix-frontend.patch`, 1 commit)

- **New dashboard settings section "Automated posts"** (`components/dashboard/sections/AutomatedPosts.tsx`, Tailwind/ShadCN):
  - **Connect form:** server URL, access token, and on/off switches for the three post types. It explains how to create the token and links straight to `https://<server>/settings/applications/new`.
  - **Connected account cards:** the handle, who connected it, per-post-type switches, a warning with a reconnect prompt when the token was revoked, and Disconnect (with a confirmation).
  - **More accounts:** a "Connect another Mastodon account" button.
- **Wiring:**
  - `SETTINGS_SECTIONS.AUTOMATED_POSTS` plus its label, and the `SETTINGS_COMPONENTS` entry.
  - Menu item for collectives, funds, projects, events and organizations. It is hidden for private accounts and accountants.
  - The item sits behind a new **preview feature `MASTODON_POSTS`**: closed beta for platform accounts, and always enabled in dev.
- **Generated files:**
  - `lib/graphql/schemaV2.graphql` gets the same 5 hunks as the API dump.
  - Codegen types (`lib/graphql/types/v2/{gql,graphql}.ts`) contain only this feature's additions; an unrelated upstream codegen drift was left out.
  - `lang/*.json` updated with `npm run build:langs`: 14 new keys in each of the 19 locales, nothing else.

### Files changed

API (19 files, +1986/−5):
```
config/custom-environment-variables.json
config/default.json
cron/monthly/microblogging-monthly-stats.ts                    (new)
docs/environment_variables.md
server/constants/connected-account.ts
server/graphql/schemaV2.graphql
server/graphql/v2/input/ConnectedAccountCreateInput.ts
server/graphql/v2/input/ConnectedAccountPostSettingsInput.ts   (new)
server/graphql/v2/mutation/ConnectedAccountMutations.ts
server/graphql/v2/object/ConnectedAccount.ts
server/lib/microblogging/{index,mastodon,posts,text,types}.ts  (new)
server/lib/notifications/index.ts
test/server/lib/microblogging/{index,mastodon,posts}.test.ts   (new)
```
Frontend (27 files, +935):
```
components/dashboard/sections/AutomatedPosts.tsx   (new)
components/dashboard/{DashboardSection.tsx,constants.ts,menu-items.ts}
lib/preview-features.tsx
lib/graphql/schemaV2.graphql
lib/graphql/types/v2/{gql.ts,graphql.ts}
lang/*.json (19 locales)
```

## 5. Validation (focused only; no full suites were run)

Node v24.21.0 (the repos require 24.x). All Mastodon HTTP is mocked with nock (`nock.disableNetConnect()`), and DNS is stubbed for the SSRF checks.

**API, focused unit tests for the new service and pipeline:**
```
cd opencollective-api
NODE_ENV=test TZ=UTC npx mocha test/server/lib/microblogging/mastodon.test.ts \
  test/server/lib/microblogging/posts.test.ts test/server/lib/microblogging/index.test.ts
→ 45 passing (647ms)
```
(The suite's global hook prints an "Unable to initialize test S3 buckets" warning without a local MinIO. This is expected and harmless.)

Covered cases:
- **Mastodon service:**
  - instance URL normalization
  - verify credentials, including split-domain handles, the v1 fallback, scope rejection and invalid tokens
  - SSRF rejection of private IPs and internal hostnames
  - status posting with idempotency and threading
  - 401 → authentication error; 422 → request error carrying its status
  - redirects are not followed
- **Composer:**
  - Mastodon-style character counting and truncation
  - input neutralization
  - all post texts, including incognito contributors, recurring amounts, zero-decimal currencies and empty months
- **Pipeline:**
  - feature flag off → no queries
  - activity, role and private-collective filtering
  - thanks with a fediverse mention
  - incognito contributors are never named
  - milestones posted once, with no back-fill
  - per-type toggles
  - revoked token → `needsReconnect`
  - rate limit
  - invoked through `notifications.dispatch()` (and not for `onlyChannels`)
  - monthly stats: period boundaries, threading, once per month, new thread when the previous post was deleted, CRON entry point gated by the flag
  - connect, reconnect, and refusal cases
  - post-settings sanitization

**API, static checks on the touched files:**
```
npx tsc --noEmit -p tsconfig.json                → exit 0 (0 errors)
npx eslint <changed .ts files>                   → no problems
npx prettier --check <changed files>             → All matched files use Prettier code style!
npm run ts-unused-exports                        → 0 modules with unused exports
GraphQL v2 schema printed from code (introspection → printSchema → repo prettier), diffed against the
committed dump → only the 5 expected hunks; v1 dump unchanged.
```

**Frontend, static checks:**
```
cd opencollective-frontend
npm run graphql:codegen                          → generated; only feature-related additions kept
npm run build:langs                              → 14 new keys × 19 locales, nothing else changed
node_modules/typescript/bin/tsc --noEmit         → exit 0 (0 errors)
npx eslint --quiet <changed files>               → no errors
npx prettier --check <changed files>             → All matched files use Prettier code style!
npm run ts-unused-exports                        → 0 modules with unused exports
```

**Patch application:** both patches apply with `git am` on fresh worktrees of upstream `main` (checked after re-fetching).

**Not done in this pass** (facts for the submitter):
- No GraphQL mutation integration tests. They need Postgres, and the brief limits validation to unit tests of the service and pipeline.
- No posting to a live Mastodon server.
- No UI screenshot. The frontend PR template asks for one; it can be taken with a local API with `MICROBLOGGING_POSTS=true` and a Mastodon test token.

## 6. Base / how to apply

- API base: `opencollective/opencollective-api@main` = `472fee4cff8a774c4ee3b01108fc0d67e9f7ccb9`
- Frontend base: `opencollective/opencollective-frontend@main` = `637960e56afcbc91f632d337b3c0c3c79dae7905`

```
# API
git clone https://github.com/opencollective/opencollective-api && cd opencollective-api
git checkout -b feat/mastodon-automated-posts 472fee4cff8a774c4ee3b01108fc0d67e9f7ccb9
git am /path/to/fix.patch

# Frontend
git clone https://github.com/opencollective/opencollective-frontend && cd opencollective-frontend
git checkout -b feat/mastodon-automated-posts 637960e56afcbc91f632d337b3c0c3c79dae7905
git am /path/to/fix-frontend.patch
```
Open the API PR first, then the frontend PR with a `Require <API PR URL>` line. The frontend uses the new API schema.

## 7. Competition

- **opencollective-api:** no PRs with "mastodon" or "bluesky" in the title, open or closed. Searching "7138" only matches an unrelated 2022 renovate PR.
- **opencollective-frontend:** the only Mastodon PRs are #8397, #8586 and #8604 (share buttons and footer link, by znarf, merged 2022–2023). They don't overlap with automated posting.
- **Issue #7138:** no linked PRs.
- **Fleet:** no TAKE in Slack before ours (searched "opencollective" and "mastodon", last 7 days). Our TAKE: https://tokenjunkielabs.slack.com/archives/C0BVANHNB26/p1791437079314909

## 8. Scope notes and remaining work

- **Bluesky is not included.** The issue title mentions "BlueSky/Mastodon", but the fund pays for Mastodon. A Bluesky implementation is a self-contained follow-up:
  - Add `Service.BLUESKY` and a `server/lib/microblogging/bluesky.ts` implementing `MicrobloggingService` (`com.atproto.server.createSession` with an app password, then `com.atproto.repo.createRecord` for `app.bsky.feed.post`, with link facets and a 300-grapheme limit).
  - Register it in `SERVICES` / `MICROBLOGGING_SERVICES` and add a service picker to the connect form.
  - The pipeline, composer and settings UI are reused unchanged.
- **Optional follow-ups:**
  - Publish updates (`collective.update.published`) as posts. The old Twitter integration had this; the fund does not list it.
  - Customizable post templates.
- **Rollout:** set `MICROBLOGGING_POSTS=true` on the API, then make the `MASTODON_POSTS` preview feature public (`publicBeta: true`).

## 9. Ready-to-paste PR drafts

### PR 1, opencollective/opencollective-api

**Title:** `feat(connected-accounts): automated Mastodon posts for collectives`

**Body:**
```markdown
Closes opencollective/opencollective#7138

## Description

Brings automated announcements back to Open Collective, this time on the Fediverse. This is the remaining goal of the [Fediverse friendly Open Collective](https://opencollective.com/ofitech/projects/fediverse-friendly-open-collective) fund: automated posts to Mastodon for monthly stats, milestones reached and thanks to new contributors.

- **`MicrobloggingService` interface** (`server/lib/microblogging/types.ts`), the "MicrobloggingApiInterface" from the issue, plus a **Mastodon implementation**. Collectives connect an account with an access token from their own Mastodon server. The token is stored encrypted in a `mastodon` ConnectedAccount.
  - The token is checked with `verify_credentials`. On Mastodon ≥ 4.3 the `write:statuses` scope is also checked.
  - The server's character limits are read from `/api/v2/instance`, with a fallback to v1.
  - All requests reuse the webhook SSRF protections (pinned DNS, no private addresses), with no redirects and a timeout.
- **Activity → post pipeline**, called by the notifications dispatcher on `collective.member.created` (BACKER):
  - Thanks new financial contributors. It mentions them when their profile links a Mastodon account and never names incognito contributors.
  - Celebrates contributor milestones (10, 25, 50, 100…), each one once.
- **Monthly CRON job** (`cron/monthly/microblogging-monthly-stats.ts`) posting the previous month's stats, threaded with the previous report.
- **Controls and safety:**
  - Each post type can be toggled per account.
  - New-contributor posts are rate limited (10/hour/account) and deduplicated with `Idempotency-Key`.
  - Texts fit the server limit (counted like Mastodon), and user-provided names can't inject mentions, hashtags or links.
  - A revoked token flags the account for reconnection instead of erroring repeatedly.
- **GraphQL:**
  - `createConnectedAccount` accepts `service: mastodon` with `instanceUrl`. Connecting the same account again refreshes its token.
  - New `editConnectedAccountPostSettings` mutation.
  - `ConnectedAccount.username` and post settings are exposed to admins.
  - The schema dump is updated.
- **Feature flag:** everything is behind `MICROBLOGGING_POSTS` (off by default).

This does not touch the deprecated Twitter channel. Bluesky isn't included, but it only needs another `MicrobloggingService` implementation. The pipeline, texts and settings UI are service-agnostic, so it's a self-contained follow-up. I'm happy to keep the issue open for it if you prefer.

Frontend: opencollective/opencollective-frontend PR "feat(settings): connect a Mastodon account for automated posts".

## How to test

1. Set `MICROBLOGGING_POSTS=true`.
2. On a Mastodon server, go to Preferences > Development > New application, select the `write:statuses` and `profile` scopes (`read:accounts` before Mastodon 4.3), and copy the access token.
3. As a collective admin, run `createConnectedAccount(account: { slug: "…" }, connectedAccount: { service: mastodon, instanceUrl: "mastodon.social", token: "…" })`, or use the new "Automated posts" settings page.
4. Make a contribution to the collective. A thank-you post is published.
5. For monthly stats: `npm run script cron/monthly/microblogging-monthly-stats.ts`.

Unit tests, with the Mastodon API mocked with nock:

    npx mocha test/server/lib/microblogging/mastodon.test.ts test/server/lib/microblogging/posts.test.ts test/server/lib/microblogging/index.test.ts
    45 passing

## Payment

This implements the goals of the OFiTech "Fediverse friendly Open Collective" fund, whose funds are "disbursed transparently to community members working toward those goals". I'm requesting payment for this work from that fund when it's merged. I'll submit an expense at https://opencollective.com/fediverse-friendly-open-collective/expenses/new referencing this PR and the frontend PR.
```

### PR 2, opencollective/opencollective-frontend

**Title:** `feat(settings): connect a Mastodon account for automated posts`

**Body:**
```markdown
Resolve https://github.com/opencollective/opencollective/issues/7138
Closes opencollective/opencollective#7138
Require <link to the opencollective-api PR "feat(connected-accounts): automated Mastodon posts for collectives">

# Description

Adds an **Automated posts** settings section, the "UI for creating the connection" from the issue. Collectives, funds, projects, events and organizations can connect a Mastodon account and choose what gets posted:

- thanks to new financial contributors
- contributor milestones (10, 25, 50, 100…)
- monthly stats (received, spent, new contributors, balance)

The connect form takes the Mastodon server and an access token. It explains which scopes to select and links straight to the server's "New application" page.

Each connected account shows its handle and who connected it, with a switch per post type and a Disconnect button. If Mastodon revoked the token, the account shows a warning and can be reconnected by submitting a new token.

The section is behind a new `MASTODON_POSTS` preview feature: closed beta for platform accounts, always on in dev. This matches the `MICROBLOGGING_POSTS` feature flag on the API.

`lib/graphql/schemaV2.graphql` and the generated types are updated for the new API fields. Language files were rebuilt with `npm run build:langs`.

Checks: `tsc --noEmit` passes, ESLint and Prettier are clean on the changed files, and `ts-unused-exports` reports nothing.

# Payment

This is part of the work funded by the OFiTech "Fediverse friendly Open Collective" fund. I'm requesting payment for it from that fund when it's merged, through an expense at https://opencollective.com/fediverse-friendly-open-collective/expenses/new referencing both PRs.
```
