# HANDOFF: webdriverio/webdriverio#15844

**Status:** HANDOFF, ready for submission
**Issue:** https://github.com/webdriverio/webdriverio/issues/15844, "[🐛 Bug]: execute() on a multi-remote browser fails when an argument is a multi-remote element". Labels: Bug, good first pick, help wanted, multi remote, Protocol Related. The issue is open and has no assignee.
**Platform:** Open Collective, through the WebdriverIO "Expensable" development fund. After merge, a TSC member grants the payout with the `Expense Contribution` workflow.
- Collective: https://opencollective.com/webdriverio
- Expense form: https://opencollective.com/webdriverio/expenses/new
- Policy: https://github.com/webdriverio/webdriverio/blob/main/website/community/Donate.md#development-expenses and https://github.com/webdriverio/webdriverio/blob/main/GOVERNANCE.md#sponsoring-and-donations
- Mechanism: `.github/workflows/expense.yml` runs https://github.com/webdriverio/expense-action. A maintainer picks an amount from $15 to $1000.

**Amount:** Granted by the maintainer. Merged bug fixes from Sep to Oct 2026 were expensed at **$15**. Larger work received $25, $50 or $100.
**Base:** `main@37b1406a7fc95fa42ea5d34bc2ff70bee37c1d9f`. `main` is the v10 development branch.
**Submit as:** woahwhattheheck. Commit author: `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`.

## Payout evidence

- 239 merged PRs carry an `Expensable $N 💸` label. The label is added by the expense workflow when it sends the payout email.
- Recent examples (merged, then expensed):
  - #15642 ($15, Sep 20 2026)
  - #15753 ($15, Sep 28 2026)
  - #15697 ($15, Sep 28 2026)
  - #15691 ($15)
  - #15643 ($15)
  - #15632 ($15)
  - #15637 ($15)
  - #15624 ($15)
  - #15639 ($15)
  - #15629 ($15)
  - #15551 ($15)
  - #15301 ($25)
  - #15084 ($50)
- `Expensable $100 💸` was most recently given to #14718 and #15158 on Oct 4 2026.
- Active maintainers who merge PRs: christian-bromann, dprevost-LMI, mccmrunal.

## How the payout works (from the expense-action source)

1. A TSC member runs the **Expense Contribution** workflow with the PR number and an amount.
2. The action emails a signed expense key, valid for 90 days, to **the email address of the first commit author in the PR**. It also comments on the PR and adds the `Expensable $N 💸` label.
3. **Important:** the commit author email here is the GitHub noreply address. GitHub does not forward these emails, and the bot comment then says to contact the team.
   - To get the key, email **expense@webdriver.io** with the PR link and ask for the expense email, or ask in the #contributing channel on Discord (https://discord.webdriver.io).
   - Alternatively, before pushing, re-author the commit with a reachable email: `git commit --amend --reset-author` after `git config user.email <reachable address>`.
4. Submit the expense at https://opencollective.com/webdriverio/expenses/new. The steps below are copied from the expense email template:
   1. Create an account, enter your address, and select a payment method.
   2. Select **Invoice**.
   3. Accept "Host instructions to submit an invoice" and "Collective instructions to submit an invoice".
   4. Choose "No, generate an invoice for me".
   5. Under Expense items, enter this Item Description: `<PR title>, <Month Year>`.
   6. Set the date to the email date and the amount to the granted amount, in **USD**.
   7. Under Additional details, enter this title: `Project Contribution PR webdriverio/webdriverio#<PR number>`.
   8. Under Additional notes, paste the expense key from the email, then submit.

   The money arrives 1 to 2 weeks after approval.

## Issue summary

On a multi-remote browser, `browser.execute(fn, multiRemoteElement)` fails. WebdriverIO 9.32.0 has the bug, and so does `main`/v10.
- WebDriver Classic fails with `The element with selector "#title" you are trying to pass into the execute method wasn't found`.
- WebDriver BiDi fails with `Unsupported type: function`.
- Passing the element of a single instance works.

The issue also suspects `dragAndDrop` and `switchFrame`.

## Root cause

A multi-remote element wraps one element per instance and has no `elementId` of its own. `MultiRemote#commandWrapper` in `packages/webdriverio/src/multiRemote.ts` passed `args` unchanged to every instance's command.
- Classic `verifyArgsAndStripIfElement` reads an undefined `elementId`.
- BiDi `LocalValue.getArgument` serializes the wrapper object and fails on its methods.

Every command that takes an element argument has the same bug, because they all go through the same wrapper.

## Change

