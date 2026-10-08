# HANDOFF · appium/appium#19883 · Open Collective (Appium Contributor Compensation Scheme)

Status: **HANDOFF, ready for submission**

| | |
|---|---|
| Issue | https://github.com/appium/appium/issues/19883 "[Feat]: Allow passing resolved drivers to reliably embed Appium with drivers into an npm package" (naruaway, 2024-03-12; open, unassigned, labels enhancement/feature; no comments or linked PRs visible) |
| Platform | Open Collective, https://opencollective.com/appium (Contributor Compensation Scheme, GOVERNANCE.md#compensation-scheme) |
| Amount | No per-issue bounty. A committer assigns a tier to each merged contribution: XS $0, S $25, M $50, L $100, XL $500, scaled down pro rata when the month's funds are short |
| Base | `appium/appium` branch **`appium4`** @ `8297d31fb18b4d0b9e2b377332cfc680281ec6ed` (2026-10-07, "fix(storage-plugin)!: mount routes under the server base path (#22906)") |
| Patch | `fix.patch`, 1 commit, author `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`, 6 files, +270/−4 |

## Payout facts (recorded as found; there is no per-issue bounty)

- **GOVERNANCE.md, "Compensation Scheme"**:
  - Sponsorship funds are paid out monthly. 15% goes to upstream projects. Of the remaining 85%, 70% goes to Committers (by timesheet) and 30% to Contributors.
  - For Contributors, "when they make contributions which are successfully merged into the project, a Committer can discretionarily assign a 'value tier'": XS $0, S $25, M $50, L $100, XL $500.
  - "If not enough funds exist to cover all payouts, then the payout amounts will be scaled down in a pro rata fashion."
  - Contributors receive an Open Collective link to claim their payout.
