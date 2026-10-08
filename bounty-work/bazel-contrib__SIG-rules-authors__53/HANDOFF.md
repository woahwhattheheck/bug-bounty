# HANDOFF: bazel-contrib/SIG-rules-authors#53, GitHub traffic scraper ($1,000, Open Collective)

Status: **HANDOFF, ready for submission**

| Field          | Value |
| -------------- | ----- |
| Issue          | https://github.com/bazel-contrib/SIG-rules-authors/issues/53 "[catalog] Write a script that scrapes the GH traffic API" (open, opened by alexeagle 2022-08-09, label `bounty-1000USD`, Rules SIG Tracker: "Needs Assignment", no assignee) |
| Bounty         | $1,000 USD, from the `bounty-1000USD` label ("A contributor who completes this will be rewarded $1000") |
| Platform       | Open Collective: https://opencollective.com/bazel-rules-authors-sig (the SIG's fiscal account, linked from the repo README and `.github/FUNDING.yml`) |
| Patch          | `fix.patch` (1 commit, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`) |
| Base           | `bazel-contrib/SIG-rules-authors` `main@a8849531cb1ed2c783211791d44fb6d07f6d4c61` |
| Submit as      | woahwhattheheck |

## Payout evidence (Open Collective GraphQL API, read 2026-10-08)

`https://api.opencollective.com/graphql/v2`, account `bazel-rules-authors-sig`: balance **$34,521.10 USD**, 45 expenses. The SIG pays `bounty-1000USD` issues through Open Collective expenses:

- 2026-02-25 PAID $1,000 to markus-hofbauer: "Flip default for --incompatible_no_implicit_file_export ... to resolve https://github.com/bazel-contrib/SIG-rules-authors/issues/41"
- 2025-11-24 PAID $1,000 to markus-hofbauer: "Flip default for --incompatible_strict_action_env ... to resolve https://github.com/bazel-contrib/SIG-rules-authors/issues/42"
- 2024-10-24 PAID $1,000 to xavier-bonaventura: "Bounty for flipping disallow empty glob"

There are no rejected bounty expenses. The only rejected expenses are a dinner and a venue deposit.

## Placement facts for the submitter

- The issue (quoting @meteorcloudy) suggested a PR to **bazelbuild/bazel_metrics**. That repo was **archived on 2024-08-03** and is read-only. GitHub shows the banner "This repository was archived by the owner on Aug 3, 2024", its last commit was 2023-05-31, and it has never had a PR. A PR there is no longer possible.
- The SIG's own repo has also been quiet since 2023. The last commit on `main` of `bazel-contrib/SIG-rules-authors` is 2023-04-13 ("Cleanup (#79)"). Its issue tracker and Open Collective bounty payouts are active through 2026, per the list above.
- So the patch targets the issue's own repo, under `tools/github_traffic/`. This follows the precedent of PR #78, which put tooling for this same issue under `experimental/` in this repo and is marked "Updates #53".
- The submitter can confirm the placement with the SIG on Bazel Slack `#rules`, at bazel-contrib@googlegroups.com, or with the SIG leads (Alex Eagle, Helen Altshuler, Keith Smiley). The PR body below already says the code can move wherever the SIG prefers. The tool is self-contained (one stdlib-only Python file plus a workflow), so moving it to another repo or path is a `git mv`.

## Issue summary and what was built

The issue asks for three things:

1. A script that reads the GitHub traffic API.
2. A process for someone with push access to run it on a cadence.
3. A simple place, such as a Gist, to publish the data for the SIG to ingest.

GitHub only shows traffic to accounts with push access, and only for the last 14 days.

All three are delivered:

1. **Script**: `tools/github_traffic/github_traffic.py` (Python 3.8+, standard library only).
   - It reads all four documented traffic endpoints: `/traffic/views?per=day`, `/traffic/clones?per=day`, `/traffic/popular/referrers` and `/traffic/popular/paths`. It sends `X-GitHub-Api-Version: 2022-11-28`.
   - The token comes **only from the environment**: `$GITHUB_TRAFFIC_TOKEN`, then `$GITHUB_TOKEN`, then `$GH_TOKEN`, or the variable named with `--token-env`. It is never taken from argv.
   - Repositories come from `--repo`, a `--repos-file` (one per line, `#` comments) or `--org`. With `--org` it collects public, non-archived, non-fork repos the token can push to, using the `permissions` field. `--match REGEX` narrows the list, and `--include-private`, `--include-archived` and `--include-forks` widen it.
   - It merges each 14-day window into CSV history:
     - `views.csv` and `clones.csv` are daily series. When runs overlap, the larger value for a day is kept, so the partial current day is completed by later runs and a re-run never lowers a value.
     - `summary.csv`, `referrers.csv` and `paths.csv` are dated snapshots of GitHub's 14-day totals. Unique visitors cannot be added up across days, which is why the snapshots exist.
   - Rows are sorted so diffs stay stable.
   - It handles pagination, with a guard so the token is never sent off the API host, and primary and secondary rate limits (`x-ratelimit-reset` and `retry-after`, capped backoff). Connection errors and 5xx responses are retried with backoff.
   - A 403 for missing push access is reported per repo with a hint naming the required fine-grained permission ("Administration: Read"). The other repos are still saved, and the exit code is 1. Configuration errors exit with 2.
   - It prints a 14-day totals table (views, visitors, clones, cloners) per repo.
2. **Process**: `.github/workflows/github_traffic.yaml` runs daily at 06:17 UTC and on demand.
   - It only runs in `bazel-contrib/SIG-rules-authors` and is a no-op (notice, exit 0) until the `TRAFFIC_TOKEN` secret is set.
   - It is configured with the `TRAFFIC_GIST_TOKEN` secret and the `TRAFFIC_GIST_ID`, `TRAFFIC_ORG` (default `bazelbuild`) and `TRAFFIC_MATCH` variables.
   - It uploads the CSVs as a 90-day artifact and writes the totals table to the run summary.
   - The README also documents a one-line cron entry, for a Googler who prefers to run it locally.
3. **Publishing**: `--gist-id`. The script reads the CSVs already in the Gist (fetching `raw_url` when the API truncates large files), merges the new data and PATCHes back only the changed files.
   - The Gist always holds the full history, so runs are stateless.
   - The Gist token can be separate (`$GIST_TOKEN`), because Gists are user-owned.
   - Consumers read `https://gist.githubusercontent.com/<owner>/<id>/raw/views.csv` with no token.
   - The raw download never carries the token.

The docs are in `tools/github_traffic/README.md`. They cover the token setup, verified against GitHub's fine-grained permission reference: traffic endpoints need the "Administration" repository permission (read), `PATCH /gists/{id}` needs the "Gists" user permission (write), and `GET /orgs/{org}/repos` needs "Metadata" (read). They also cover usage, exit codes, the output schemas, Gist publishing, the Actions settings, cron and how to run the tests. The top-level README gets a short "Tools" section linking to it.

## Files changed

```
 .github/workflows/github_traffic.yaml       |  63 +++
 .gitignore                                  |   3 +   (__pycache__/, /traffic-data/)
 README.md                                   |   6 +   (Tools section)
 tools/github_traffic/README.md              | 162 ++++++
 tools/github_traffic/github_traffic.py      | 781 ++++++++++++++++++++++++++++
 tools/github_traffic/github_traffic_test.py | 663 +++++++++++++++++++++++
 6 files changed, 1678 insertions(+)
```

## Validation (focused)

```
$ python3 tools/github_traffic/github_traffic_test.py -v        # Python 3.13.16
Ran 24 tests in 0.016s
OK
$ /usr/bin/python3.11 tools/github_traffic/github_traffic_test.py
OK
$ ruff check --isolated --select E,F,W,B tools/github_traffic/
All checks passed!
$ ruff format --check tools/github_traffic/
already formatted
$ npx -y prettier@2.4.0 --check README.md tools/github_traffic/README.md .github/workflows/github_traffic.yaml
All matched files use Prettier code style!          # repo's pre-commit pins prettier v2.4.0
$ git worktree add --detach /tmp/x origin/main && cd /tmp/x && git am fix.patch && python3 -B tools/github_traffic/github_traffic_test.py
Ran 24 tests ... OK
```

The tests use a fake transport, with no network and no token. They cover:

- API payload to rows conversion
- the daily merge (history kept, largest value wins) and the snapshot merge (same date and repo replaced)
- the CSV round trip, sorting and header validation
- the auth and API-version headers
- Link-header pagination, including refusing to follow a next link off the API host
- primary rate-limit backoff until reset, `retry-after`, giving up when the reset is too far away, and no retry on a push-access 403
- connection-error retry, and the error after retries run out
- org filtering (archived, fork, no push, `--match`, `type=public`)
- Gist load (truncated file via `raw_url`, without the token) and save (only changed files, no-op when unchanged)
- end-to-end `main()` over two consecutive days, with one repo failing on a 403 (exit 1, other data kept and merged)
- all repos failing (nothing written), the token taken only from the environment, `--token-env`, separate Gist and traffic tokens, a bad Gist ID failing before any traffic call, and an invalid `--repo` rejected before any request

Smoke checks with the real `urllib` transport:

- With no token, the script exits 2 with `error: no token found; set $GITHUB_TRAFFIC_TOKEN or $GITHUB_TOKEN or $GH_TOKEN`.
- With a token, against the proxy-blocked API, it prints a per-repo warning with the permission hint, writes nothing and exits 1.

The workflow `run:` block was extracted from the parsed YAML, passed `bash -n`, and was run locally with `bash -eo pipefail`. With no secret it prints a notice and exits 0. With a secret it propagates the script's exit code.

The live GitHub traffic API was not called from this container, because it has no push-access token and api.github.com is proxy-blocked. Optionally, before opening the PR, the submitter can check live output with any token that has push access to one of their own repos:

```
GITHUB_TRAFFIC_TOKEN=<token> python3 tools/github_traffic/github_traffic.py --repo <you>/<your-repo> --output-dir /tmp/traffic && head /tmp/traffic/*.csv
```

## How to apply

```
git clone https://github.com/bazel-contrib/SIG-rules-authors && cd SIG-rules-authors
git checkout -b feat/github-traffic-53 a8849531cb1ed2c783211791d44fb6d07f6d4c61
git am /path/to/fix.patch
```

## Competition

- **PR #78 "WIP: add rules-keeper"** (ashi009). It was opened 2023-02-07 and the last commits were on 2023-03-03. It is still open, marked WIP, with no approvals (2 are required).
  - It says "Updates #53" but is a broader Go GitHub App for ruleset version, module and activity data. Its visible files are a protobuf schema and a sample metadata file, and the page does not show any traffic-endpoint collection, publishing step or schedule.
  - It has been inactive for about 3.5 years.
  - Ours is a complete, tested, documented implementation of exactly what #53 asks for: the traffic API, a run process and Gist publishing.
- No other PRs reference #53, and none exist on bazel_metrics. No fleet TAKE was found in Slack (searches for "SIG-rules-authors", "bazel_metrics" and "traffic" over the last 7 days only hit #96).

## Open Collective expense steps (after merge)

1. Sign in at https://opencollective.com as the woahwhattheheck payee profile, creating one if needed. Add a payout method: PayPal, or bank transfer via Wise.
2. Open https://opencollective.com/bazel-rules-authors-sig/expenses/new and choose **Invoice**.
3. Description: `Bounty: GitHub traffic scraper to resolve https://github.com/bazel-contrib/SIG-rules-authors/issues/53`. This matches the format of the paid expenses for #41 and #42.
4. One line item: `bazel-contrib/SIG-rules-authors#53 (bounty-1000USD), merged in <PR URL>`, amount **1,000.00 USD**, dated the merge date.
5. Add the merged PR URL and the issue URL in the item description or notes, and submit.
6. Post the expense link as a reply on the merged PR and in Bazel Slack `#rules`, and ask the SIG leads to approve it. Payment is then processed by the collective's fiscal host.

## Ready-to-paste PR

**Title:** `feat(catalog): add a GitHub traffic collector (closes #53)`

**Body:**

```markdown
Closes #53

This adds the GitHub traffic scraper requested in #53: the script, a way to run it on a schedule, and publishing to a Gist the SIG can ingest.

The issue suggested sending this to `bazelbuild/bazel_metrics`, but that repository was archived on 2024-08-03 and is read-only, so the collector lives here under `tools/github_traffic/` (as #78 did under `experimental/`). It is self-contained and easy to move if the SIG prefers another location.

### What it does

- `tools/github_traffic/github_traffic.py` (Python 3.8+, standard library only) reads the documented traffic endpoints for each repository: daily views and clones, top referrers and popular paths.
- The token is read from the environment only (`$GITHUB_TRAFFIC_TOKEN`, falling back to `$GITHUB_TOKEN`/`$GH_TOKEN`). It needs push access; for a fine-grained token that is the "Administration: Read-only" repository permission.
- Repositories come from `--repo`, `--repos-file`, or `--org bazelbuild`, which picks the public, non-archived, non-fork repositories the token can push to. `--match '^rules_'` narrows the list.
- GitHub keeps only 14 days of traffic, so every run merges the current window into CSV files that keep the full history:
  - `views.csv` and `clones.csv` are daily series. A day is completed by later runs, and re-runs never lower a value.
  - `summary.csv`, `referrers.csv` and `paths.csv` are dated snapshots of GitHub's 14-day totals, including unique visitors, which cannot be summed across days.
- `--gist-id` merges into and publishes to an existing Gist, so runs are stateless. Anyone can then read `https://gist.githubusercontent.com/<owner>/<id>/raw/views.csv` without a token.
- It handles pagination, primary and secondary rate limits, and transient errors. Repositories the token cannot read are reported with a hint and skipped, and the rest is still saved.
- Each run prints a 14-day totals table per repository.

### Running it

`.github/workflows/github_traffic.yaml` runs the collector daily and on demand. It does nothing until it is configured:

- `TRAFFIC_TOKEN` secret: a token from someone with push access to the bazelbuild repositories. Per the issue, the Bazel team only needs to share such a token.
- `TRAFFIC_GIST_ID` variable, plus the optional `TRAFFIC_GIST_TOKEN` secret if the Gist belongs to a different account.
- Optional `TRAFFIC_ORG` (default `bazelbuild`) and `TRAFFIC_MATCH` variables.

A Googler can also run it from cron. `tools/github_traffic/README.md` documents the token setup, all options, the output schemas and both ways of running it.

### Testing

`python3 tools/github_traffic/github_traffic_test.py` runs 24 unit tests against a fake HTTP transport, with no network or token. They cover parsing, history merging, CSV output, pagination, rate limiting, retries, org filtering, Gist publishing and the CLI end to end.

### Bounty

This completes the `bounty-1000USD` task in #53. Once it is merged, I will submit the $1,000 expense through the SIG's Open Collective (https://opencollective.com/bazel-rules-authors-sig) and ask the SIG leads to approve the bounty payout.
```
