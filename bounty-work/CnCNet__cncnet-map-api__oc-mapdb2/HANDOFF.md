# HANDOFF: CnCNet MapDB 2.0 map browser backend (Open Collective, $500)

**Status:** HANDOFF. A working backend increment is ready for submission. The remaining spec items are listed at the end.

| | |
|---|---|
| Target repo | https://github.com/CnCNet/cncnet-map-api (Django + DRF, AGPL-3.0). This is the MapDB 2.0 backend and is deployed to mapdb.cncnet.org by `.github/workflows/cd.yml`. |
| Bounty | Open Collective project **New Map Database & Browser**: https://opencollective.com/cncnet/projects/new-map-database-and-browser |
| Amount | $500 USD. Balance $500.00, received $500.00 (sponsored by RAZER, contribution #708706, 2023-11-09), $0 disbursed. Verified 2026-10-08 via the OC GraphQL API. |
| Platform | Open Collective. CnCNet's fiscal host is Open Source Collective. Payout is an expense submitted on the project after merge. |
| GitHub issue | None. The project is specified on the OC page, and development is discussed in a CnCNet Discord thread: https://discord.com/channels/188156159620939776/1081288915790598225 |
| Base | `CnCNet/cncnet-map-api` `main@c454e5b5940097591873bffb36df52ef24143815` |
| Patch | `fix.patch`: 1 commit, 16 files, +1204/-26. Author: woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com> |
| Apply | `git checkout main && git am fix.patch` |

## Payout evidence (CnCNet pays project expenses on Open Collective)

From `api.opencollective.com/graphql/v2`, `expenses(account:{slug:"cncnet"}, includeChildrenExpenses:true)`:

- Expense **#279035**, **$650.00, PAID**, invoice to Kerbiter, 2025-12-25: "Implemented Ares / Phobos / new spawner into the live build of CnCNet Yuri's Revenge". It was paid from the project sub-account `ares-phobos-new-spawner-to-cncnet-yr-online`, and it's the same pattern this bounty would use.
- Expense #275266 ($625, 2025-11-28, same project, Kerbiter) was **REJECTED** and then replaced by #279035. Admins push back on expenses they consider premature and pay the resubmission.
- Infrastructure receipts (DigitalOcean, Cloudflare, domains) are paid regularly through 2026-08.
- Project admins: Tore, CCHyper, neogrant, Rampastring.

## What the OC spec asks for, and what this patch covers

| OC spec item | State on `main` before this patch | This patch |
|---|---|---|
| Upload needs a CnCNet account | Done (ladder JWT, `CanUpload`) | n/a |
| Compatible with the old client | Done (`/upload`, `/<game>/<sha1>.zip`, `/search`) | Legacy downloads now count toward popularity. **Banned maps now return 404 on the legacy route.** Before, a banned cheat map stayed downloadable by sha1 from lobbies. |
| Sort by popularity, trending, creation date, update date | **Broken / missing.** `ordering_fields` used `cnc_map_file__*`, which isn't a field on `CncMap`, so `?ordering=cnc_map_file__width` returned **HTTP 500 (FieldError)**. There was no download tracking and no default order. | `CncMap.download_count` plus per-day `CncMapDownloadStat`. `?ordering=popular\|trending\|newest\|updated`, plus `map_name`, `created`, `modified`, `download_count`, `trending_download_count`, `latest_file_created/width/height`. Defaults to newest, with an `id` tie-breaker so pages are stable. |
| Filter by game mode, tags, author, size, etc. | Only `categories` (by UUID) and game | Adds `category_slug` (repeatable), `author` (username, case-insensitive), `cnc_user_id`, `min/max_width`, `min/max_height` (newest file version), `created_after/before`. `is_reviewed` is exposed for curated lists. |
| Moderators/admins can hide, edit, delete | Ban and delete worked. **Edit was broken:** `PATCH /maps/<id>/` returned **HTTP 500 (`NotImplementedError: update() must be implemented`)**. | Implements `update()` with an editable-field whitelist. Authors can edit name, description, categories, `is_published`, and `incomplete_upload`. Only staff can set `is_reviewed` (curation). Staff edits of other users' maps are recorded in `moderated_by` / `moderator_notes`. Hiding is `is_published=false` or ban. |
| API for list, search, details, downloads | List, search, and details existed. Downloads only via the legacy sha1 route. | `GET /maps/<id>/download/[?version=N]` uses the same visibility rules as the detail view, so banned or unpublished maps are only available to their owner and staff. Results now include `download_count` and `cnc_user_name`. |
| Anonymous client-shared maps aren't kept long ("still in debate") | Not implemented | Opt-in `manage.py purge_temporary_maps --days N [--dry-run]`. It deletes old temporary uploads that weren't downloaded in the window, along with their files. It keeps banned maps (so their hashes still block re-uploads) and maps that another map credits as parent. Nothing schedules it. |
| `map_id` written into the map file | Done (`[CnCNet] ID=`) | n/a |
| Previews parsed from map files | Done | n/a |
| Mix files linked to maps | Not implemented | Not in this patch. See remaining work. |
| Future 3D game support | Models are game-scoped | n/a |

## Root causes of the two bugs fixed along the way

1. **Map edit 500.** `MapRetrieveUpdateView` (`PATCH /maps/<uuid>/`) uses `CncMapBaseSerializer`, which defined `create()` but not `update()`, so DRF raised `NotImplementedError`. The upload flow creates maps with `incomplete_upload=True` and `is_published=False`, so web-UI uploads could never be finished or published. Reproduced on base `c454e5b`:
   ```
   PATCH /maps/<id>/ -> 500  NotImplementedError: `update()` must be implemented.
   ```
2. **Ordering 500.** `MapListView.ordering_fields` listed `cnc_map_file__created/width/height`. The reverse relation is `cncmapfile`, and ordering by it would also duplicate rows for maps with several versions. Reproduced on base:
   ```
   GET /maps/search/?ordering=cnc_map_file__width -> 500  FieldError: Cannot resolve keyword 'cnc_map_file' into field.
   ```
   The fix annotates the newest file version with subqueries (`latest_file_*`) instead of joining, so pagination counts and download sums aren't inflated.

## Files changed

- `kirovy/models/cnc_map.py`: `CncMap.download_count`, `CncMap.record_download()`, and a new `CncMapDownloadStat` (unique per map per day; race-safe increment using update-then-create with an `IntegrityError` fallback).
- `kirovy/migrations/0022_cncmap_download_count_cncmapdownloadstat.py`: additive only (new column with default 0, new table). `makemigrations --check` reports no drift.
- `kirovy/models/moderabile.py`: `record_moderator_action()`, used for non-ban moderation events.
- `kirovy/serializers/cnc_map_serializers.py`: writable `category_ids`, staff-only `is_reviewed`, read-only `download_count` and `cnc_user_name`, `Meta.editable_fields`, and `update()` (saves with `update_fields`, so a stale instance can't reset counters).
- `kirovy/views/cnc_map_views.py`: `get_maps_visible_to_request()` (shared by detail and download), `annotate_latest_map_file()`, `annotate_trending_download_count()`, the new `MapListFilters` fields, `MapOrderingFilter` (aliases, annotates lazily, `id` tie-breaker), `MapRetrieveUpdateView.perform_update()`, `MapDownloadView`, and legacy download counting plus the banned-map 404.
- `kirovy/urls.py`: `maps/<uuid:pk>/download/`.
- `kirovy/settings/_base.py`: `MAP_TRENDING_WINDOW_DAYS` (env var, default 7).
- `kirovy/management/commands/purge_temporary_maps.py`: new command.
- `docs/map_browser.md`: API documentation for the UI and client integrators.
- Tests: `tests/test_views/test_map_browser.py` (15), `tests/test_views/test_map_download.py` (12), `tests/test_views/test_map_edit.py` (8), `tests/test_commands/test_purge_temporary_maps.py` (3).

## Validation (focused only)

Environment: Python 3.12 venv with `requirements-dev.txt` (psycopg2-binary locally) and a private PostgreSQL 16 on port 55433, with the env from `ci.env` and `POSTGRES_TEST_HOST=127.0.0.1 POSTGRES_PORT=55433`.

```
$ python -m pytest -q tests/test_views/test_map_browser.py tests/test_views/test_map_download.py \
    tests/test_views/test_map_edit.py tests/test_commands/test_purge_temporary_maps.py
38 passed in 4.71s

# directly related regressions (search, upload, legacy compat, delete, ban, map model)
$ python -m pytest -q tests/test_views/test_search_view.py tests/test_views/test_map_upload.py \
    tests/test_views/test_backwards_compatibility.py tests/test_views/test_map_delete.py \
    tests/test_views/test_ban_view.py tests/models/test_cnc_map.py
28 passed in 3.92s

$ DJANGO_SETTINGS_MODULE=kirovy.settings.testing python manage.py makemigrations --check --dry-run kirovy
No changes detected in app 'kirovy'

$ black --check <15 changed .py files>   # black 25.1.0, matching .pre-commit-config.yaml
15 files would be left unchanged.
```

Not run: the full test suite (by policy), and `tests/test_jwt.py`, which needs real ladder credentials. `schema.yml` was not regenerated because it was already stale on `main` (554 diff lines before this change). The maintainers regenerate it.

## Competition and coordination (facts)

- **alexlambson** is the primary MapDB 2.0 developer. He authored most of the ~45 merged PRs since #1 (2023-11-12, the same week the OC project was funded), most recently #43 (2026-02-22). Other contributors: rohsyl, GrantBartlett, brichardson1991 (#46), 11EJDE11 (#44, and draft #45 for sync logs, unrelated to this patch).
- No open PR touches sorting, filters, downloads, map editing, or purging. Open PR #45 adds a separate sync-log feature. Open issue #6 (ALLOWED_HOSTS) is unrelated.
- The OC project has disbursed $0. It's possible the project budget is earmarked for the main developer. The Discord draft below asks the admins how they want to split payment before an expense is filed.
- No other fleet agent had a TAKE on this target (Slack search for "cncnet" / "mapdb" returned nothing). TAKE: https://tokenjunkielabs.slack.com/archives/C0BVANHNB26/p1791438864611149

## Remaining work (exact plan, for follow-up PRs)

1. **Mix files linked to maps** (spec item). Add a `CncMapMixFile(CncNetFileBaseModel)` with FK `cnc_map`, an `ALLOWED_EXTENSION_TYPES` of `{"mix"}` (needs a `CncFileExtension` row in a data migration), and an upload view built on `FileUploadBaseView` like `MapImageFileUploadView` (owner or staff only, size limit around 25 MB). Expose `mix_files` in `CncMapBaseSerializer` and add `GET /maps/<id>/mix/<file_id>/download/`. Tests should mirror `test_map_image_view.py`.
2. **Tags separate from game modes.** Categories already act as tags. If maintainers want free-form tags, add a `MapTag` M2M with staff-managed tags and a `tag` filter like `category_slug`.
3. **Download de-duplication.** Optionally rate-limit counting per IP per map per day, for example with a Django cache key `dl:{map_id}:{sha256(ip)}:{date}` and a 24 h TTL. That stops `popular` and `trending` from being inflated by repeat requests, without storing IPs in the database.
4. **Client integration.** xna-cncnet-client can switch from `/<game>/<sha1>.zip` to `/maps/search/?game_slug=yr&ordering=trending` and `/maps/<id>/download/` once the UI ships. The legacy routes stay.
5. **UI.** The README points to `CnCNet/cncnet-map-ui`, which returns 404 publicly (private or not created yet). The sort dropdown and filter sidebar map 1:1 onto `docs/map_browser.md`.
6. Regenerate `schema.yml` (`manage.py spectacular --file schema.yml`) when the maintainers next refresh it.

---

## Ready-to-paste PR

**Title:** `feat: Map browser sorting, filters, downloads, and map editing`

**Body:**

```markdown
## Summary

Backend features for the MapDB 2.0 map gallery described in the CnCNet Open Collective project
[New Map Database & Browser](https://opencollective.com/cncnet/projects/new-map-database-and-browser):
popular, trending, newest, and updated sorting; author, game mode, size, and date filters; a download API;
working map edits with staff curation; and an opt-in cleanup for old anonymous lobby uploads.

There is no GitHub issue for this project. The spec is the Open Collective page and the Discord dev thread.
This PR implements the sorting, filtering, download API, and moderation items from that spec.

### Changes

- **Download tracking**: adds `CncMap.download_count` (all time) and `CncMapDownloadStat` (one row per map per day).
  Both are incremented with `F()` expressions, so concurrent downloads are all counted, and nothing about the downloader
  is stored.
- **`GET /maps/<id>/download/[?version=N]`**: downloads the newest (or a specific) map file. Visibility matches the detail
  endpoint, so banned and unpublished maps are only available to their owner and staff.
- **Legacy `/<game>/<sha1>.zip`**: unchanged for clients, except that downloads are now counted and **banned maps return
  404**. Before, a banned cheat map stayed downloadable from lobbies by sha1.
- **`/maps/search/` sorting**: adds `?ordering=popular|trending|newest|updated`, plus `map_name`, `created`, `modified`,
  `download_count`, `trending_download_count`, and `latest_file_created/width/height`. The default is newest first, with
  an `id` tie-breaker so pages are stable. Trending uses `MAP_TRENDING_WINDOW_DAYS` (env, default 7).
- **Fixes a 500**: ordering by the old `cnc_map_file__*` fields raised `FieldError`, because they aren't fields on
  `CncMap`. The newest file version is now annotated with subqueries, so maps with several versions don't produce
  duplicate rows.
- **`/maps/search/` filters**: adds `category_slug` (repeatable), `author` (case-insensitive username), `cnc_user_id`,
  `min/max_width`, `min/max_height` (newest file version), and `created_after/before`.
- **Fixes a 500**: `PATCH /maps/<id>/` raised `NotImplementedError` because `CncMapBaseSerializer` had no `update()`.
  Authors can now edit `map_name`, `description`, `category_ids`, `is_published`, and `incomplete_upload`. Only staff can
  set `is_reviewed`, for curated lists. When staff edit someone else's map, `moderated_by` and `moderator_notes` are
  updated. `update()` saves with `update_fields`, so a stale instance can't reset `download_count`.
- **`manage.py purge_temporary_maps --days N [--dry-run]`**: opt-in cleanup for anonymous lobby uploads. It deletes
  temporary maps older than N days that weren't downloaded in that window, along with their files. It keeps banned maps
  (their hashes keep blocking re-uploads) and maps that other maps credit as their parent. Nothing schedules it.
- **Docs**: `docs/map_browser.md`.

The migration is additive: one new column with default 0, and one new table.

### Tests

New: `tests/test_views/test_map_browser.py`, `tests/test_views/test_map_download.py`,
`tests/test_views/test_map_edit.py`, and `tests/test_commands/test_purge_temporary_maps.py` (38 tests).

    pytest tests/test_views/test_map_browser.py tests/test_views/test_map_download.py \
      tests/test_views/test_map_edit.py tests/test_commands/test_purge_temporary_maps.py   # 38 passed
    pytest tests/test_views/test_search_view.py tests/test_views/test_map_upload.py \
      tests/test_views/test_backwards_compatibility.py tests/test_views/test_map_delete.py \
      tests/test_views/test_ban_view.py tests/models/test_cnc_map.py                       # 28 passed
    python manage.py makemigrations --check                                                # No changes detected

### Not in this PR

Linking mix files to maps, free-form tags beyond categories, and per-IP download de-duplication. I'm happy to
follow up with these.

### Bounty

This PR is submitted for the CnCNet Open Collective project **New Map Database & Browser**
(https://opencollective.com/cncnet/projects/new-map-database-and-browser). I'm claiming this bounty: on merge, I'll
submit an expense on that project for this work and request payout from the project budget, in whatever amount the
project admins agree on for the parts of the spec this PR covers.
```

---

## Open Collective payout: exact steps after merge

1. Sign in to Open Collective as the woahwhattheheck payee account (create one at https://opencollective.com/create-account if needed) and add a payout method: PayPal, or bank transfer via Wise (the host is Open Source Collective).
2. Open the project expense form: https://opencollective.com/cncnet/projects/new-map-database-and-browser/expenses/new. You can also go to the project page and click **Submit Expense**. Make sure the expense goes to the **project** (`new-map-database-and-browser`), not the parent `cncnet` collective, so it's paid from the $500 project balance.
3. Choose **Invoice** (for work done, not a receipt).
4. Fill in:
   - Title: `MapDB 2.0: map browser sorting, filters, downloads, map editing (CnCNet/cncnet-map-api#<PR number>)`
   - Line item: description `Implemented popular/trending/newest/updated sorting, author/game-mode/size/date filters, map download API with download tracking, map edit + staff curation, temporary map purge; merged in CnCNet/cncnet-map-api#<PR number>`, amount `<agreed USD amount, up to 500.00>`
   - Attach or link the merged PR URL.
   - Payout method: the one from step 1.
5. Submit, then post the expense link in the Discord dev thread so an admin (Tore, CCHyper, neogrant, or Rampastring) approves it. Open Source Collective pays approved expenses in its regular payout batches, usually within a few business days.
6. If an admin rejects the expense with a note, as they did with #275266 for Kerbiter, adjust the amount or description and resubmit. That's the same path that led to the paid #279035.

## Discord coordination message (draft)

Post in the MapDB 2.0 dev thread: https://discord.com/channels/188156159620939776/1081288915790598225

> Hi @alexlambson @Tore, I put together a backend PR for cncnet-map-api that covers the map browser items from the "New Map Database & Browser" Open Collective project: popular/trending/newest/updated sorting with download tracking (the legacy `/<game>/<sha1>.zip` route counts too), author/game-mode/size/date filters, a `GET /maps/<id>/download/` endpoint, and a fix for `PATCH /maps/<id>/` (it currently 500s because the map serializer has no `update()`), plus staff-only `is_reviewed` for a curated list. It also makes banned maps 404 on the legacy download route, and adds an opt-in `purge_temporary_maps` command for old lobby uploads. Everything is documented in `docs/map_browser.md`, the migration is additive, and there are 38 new tests. PR: <link>.
> I'd like to claim part of the OC project budget for this once it's merged. How would you like to split it with the ongoing MapDB 2.0 work? I'm happy to take mix-file linking next if that's useful.
