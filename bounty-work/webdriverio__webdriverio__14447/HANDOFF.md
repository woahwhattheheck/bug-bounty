# HANDOFF: webdriverio/webdriverio#14447

**Status:** HANDOFF, ready for submission
**Issue:** https://github.com/webdriverio/webdriverio/issues/14447, "[🐛 Bug]: Inconsistent path behavior of CLI parameter --spec if no pattern is used". Labels: Bug, help wanted.
- Opened May 2 2025 by sebage.
- Open, no assignee, no linked PR.

**Platform:** Open Collective, through the WebdriverIO "Expensable" development fund. After merge, a TSC member grants the payout with the `Expense Contribution` workflow.
- Collective: https://opencollective.com/webdriverio
- Expense form: https://opencollective.com/webdriverio/expenses/new
- Policy: https://github.com/webdriverio/webdriverio/blob/main/website/community/Donate.md#development-expenses and https://github.com/webdriverio/webdriverio/blob/main/GOVERNANCE.md#sponsoring-and-donations
- Mechanism: `.github/workflows/expense.yml` runs https://github.com/webdriverio/expense-action. A maintainer picks an amount from $15 to $1000.

**Amount:** Granted by the maintainer. Merged bug fixes from Sep to Oct 2026 were expensed at **$15**. #15301 got $25 and #15084 got $50.
**Base:** `main@37b1406a7fc95fa42ea5d34bc2ff70bee37c1d9f`. `main` is the v10 development branch.
**Submit as:** woahwhattheheck. Commit author: `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`.

## Payout evidence

- 239 merged PRs carry an `Expensable $N 💸` label.
- Recent examples:
  - #15642 ($15, Sep 20 2026)
  - #15753 ($15, Sep 28 2026)
  - #15697 ($15)
  - #15691 ($15)
  - #15643 ($15)
  - #15632 ($15)
  - #15637 ($15)
  - #15624 ($15)
  - #15639 ($15)
  - #15629 ($15)
  - #15625 ($15, a `@wdio/utils` fix)
  - #15551 ($15)
  - #15301 ($25)
  - #15084 ($50)
- `Expensable $100 💸` was most recently given to #14718 and #15158 on Oct 4 2026.

## How the payout works (from the expense-action source)

1. A TSC member runs the **Expense Contribution** workflow with the PR number and an amount.
2. The action emails a signed expense key, valid for 90 days, to **the first commit author's email**. It also comments on the PR and adds the `Expensable $N 💸` label.
3. The commit email is the GitHub noreply address, which GitHub does not forward.
   - Email **expense@webdriver.io** with the PR link, or ask in Discord #contributing (https://discord.webdriver.io).
   - Alternatively, re-author the commit with a reachable email before pushing.
4. Submit at https://opencollective.com/webdriverio/expenses/new:
   1. Create an account, enter your address and select a payment method.
   2. Select **Invoice**.
   3. Accept the host and collective invoice instructions.
   4. Choose "No, generate an invoice for me".
   5. Enter this Item Description: `<PR title>, <Month Year>`.
   6. Set the date to the email date and the amount to the granted amount, in **USD**.
   7. Under Additional details, enter this title: `Project Contribution PR webdriverio/webdriverio#<PR number>`.
   8. Under Additional notes, paste the expense key, then submit.

   The money arrives 1 to 2 weeks after approval.

## Issue summary

With `wdio.conf.js` in a sub folder, the reporter ran `npx wdio ./wdioconf/wdio.conf.js` from the project root. Results:

- `--spec="./ExampleAppTest/*.spec.js"` → fails
- `--spec="../ExampleAppTest/*.spec.js"` → works
- `--spec="./ExampleAppTest/ShoppingCartApp.spec.js"` → works
- `--spec="../ExampleAppTest/ShoppingCartApp.spec.js"` → fails

A glob pattern and a file therefore need opposite prefixes. The docs (`website/docs/OrganizingTestSuites.md`, "Run Selected Tests") say: "The path is resolved relative from your current working directory."

## Root cause

`makeRelativeToCWD` in `packages/wdio-config/src/node/utils.ts` makes CLI `--spec` values absolute from the CWD, but only when `file.includes('/') && !file.includes('*')`.
- #14243 ("[WDIO9] added wildcards for cli", Mar 2025) added the `!file.includes('*')` guard. That is the "recent update" the reporter mentions.
- Because of the guard, a glob with a directory stays relative and is globbed with `cwd: rootDir`, the config directory.

A second, smaller inconsistency is in `ConfigParser#setFilePathToFilterOptions`. It checks `isFile(filteredFile)` relative to the CWD, but then makes the path absolute from the config directory. A bare file name of the CWD therefore ends up pointing to a file that does not exist.

