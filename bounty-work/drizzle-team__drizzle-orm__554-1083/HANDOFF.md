# HANDOFF: drizzle-team/drizzle-orm #554 + #1083, custom type `selectFromDb` (Algora $30 + $30)

**Status:** HANDOFF, as an update to our existing open PR #6445. No new PR: this pushes one follow-up commit to the same branch.

## Links

- **Issues** (both OPEN, no assignee):
  - https://github.com/drizzle-team/drizzle-orm/issues/554, "Allow wrapping the column in custom SQL for custom types"
  - https://github.com/drizzle-team/drizzle-orm/issues/1083, "[FEATURE]: Default select for custom types"
- **Bounties:** https://algora.io/Seated/bounties?status=open (sponsor john-griffin / Seated). Read on 2026-10-08:

  | Issue | Amount | Status | Claims |
  |---|---|---|---|
  | drizzle-orm#1083 | $30 | open | 1 |
  | drizzle-orm#554 | $30 | open | 1 |

  - The board shows "Completed 0" for this sponsor: no payout history either way.
  - Payout is through Algora on merge, using `/claim #N` in the PR body.
- **Our carrier:** https://github.com/drizzle-team/drizzle-orm/pull/6445
  - Branch `woahwhattheheck:feat/select-from-db-custom-types`. Opened 2026-10-06, head `fc55cb4d`, which sits on `main@15454dbe`.
  - The body has `/claim #1083` and asks the sponsor about #554.
  - No maintainer review yet.
- **Base:** `main@15454dbe49d827c6081f3d0231e2e7985e517295`. The carrier head `fc55cb4d` is directly on it.
- **Submit as:** woahwhattheheck, by pushing to the existing PR branch.

## Files in this directory

