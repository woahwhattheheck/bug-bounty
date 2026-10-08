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

This contribution builds on alexlambson's existing MapDB 2.0 backend and the other project contributors' work.
The project's advertised $500 balance is shared project funding; the requested amount for this contribution is subject to the project admins' agreement.

This PR is submitted for the CnCNet Open Collective project **New Map Database & Browser**
(https://opencollective.com/cncnet/projects/new-map-database-and-browser). I'm claiming this bounty: on merge, I'll
submit an expense on that project for this work and request payout from the project budget, in whatever amount the
project admins agree on for the parts of the spec this PR covers.