## Change

- `packages/wdio-config/src/node/utils.ts`: `makeRelativeToCWD` resolves every value **with a directory** from the CWD, globs included. On Windows it also treats `path.sep` as a directory separator.
  - Values without a directory (`login`, `*.e2e.js`) are unchanged. They keep matching spec files by name, through the glob's `matchBase` under the config directory or the name filter.
  - This keeps the smoke-tested `--spec mocha.test01*.js` behavior from #14243.
  - The glob is safe on Windows: `ConfigParser.getFilePaths` converts `\` to `/` before globbing.
- `packages/wdio-config/src/node/ConfigParser.ts`: a CLI value that `isFile()` finds is made absolute from `process.cwd()`, where it was found, instead of from the config directory.
- `website/docs/v10Migration.md` and `.agents/skills/wdio-v10-migration/SKILL.md`: a short "`--spec` glob patterns" section and a replacements row. AGENTS.md asks for both to be updated together.
  - This is a v10 behavior change for anyone who adopted the `../dir/*.js` workaround.

## Files changed

```
.agents/skills/wdio-v10-migration/SKILL.md         |  1 +
packages/wdio-config/src/node/ConfigParser.ts      |  6 ++-
packages/wdio-config/src/node/utils.ts             |  8 +++-
.../wdio-config/tests/node/configparser.test.ts    | 55 ++++++++++++++++++++++
packages/wdio-config/tests/node/utils.test.ts      | 47 ++++++++++++++++++
website/docs/v10Migration.md                       | 12 +++++
6 files changed, 127 insertions(+), 2 deletions(-)
```

## Validation (focused)

1. New and touched tests:
   `npx vitest run packages/wdio-config/tests/node/utils.test.ts packages/wdio-config/tests/node/configparser.test.ts` → `Test Files 2 passed (2) · Tests 76 passed (76)`.
   - The new `tests/node/utils.test.ts` mirrors `src/node/utils.ts` and covers `makeRelativeToCWD`.
   - New real-filesystem ConfigParser tests run from `tests/` with the config in `tests/__fixtures__`. They cover:
     - a glob with a directory
     - a file with a directory
     - a bare file of the CWD
     - a bare glob still matched by name
     - a glob written relative to the config directory, which no longer resolves
2. Against the original source (src stashed): `-t "14447|makeRelativeToCWD"` → `5 failed | 5 passed`. The 5 that pass are guards for behavior that must not change, such as files with a directory, bare names and file URLs.
3. Package: `npx vitest run packages/wdio-config` → `Test Files 5 passed (5) · Tests 116 passed (116)`.
4. Lint and types:
   - `npx oxlint` on the 4 touched TS files → exit 0.
   - `cd packages/wdio-config && tsc --noEmit -p tsconfig.json` → exit 0.
5. End to end with the issue's layout: `proj/wdioconf/wdio.conf.mjs` with `specs: ['../ExampleAppTest/**/*.spec.js']`, plus `proj/ExampleAppTest/{ShoppingCartApp,Login}.spec.js`. A script run from `proj/` does what the CLI launcher does: `new ConfigParser(configFile, args)`, then `initialize(args)`, then `getSpecs()`. It uses the compiled `@wdio/config`.
   - Before (main build), the issue's matrix exactly:
     ```
     --spec="./ExampleAppTest/*.spec.js"               -> ERROR spec file(s) ./ExampleAppTest/*.spec.js not found
     --spec="../ExampleAppTest/*.spec.js"              -> ["ExampleAppTest/Login.spec.js","ExampleAppTest/ShoppingCartApp.spec.js"]
     --spec="./ExampleAppTest/ShoppingCartApp.spec.js" -> ["ExampleAppTest/ShoppingCartApp.spec.js"]
     --spec="../ExampleAppTest/ShoppingCartApp.spec.js" -> ERROR spec file(s) .../ExampleAppTest/ShoppingCartApp.spec.js not found
     ```
   - After (rebuilt). Both `./` forms work and both `../` forms are consistently "not found", as documented:
     ```
     --spec="./ExampleAppTest/*.spec.js"               -> ["ExampleAppTest/Login.spec.js","ExampleAppTest/ShoppingCartApp.spec.js"]
     --spec="../ExampleAppTest/*.spec.js"              -> ERROR spec file(s) .../ExampleAppTest/*.spec.js not found
     --spec="./ExampleAppTest/ShoppingCartApp.spec.js" -> ["ExampleAppTest/ShoppingCartApp.spec.js"]
     --spec="../ExampleAppTest/ShoppingCartApp.spec.js" -> ERROR spec file(s) .../ExampleAppTest/ShoppingCartApp.spec.js not found
     ```