`packages/webdriverio/src/multiRemote.ts`:
- New module-private `toInstanceArgument(arg, instanceName, commandName, seen)`. It swaps each loaded multi-remote element for `element.getInstance(instanceName)`. Detection uses `isLoadedElement` from `@wdio/utils`, whose doc comment already points to #15844, plus `isMultiRemote`.
  - It recurses into arrays and element lists. Items are read by index, because `ElementArray#map`/`every` are async.
  - It recurses into plain objects (`Object.prototype` or `null` prototype). It reads **data descriptors only**, so getters are never called. Accessors and property flags are kept on the copy.
  - Class instances (Date, Map, pending chainable elements) pass through untouched.
  - Cycles and repeated references are handled with a `WeakMap`.
  - Arguments without a multi-remote element are returned **by identity**, so non-element calls behave as before.
  - If a multi-remote element has no element for an instance, it throws a clear error. This happens after `select()`, or for a zipped list entry an instance did not find (#15845). The error reads: `The multi-remote element with selector "#foo" passed to "execute" has no element for instance "browserB"`.
- `commandWrapper` resolves the arguments for **all** instances before starting any command. An unresolvable argument therefore rejects without running the command on some instances.

`packages/webdriverio/tests/multiRemote.test.ts`: 9 new tests under `multi-remote elements as command arguments (#15844)`:
- Real Classic request bodies, with a different element id per instance.
- Arrays, plain objects and element lists.
- Identity of untouched arguments.
- Getters are not called.
- Self-referencing argument.
- No partial execution after `select()`.
- No partial execution for a list entry missing on one instance.
- A `select()`-ed browser.
- Element-scope command (`dragAndDrop(target)`).

## Files changed

```
packages/webdriverio/src/multiRemote.ts        | 115 ++++++++++++++++-
packages/webdriverio/tests/multiRemote.test.ts | 167 +++++++++++++++++++++++++
2 files changed, 279 insertions(+), 3 deletions(-)
```

## Validation (focused)

Setup: `corepack pnpm@11.27.1 install --frozen-lockfile --ignore-scripts`, then `infra/compiler: tsx ./src/index.ts -p @wdio/logger -p @wdio/types -p @wdio/globals -p @wdio/protocols -p @wdio/repl` and `-p @wdio/utils -p @wdio/reporter -p @wdio/config -p @wdio/display-server -p webdriver -p webdriverio`.

1. Touched test file:
   `npx vitest run packages/webdriverio/tests/multiRemote.test.ts` → `Test Files 1 passed (1) · Tests 70 passed (70) · Type Errors no errors`. The baseline before the change was 61 passed.
2. New tests against the original source (fix stashed):
   `npx vitest run packages/webdriverio/tests/multiRemote.test.ts -t "#15844"` → `Tests 8 failed | 1 passed`. The one that passes is the identity regression guard, which passes both before and after by design.
3. Related files:
   `npx vitest run packages/webdriverio/tests/{multiRemote,multiRemoteMock,kind,addCommand,overwriteCommand}.test.ts packages/webdriverio/tests/commands/browser/execute.test.ts` → `Test Files 6 passed (6) · Tests 288 passed | 1 skipped`.
4. Lint and types:
   - `npx oxlint packages/webdriverio/src/multiRemote.ts packages/webdriverio/tests/multiRemote.test.ts` → exit 0, no findings.
   - `cd packages/webdriverio && tsc --noEmit -p tsconfig.json` → exit 0.
   - The multi-remote naming check from AGENTS.md finds nothing in the touched files.
5. Real browser, following `verify-webdriverio`: a standalone multi-remote script with two headless Chrome for Testing 148 instances. Each instance loads a different page (`<h1 id="title" data-name="A|B">`) and runs `browser.execute((el) => el.dataset.name, await browser.$('#title'))`.
   - Before (original build): BiDi `ERROR: Unsupported type: function`; Classic `ERROR: The element with selector "#title" you are trying to pass into the execute method wasn't found`.
   - After (rebuilt): BiDi and Classic both `execute(fn, multiRemoteElement) -> ["A","B"]` and `execute(fn, { target, list: [el] }) -> ["A/title","B/title"]`.
   - Classic `browser.switchFrame(multiRemoteIframe)` then `$('#inner').getText()` → `["inner-A","inner-B"]`. On BiDi v10, `switchFrame` is removed by design.
6. `git apply --check fix.patch` on a fresh worktree of `origin/main@37b1406a7` → applies cleanly.

## How to apply

```sh
git clone https://github.com/webdriverio/webdriverio && cd webdriverio
git checkout -b fix/multi-remote-element-args origin/main
git am /path/to/fix.patch
```

## Competition

**PR #15853** by MannXo is open and has no maintainer review.
- On Oct 5 its author retargeted it from `main` to **`v9`**, so `main`/v10 still has the bug.
- On Oct 7 the issue reporter (plum117) asked it to "target main and review Greptile's comments". There has been no update since.
- Its Greptile review (3/5) has open findings:
  - P1: commands can partially execute before an instance's conversion fails.
  - P1: object traversal invokes unrelated getters.
  - P2: nested serialization is untested.
- Its v9 code reads `element[instanceName]`, a v9 property that does not exist in v10, where multi-remote objects only expose `getInstance()`.

This patch targets `main`, uses the v10 `getInstance()` API, and fixes all three findings:
- Arguments for all instances are resolved before any command starts.
- Only data descriptors are read.
- There are real request-body tests and a before/after real-browser run.

## PR title

```
fix(webdriverio): give each multi-remote instance its own element in command arguments
```

## PR body (ready to paste)

```markdown
## Proposed changes

Closes #15844

On a multi-remote browser, `browser.execute(fn, multiRemoteElement)` failed with "wasn't found" on WebDriver Classic and "Unsupported type: function" on WebDriver BiDi. A multi-remote element wraps one element per instance and has no element id of its own, and the multi-remote command wrapper passed the arguments unchanged to every instance. Every command that takes an element argument was affected the same way, e.g. `elem.dragAndDrop(target)` or Classic `switchFrame(element)`.

The command wrapper now gives each instance its own element:

- every loaded multi-remote element in the arguments is swapped for `element.getInstance(instanceName)`, also inside arrays, element lists and plain objects, which the BiDi serialization reads too
- the arguments for **all** instances are resolved before any command starts, so an element that has no element for one instance (after `select()`, or a list entry that one instance did not find, #15845) rejects with a clear error instead of running the command on some instances only:
  `The multi-remote element with selector "#foo" passed to "execute" has no element for instance "browserB"`
- only data properties of plain objects are read, so getters of an argument are never called, and accessors are kept on the copy
- arguments without a multi-remote element reach the instances unchanged (same object), and cycles are handled

This targets `main` (v10) and uses the v10 `getInstance()` API. It addresses the points raised by the automated review on #15853 (partial execution, getters, nested serialization).

## How you tested

- [x] Unit tests for the touched package(s): `npx vitest run packages/webdriverio/tests/multiRemote.test.ts`: 70 passed. 8 of the 9 new tests fail without the fix; the 9th is an identity regression guard. Also ran `multiRemoteMock`, `kind`, `addCommand`, `overwriteCommand` and `commands/browser/execute` tests: 288 passed.
- [ ] Type definition tests (no public type change)
- [x] Real browser: a standalone multi-remote script with two headless Chrome instances, each on a different page:
  - before: BiDi `Unsupported type: function`, Classic `... wasn't found`
  - after: `browser.execute((el) => el.dataset.name, await browser.$('#title'))` → `["A","B"]` on BiDi and Classic; `browser.execute(fn, { target: el, list: [el] })` → `["A/title","B/title"]`; Classic `switchFrame(multiRemoteIframe)` → `["inner-A","inner-B"]`

`oxlint` and `tsc --noEmit -p packages/webdriverio` are clean.

## Types of changes

- [ ] Polish (an improvement for an existing feature)
- [x] Bugfix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update (improvements to the project's docs)
- [ ] Specification changes (updates to WebDriver command specifications)
- [ ] Internal updates (everything related to internal scripts, governance documentation and CI files)

## Checklist

- [x] I have read the [CONTRIBUTING](https://github.com/webdriverio/webdriverio/blob/main/CONTRIBUTING.md) doc
- [x] I have added tests that prove my fix is effective or that my feature works
- [ ] I have added the necessary documentation (if appropriate)
- [ ] I have added proper type definitions for new commands (if appropriate)

## Backport Request

- [ ] This change is solely for `v10` and doesn't need to be back-ported
- [ ] Back-ported PR at `#XXXXX`

v9 is covered by #15853 (v9 base). I can open a v9 backport of this version if you prefer it there too.

## Further comments

This fix is an Expensable contribution to the WebdriverIO development fund. Once it is merged, I'd like to request the expense payout via the Expense Contribution workflow (Open Collective, https://opencollective.com/webdriverio). Please send the expense key to me at <reachable email>, since the commit uses my GitHub noreply address. Thank you!

### Reviewers: @webdriverio/project-committers
```

## Notes for the submitter

- First-time contributors must sign the Linux Foundation EasyCLA. The bot posts the link on the PR.
- CONTRIBUTING and AGENTS.md welcome agent-assisted contributions and have no disclosure requirement.
- Replace `<reachable email>` in the PR body with a real address, or re-author the commit with a reachable email before pushing (see "How the payout works", step 3).
- Donate.md also describes a claim comment on issues labelled `Expensable 💸`. This issue does not carry that label: the expense is granted on the merged PR, so the PR body request above is the claim.