- **docs/payout.md** (on master) gives the expense format: an Invoice to Appium, item "PR contribution: <PR urls>", titled "<year-month> contribution payout".
- **Open Collective GraphQL** (`expenses(account:{slug:"appium"})`): 257 expenses in total. Of the latest 60: 56 PAID, 2 REJECTED (both resubmitted and paid days later), 1 PENDING, 1 INCOMPLETE. Collective balance is $6,134.99. Recent PR-contribution payouts:
  - 2026-09-07 ("2026-6 contribution payout"): kelmelzer $100 (dotnet-client#1053), mohamed-mostafa $100 (appium-mcp PRs), anton-yereshchenko $75 (WebDriverAgent/xcuitest PRs), dor-blayzer $50, zhangxh075 $25 (translations).
  - 2026-09-28 ("2026-7 contribution payout"): dor-blayzer $70.75 and mohamed-mostafa $70.75 (PRs, paid), tatanota $53.06 (appium-inspector PRs, pending), zhangxh075 $35.37 (translation, paid). These amounts look like tiers scaled down pro rata (×0.7075).
  - 2026-08-02 ("2026-5"): mohamed-mostafa $200, rul1an $50, fady1011 $50, dor-blayzer $25, asijitm $25.
- No complaints about unpaid contributions were found. The payout depends on a committer's tier for the merged PR, so the amount is not fixed in advance. A feature of this size would plausibly be rated M ($50) or L ($100), but that is the committer's call.
- AI/agent policy: Appium has no AI-contribution policy. The repo has an `AGENTS.md` (pointing agents at the contributor style guide) and `.github/copilot-instructions.md`. The PR template checklist includes "I have signed the CLA", so **the submitter must sign Appium's CLA**.

## Target branch

Feature PRs go to `appium4` (Appium 4 beta, `4.0.0-beta.3`). Since 2026-09-10, `feat` commits have landed there, for example #22862, #22796, #22753, #22754 and #22732, while `master` (3.8.0) gets fixes and dependency updates. The patch applies cleanly to `appium4`. It does **not** apply to `master`: there are conflicts in `driver-config.ts`, and `migrating-3-to-4.md` does not exist there. **Open the PR against `appium4`.**

## Issue summary

`useDrivers` only accepts names of drivers installed in `APPIUM_HOME`. A package that embeds Appium together with drivers can't be sure where the package manager puts them. The workaround is pointing `appiumHome` at a parent of `node_modules` and hoping the drivers are there. The author asks to pass resolved drivers instead, so that Node.js module resolution finds them (like ESLint flat config plugins).

## Design

Appium needs a driver's manifest metadata (`driverName`, `automationName`, `platformNames`, `mainClass`) to match sessions, and a driver class alone doesn't carry it. The patch therefore accepts the **location** of the resolved driver, which the embedder gets from Node.js module resolution in their own package:

```js
import {main} from 'appium';
await main({useDrivers: [import.meta.resolve('appium-xcuitest-driver')]});
// or, from CommonJS: useDrivers: [require.resolve('appium-xcuitest-driver')]
```

- A `useDrivers` entry that is an absolute path or a `file:` URL is treated as a driver location. Driver names can't be absolute paths, so existing usage is unaffected. Names and locations can be mixed.
- `DriverConfig.addResolvedDriver(location)`:
  - Walks up from the location to the nearest `package.json` that has a `name`, skipping nested `{"type":"module"}`-style files without a name.
  - Requires `appium.driverName` in that file.
  - Builds the manifest entry the same way `Manifest.addExtensionFromPackage` does (`installType: 'local'`, `installPath` = package dir).
  - Validates it with the existing `manifestValidator` common and driver checks, and throws a descriptive error if it is invalid.
  - Keeps the entry **in memory only**.
- `DriverConfig.installedExtensions` (overridden getter): resolved drivers come first, then the installed ones, and a resolved driver replaces an installed driver of the same name. When no resolved drivers exist, it still returns the manifest's live map, so existing behavior is unchanged. Because of the merged getter, all existing consumers work without further changes: `findMatchingDriver` (session matching, where resolved drivers win on `automationName`), `requireAsync`/`getInstallPath`, insecure-feature scoping by `automationName`, and `print()`.
- `getActiveDrivers()` registers location entries before importing.
- Docs:
  - `guides/managing-exts.md` gets a new section, "Embedding Appium in an `npm` Package".
  - The `--use-drivers` row in `reference/cli/server.md` is updated.
  - A bullet is added under "New Features" in `guides/migrating-3-to-4.md`.

## Known limits and possible follow-ups (for review discussion)

1. **Driver CLI arg schemas** of resolved drivers are not registered. `ExtensionConfig._readExtensionSchema` resolves schemas relative to `APPIUM_HOME`, and the schema is finalized before `useDrivers` is known. Driver-specific options can still be given programmatically as `driver: {<name>: {...}}`; they are passed through, but without schema defaults or validation. A follow-up could register these schemas from the package path before `getParser()` for programmatic args.
2. **Plugins**: `usePlugins` could take locations the same way. That was left out because the issue is about drivers.
3. **Module objects**: the issue's literal example passes the imported module. It isn't supported because a class carries no `automationName`/`platformNames`. `import.meta.resolve()`/`require.resolve()` give the same Node.js resolution guarantee. If maintainers prefer an object form (e.g. `{driver: Class, automationName, platformNames}`), it could be layered on `addResolvedDriver`.
4. **CLI**: `--use-drivers`'s CSV transformer reads a path to an existing *file* as a CSV file, so CLI and config users should pass the package **directory**. The docs row says "driver package directory". Programmatic `main()` args skip the transformer, so file paths and URLs work there.

## Files changed

```
packages/appium/docs/en/guides/managing-exts.md    |  22 ++++
packages/appium/docs/en/guides/migrating-3-to-4.md |   3 +
packages/appium/docs/en/reference/cli/server.md    |   2 +-
packages/appium/lib/extension/driver-config.ts     | 107 +++++++++++++++++-
packages/appium/lib/extension/index.ts             |  15 ++-
packages/appium/test/unit/extension/resolved-driver.spec.ts | 125 ++++++++++++++
```

## Validation (focused: the new spec plus the existing specs for the touched modules)

```
$ npm ci --ignore-scripts && npx tsc -b packages/appium packages/relaxed-caps-plugin   # compiles clean
$ cd packages/appium
$ node --test --experimental-test-module-mocks --test-concurrency=1 --enable-source-maps --test-timeout=5000 \
    ./build/test/unit/extension/resolved-driver.spec.js
# tests 6  # pass 6  # fail 0
$ node --test --experimental-test-module-mocks --test-concurrency=1 --enable-source-maps --test-timeout=5000 \
    ./build/test/unit/extension/resolved-driver.spec.js ./build/test/unit/extension/driver-config.spec.js \
    ./build/test/unit/extension/extension-config.spec.js ./build/test/unit/extension/import-paths.spec.js
# tests 64  # pass 64  # fail 0          (same result on Node 22.22.0 and Node 26.5.0)
$ npx oxlint -c oxlint.config.mjs <3 touched .ts files>             # exit 0
$ npx oxfmt -c oxfmt.config.mjs --check <3 touched .ts files>       # "All matched files use the correct format."
```

What `resolved-driver.spec.ts` covers:

- adding from the package dir (the manifest stays `{}`);
- adding from a `file:` URL of the entry point, through a nested nameless `package.json`;
- precedence over installed drivers of the same name and `automationName`, including `findMatchingDriver`;
- rejecting a non-driver package;
- rejecting an invalid driver manifest;
- `getActiveDrivers()` loading a driver by URL.

Mutation check: changing the merge to let installed drivers win makes the precedence test fail (5 pass, 1 fail), and the change was then reverted.

Embedding smoke run (Node 26.5.0, built fake-driver; not part of the patch):

- `main({port, appiumHome: <empty dir>, useDrivers: [file URL of @appium/fake-driver's build/lib/index.js]})`
- `POST /session` with Fake caps returns 200 with a sessionId; `DELETE /session/:id` returns 200.
- `extensions.yaml` in the empty `APPIUM_HOME` still has `drivers: {}`.

## How to apply

```
git clone https://github.com/appium/appium && cd appium
git checkout -b feat/use-drivers-locations 8297d31fb18b4d0b9e2b377332cfc680281ec6ed   # appium4
git am /path/to/fix.patch
npm ci && npx tsc -b packages/appium
cd packages/appium && node --test --experimental-test-module-mocks --test-concurrency=1 ./build/test/unit/extension/resolved-driver.spec.js
```

## Competition

None. No PRs match "19883" (open or closed). The issue has no linked branches or PRs. No fleet TAKE in Slack.

## PR draft (Appium template)

**Title:** `feat(appium): accept driver package locations in useDrivers`

**Base branch:** `appium4`

**Body:**

```
## Proposed changes

Closes #19883

Packages that embed Appium can now pass the location of a driver they resolved themselves in
`useDrivers`, instead of depending on what is installed in `APPIUM_HOME`:

    import {main} from 'appium';
    await main({useDrivers: [import.meta.resolve('appium-xcuitest-driver')]});

An entry that is an absolute path or a `file:` URL (of the driver package, its package.json, or any
file in it, such as the result of `import.meta.resolve()`/`require.resolve()`) is read from the
nearest named package.json, validated with the existing manifest checks, and kept in memory only:
nothing is written to extensions.yaml. Such drivers take precedence over installed drivers with
the same name or automationName, and driver names keep working as before (they can be mixed).

A driver class alone doesn't carry the manifest metadata (automationName, platformNames) needed to
match sessions, which is why this takes the resolved location rather than the imported module.

## Types of changes

- [ ] Bugfix (non-breaking change which fixes an issue)
- [x] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation Update (if none of the other choices apply)

## Checklist

- [x] I have read the [Contributing Guide](https://appium.io/docs/en/latest/contributing/)
- [ ] I have signed the CLA
- [x] Lint and unit tests pass locally with my changes
- [x] I have added tests that prove my fix is effective or that my feature works
- [x] I have added the necessary documentation (if appropriate)
- [x] Any dependent changes have been merged and published in downstream modules

## Further comments

- Not covered yet: registering the CLI arg schema of such drivers (their options can still be passed
  as `driver: {<name>: {...}}`), and the same for `usePlugins`. Happy to add either here or in a
  follow-up.
- From the CLI, `--use-drivers` treats a path to an existing file as a CSV file, so the docs ask
  for the package directory there.

I'd like this contribution to be considered for a payout tier under the Contributor Compensation
Scheme (GOVERNANCE.md) once it is merged, and I'm requesting that payout on merge.
```

(Before submitting, tick "I have signed the CLA" only after actually signing it.)

Payout claim after merge: per GOVERNANCE.md and `docs/payout.md`, a maintainer creates an Open Collective expense invite for the contributor at the end of the month. That invite is an Invoice to Appium with the item "PR contribution: <merged PR url>", titled "<year-month> contribution payout". The contributor accepts the invite and fills in payout details. If no invite arrives after the monthly payout round, ask the TC about it.