6. The smoke runner's `--spec` cases (`tests/smoke.runner.js`) only use bare globs (`mocha.test01*.js`) and files with directories. Neither path changes, so they are unaffected.

## How to apply

```sh
git clone https://github.com/webdriverio/webdriverio && cd webdriverio
git checkout -b fix/spec-glob-cwd origin/main
git am /path/to/fix.patch
```

## Competition

There is no PR for #14447, and no fleet TAKE in Slack.

## PR title

```
fix(@wdio/config): resolve --spec glob patterns from the current working directory
```

## PR body (ready to paste)

```markdown
## Proposed changes

Closes #14447

The docs say a `--spec` path "is resolved relative from your current working directory". That was true for a file, but a glob pattern with a directory was kept relative and globbed from the directory of the config file (the `!file.includes('*')` guard added to `makeRelativeToCWD` in #14243). With the config in a sub folder, run from the project root:

| `--spec` | before | after |
| --- | --- | --- |
| `./ExampleAppTest/*.spec.js` | not found | both specs |
| `../ExampleAppTest/*.spec.js` | both specs | not found |
| `./ExampleAppTest/ShoppingCartApp.spec.js` | the spec | the spec |
| `../ExampleAppTest/ShoppingCartApp.spec.js` | not found | not found |

- `makeRelativeToCWD` resolves every `--spec` value **with a directory** from the current working directory, also a glob pattern (and treats `path.sep` as a separator on Windows; `getFilePaths` already turns `\` into `/` before globbing)
- a value **without** a directory (`login`, `*.e2e.js`) is unchanged and still matches spec files by name, so the wildcard cases from #14243 (`--spec mocha.test01*.js`) keep working
- `setFilePathToFilterOptions` checks `isFile()` relative to the working directory, so it now also makes that file absolute from the working directory instead of the config directory (a bare file name of the working directory pointed to a missing file before)
- the v10 migration guide and the migration skill describe the change for anyone who used the `../dir/*.js` workaround

## How you tested

- [x] Unit tests for the touched package(s): `npx vitest run packages/wdio-config`: 116 passed. A new `tests/node/utils.test.ts` covers `makeRelativeToCWD`, and new real-filesystem `ConfigParser` tests run from the parent of the config directory. 5 of the 10 new tests fail without the fix; the others guard behavior that must not change.
- [ ] Type definition tests (no public type change)
- [x] The issue's layout (`wdioconf/wdio.conf.mjs`, `ExampleAppTest/*.spec.js`) through `ConfigParser` the way the launcher uses it (`new ConfigParser(configFile, args)`, `initialize(args)`, `getSpecs()`), before and after; see the table above.

`oxlint` and `tsc --noEmit -p packages/wdio-config` are clean.

## Types of changes

- [ ] Polish (an improvement for an existing feature)
- [x] Bugfix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [x] Documentation update (improvements to the project's docs)
- [ ] Specification changes (updates to WebDriver command specifications)
- [ ] Internal updates (everything related to internal scripts, governance documentation and CI files)

## Checklist

- [x] I have read the [CONTRIBUTING](https://github.com/webdriverio/webdriverio/blob/main/CONTRIBUTING.md) doc
- [x] I have added tests that prove my fix is effective or that my feature works
- [x] I have added the necessary documentation (if appropriate)
- [ ] I have added proper type definitions for new commands (if appropriate)

## Backport Request

- [x] This change is solely for `v10` and doesn't need to be back-ported
- [ ] Back-ported PR at `#XXXXX`

It changes how a `../dir/*.js` workaround resolves, so I kept it to v10 with a migration note. Happy to open a `v9` PR if you prefer it there too.

## Further comments

This fix is an Expensable contribution to the WebdriverIO development fund. Once it is merged, I'd like to request the expense payout via the Expense Contribution workflow (Open Collective, https://opencollective.com/webdriverio). Please send the expense key to me at <reachable email>, since the commit uses my GitHub noreply address. Thank you!

### Reviewers: @webdriverio/project-committers
```

## Notes for the submitter

- First-time contributors must sign the Linux Foundation EasyCLA. The bot posts the link on the PR.
- CONTRIBUTING and AGENTS.md welcome agent-assisted contributions and have no disclosure requirement.
- Replace `<reachable email>` in the PR body, or re-author the commit with a reachable email before pushing.
- The issue's 5 comments could not be read from this environment. GitHub comments do not render without login here, and the REST API is blocked. Check them once before submitting in case a maintainer asked for the opposite direction. The docs and the code comment in `ConfigParser` both say CWD.
- Independent of the #15844 and #15043 handoffs: it touches only `@wdio/config` and the docs.