| File | What it is |
|---|---|
| `fix.patch` | The follow-up commit (`ee3c5d2c`, author woahwhattheheck). It applies on top of the PR #6445 head `fc55cb4d`. |
| `full-series.patch` | Both commits (#6445's commit plus this follow-up) against `main@15454dbe`, for applying from scratch. |
| `HANDOFF.md` | This file. |

Both patches were checked with `git am` on clean worktrees, and both produce the identical tree.

## What was wrong in #6445 (verified)

Our carrier already covered most of the feature in all five dialects:

- plain and joined selects
- RETURNING clauses
- relational-query JSON payloads
- no double-wrap through subqueries and CTEs

New regression tests found two concrete defects, failing on `fc55cb4d`.

**1. Query-built views were transformed twice.**

- A view defined as `pgView('v').as(qb => qb.select().from(places))` already applies `selectFromDb` inside its own query (the view's SQL definition).
- Selecting from it applied the mapper again, e.g. `select ST_AsText("geo") as "geo" from "places_view"`, which is `ST_AsText(ST_AsText(geom))` at runtime.
- This affected pg views and materialized views, MySQL, SQLite and Gel.
- Root cause: #6445 only treated subquery and CTE sources as already transformed ("materialized"), not query-built views.

**2. MySQL PlanetScale-mode relational queries skipped the mapper.**

- `buildRelationalQueryWithoutLateralSubqueries` builds nested `json_array(...)` with bare column identifiers. The planetscale-serverless driver uses this path, as does mysql2 with `mode: 'planetscale'`.
- The result was `json_array(\`id\`, \`owner_id\`, \`geo\`)` with no mapping, unlike the default (lateral) mode.

## Change (follow-up commit)

- `alias.ts`: `ColumnAliasProxyHandler` takes an `isSelectionField` flag. For such projected columns, `selectFromDb` reads as `undefined`, so `mapColumnSelection` leaves them as they are.
- `selection-proxy.ts`: a new `isSelectionField` config option is passed to the column proxies.
- **Query-built view builders** set `isSelectionField: true`:
  - `pg-core/view.ts`: view and materialized view
  - `gel-core/view.ts`: view and materialized view
  - `mysql-core/view.ts`
  - `sqlite-core/view.ts`
  - `singlestore-core/view.ts` (views are currently commented out of the SingleStore exports; included for consistency)
- **Manual views are unchanged.** Views declared with raw SQL and explicit columns still apply the mapper, because they return the raw database value. A test covers this.
- `mysql-core/dialect.ts`: the PlanetScale-mode nested `json_array` now applies `mapColumnSelection`, matching the lateral path.
- `tests/select-from-db.test.ts`: 4 new regression tests (query-built pg views and materialized views and joins, raw-SQL views still mapped, MySQL and SQLite query-built views, PlanetScale-mode nested relations). The file now has 18 tests.

```
 drizzle-orm/src/alias.ts                 |  8 ++-
 drizzle-orm/src/gel-core/view.ts         |  2 +
 drizzle-orm/src/mysql-core/dialect.ts    |  2 +-
 drizzle-orm/src/mysql-core/view.ts       |  1 +
 drizzle-orm/src/pg-core/view.ts          |  2 +
 drizzle-orm/src/selection-proxy.ts       | 11 ++++
 drizzle-orm/src/singlestore-core/view.ts |  1 +
 drizzle-orm/src/sqlite-core/view.ts      |  1 +
 drizzle-orm/tests/select-from-db.test.ts | ~100 +++
```

## Validation (focused)

```
pnpm install --filter ./drizzle-orm --frozen-lockfile --ignore-scripts
cd drizzle-orm
```

| Check | Result |
|---|---|
| `npx vitest run tests/select-from-db.test.ts` on `fc55cb4d`, new tests added | 3 failed, 15 passed. The failures are the two defects above (double-wrapped views in pg, MySQL and SQLite; unmapped `geo` in the PlanetScale nested JSON). |
| `npx vitest run tests/select-from-db.test.ts` after the fix | **18 passed (18)** |
| `npx vitest run tests/select-from-db.test.ts tests/casing tests/relation.test.ts` (regressions for the alias/selection proxies and RQB) | 77 passed |
| `npx tsc --noEmit -p tsconfig.build.json` | No errors in changed or related files. The only errors are pre-existing `src/prisma/*`, because the Prisma client is not generated without `pnpm p`. |
| `npx dprint@0.46.2 check <changed files>` | Clean |

In the regression run, two SQLite casing files cannot load because the `better-sqlite3` native bindings are absent (install ran with `--ignore-scripts`). They fail the same way on the unmodified head.

## Competition (code-level comparison, same tests run against each PR head)

We ran our 18-test file plus 13 extra probes against each PR's head:

- the extra probes: subquery join, aliased table, union, CTE over INSERT…RETURNING, RQB one() and partial columns, SQLite nested RQB and RETURNING and subquery, MySQL lateral nested RQB and subquery join, SingleStore
- 2 of the 13 probes were wrong in our own probe file, the same for every PR

| PR | Author / date | Claims | Our 18 tests | Extra probes | Review state |
|---|---|---|---|---|---|
| **#6445 + this follow-up (ours)** | woahwhattheheck, 2026-10-06 | `/claim #1083` (+ #554 in the updated body below) | **18/18** | 11/11 valid | No maintainer review |
| #6445 before the follow-up | | | 15/18 (views, PlanetScale) | 11/11 | |
| #6387 | lecsetsuna16, 2026-09-27 | `/claim #1083` only | 18/18 | 11/11 | No maintainer review |
| #6425 | aipd506, 2026-10-03 | `/claim #554`, `/claim #1083` | 12/18 | 2/11 | Our earlier review comment lists the gaps |

#6425's failures:

- double-wraps subquery, CTE, INSERT…RETURNING-CTE and view outputs
- no mapping in pg, SQLite or MySQL nested RQB JSON
- no mapping in PlanetScale mode

**How ours compares to #6387.** After this follow-up, #6445 matches #6387 on every behaviour we tested. #6387 was opened earlier and has more tests (31 new). Where ours differs:

- #6445 closes and claims **both** #1083 and #554 (#6387 claims only #1083).
- Its mapper is a single `mapColumnSelection` helper used everywhere.
- Every gap found in review now has a named regression test.

There are no maintainer reviews on any of the three PRs, and the bounties are still open on Algora.

Fleet context (Slack, last 7 days):

- #6445 is the fleet's existing carrier (claim registration op `DRIZZLE6445-COMPENSATION-REGISTRATION-20261008` added `/claim #1083` to the body).
- Earlier coordination notes say Algora registers claims from PR-body events and keeps the first command per issue.

## How to apply

```
git clone https://github.com/woahwhattheheck/drizzle-orm && cd drizzle-orm
git checkout feat/select-from-db-custom-types        # PR #6445 head fc55cb4d
git am /path/to/fix.patch
git push origin feat/select-from-db-custom-types      # updates PR #6445
```

(From scratch on upstream main instead: `git checkout -b feat/select-from-db-custom-types origin/main && git am full-series.patch`.)

---

## Ready-to-paste PR #6445 title and body (update)

**Title:** `feat: add selectFromDb hook to custom types (all dialects)`

**Body:**

~~~markdown
Closes #1083
Closes #554

Adds an optional `selectFromDb` hook to `customType` in pg-core, mysql-core, sqlite-core, singlestore-core and gel-core, so a custom column can wrap its SQL whenever it is read, e.g. PostGIS:

```ts
const point = customType<{ data: { x: number; y: number }; driverData: string }>({
	dataType: () => 'geometry(Point,4326)',
	selectFromDb: (column) => sql`ST_AsText(${column})`,
	fromDriver: (value) => parsePoint(value),
});
```

The wrapped expression is aliased back to the column name, so `fromDriver` still decodes the value; `toDriver`, inserts, updates, filters and ordering are unchanged.

### Where it applies
- `select` field lists (single table, joins, partial selects) and set operations
- `returning` clauses (insert / update / delete)
- relational queries (`db.query.*.findMany/findFirst`), including nested relations in the JSON payloads: pg, mysql (default and PlanetScale mode), sqlite, gel

### Where it does not re-apply
Values that were already read through the hook are not wrapped a second time:
- columns of subqueries (`.as('sq')`) and CTEs (`$with`), including CTEs over `insert … returning`
- columns of query-built views (`pgView('v').as((qb) => …)`, materialized views, mysql/sqlite views)

Views declared with raw SQL and explicit columns still apply the hook, since they return the raw database value.

### Tests
`drizzle-orm/tests/select-from-db.test.ts`: 18 SQL-generation tests across all dialects. They cover plain/joined/partial selects, returning, subquery/CTE/view no-double-wrap, raw-SQL views, nested relational JSON (pg; mysql default and PlanetScale mode) and decoding.
- `vitest run tests/select-from-db.test.ts` → 18 passed
- `vitest run tests/casing/pg-* tests/casing/mysql-* tests/casing/casing.test.ts tests/relation.test.ts` → passing
- `tsc --noEmit` and `dprint check` clean on the changed files

/claim #1083
/claim #554

This PR implements both #1083 and #554 (they ask for the same `selectFromDb` capability). I'd like to claim both Algora bounties ($30 each) and request the payout on merge. @john-griffin, thank you for sponsoring these.
~~~

## Remaining work

None required for the feature.

- **Optional:** if maintainers want docs on drizzle's website, the `selectFromDb` section goes in the custom types page of `drizzle-team/drizzle-orm-docs` (a separate repo).
- **Optional:** an integration test against a real PostGIS container in `integration-tests/`.
