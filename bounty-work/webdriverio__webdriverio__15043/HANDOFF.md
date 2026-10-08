# HANDOFF: webdriverio/webdriverio#15043

**Status:** HANDOFF, ready for submission
**Issue:** https://github.com/webdriverio/webdriverio/issues/15043, "[🐛 Bug]: Multi-remote closeWindows end session even if other window still exists". Label: Bug.
- Opened Jan 24 2026 by dprevost-LMI, who is a maintainer.
- The issue is open and has no assignee.

**Platform:** Open Collective, through the WebdriverIO "Expensable" development fund. After merge, a TSC member grants the payout with the `Expense Contribution` workflow.
- Collective: https://opencollective.com/webdriverio
- Expense form: https://opencollective.com/webdriverio/expenses/new
- Policy: https://github.com/webdriverio/webdriverio/blob/main/website/community/Donate.md#development-expenses and https://github.com/webdriverio/webdriverio/blob/main/GOVERNANCE.md#sponsoring-and-donations
- Mechanism: `.github/workflows/expense.yml` runs https://github.com/webdriverio/expense-action. A maintainer picks an amount from $15 to $1000.

**Amount:** Granted by the maintainer. Merged bug fixes from Sep to Oct 2026 were expensed at **$15**.
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
  - #15551 ($15)
  - #15301 ($25)
  - #15084 ($50)
- `Expensable $100 💸` was most recently given to #14718 and #15158 on Oct 4 2026.

## How the payout works (from the expense-action source)

1. A TSC member runs the **Expense Contribution** workflow with the PR number and an amount.
2. The action emails a signed expense key, valid for 90 days, to **the first commit author's email**. It also comments on the PR and adds the `Expensable $N 💸` label.
3. The commit email here is the GitHub noreply address, which GitHub does not forward.
   - Email **expense@webdriver.io** with the PR link, or ask in Discord #contributing (https://discord.webdriver.io), for the key.
   - Alternatively, re-author the commit with a reachable email before pushing: `git config user.email <addr> && git commit --amend --reset-author --no-edit`.
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

In a multi-remote browser, calling `closeWindow()` on an instance that has only one window rejects with `All window handles were removed, causing WebdriverIO to close the session.` That error ends the test, even though the other instances, such as a Firefox one, are still open.

The reporter expects the test to continue with the other instances. Per the WebDriver spec, only that instance's own session ends when its last top-level browsing context closes.

## Root cause

`ContextManager#onCommandResultBidiAndClassic` in `packages/webdriverio/src/session/context.ts` throws when the `closeWindow` result has no window handles left. The throw happens inside the `result` event listener, so the instance's `closeWindow()` command rejects.

That is the intended behavior for a single browser, and it is covered by existing tests. But every multi-remote instance has its own `ContextManager`, which cannot tell that it is one session of several.

## Change

- `packages/webdriverio/src/session/context.ts`:
  - New module-level `WeakSet` `multiRemoteInstances`, plus an exported `registerMultiRemoteInstance(browser)`.
  - It is keyed by the browser object, not by the context manager, so the mark survives `reloadSession()`. A new session gets a new `ContextManager` through `SessionManager`'s `deleteSession` cleanup.
  - In the `closeWindow` result handler, when no handles remain:
    - Clear the cached `#currentContext`, which fixes the stale-context point Greptile raised on #15218. The cached window handle was already cleared.
    - For a marked multi-remote instance: log a warning that its session ended while the other instances keep running, then return without throwing.
    - If the `closeWindow` command itself failed (`result.error`), skip the warning, so the original command error reaches the caller unchanged.
    - Unmarked single browsers still throw the same error as before.
- `packages/webdriverio/src/multiRemote.ts`: `addInstance()` calls `registerMultiRemoteInstance(client)`. Every multi-remote creation path goes through it: standalone `multiRemote()` and the testrunner's `@wdio/runner` `utils.ts`.
- No public type or API change. The draft PR #15218 instead adds an `isMultiremoteBrowser` property to the public `BrowserBase` type, which also breaks the repo's multi-remote naming rule.

## Files changed

```
packages/webdriverio/src/multiRemote.ts            |  6 ++
packages/webdriverio/src/session/context.ts        | 35 +++++++++-
packages/webdriverio/tests/multiRemote.test.ts     | 21 ++++++
packages/webdriverio/tests/session/context.test.ts | 74 +++++++++++++++++++++-
4 files changed, 134 insertions(+), 2 deletions(-)
```

## Validation (focused)

Setup is the same as the #15844 handoff: pnpm 11.27.1 install, then the repo compiler for the core and main packages.

1. Touched test files:
   `npx vitest run packages/webdriverio/tests/session/context.test.ts packages/webdriverio/tests/multiRemote.test.ts` → `Test Files 2 passed (2) · Tests 89 passed (89) · Type Errors no errors`.
2. New tests against the original source (both src files stashed): `-t "15043"` → all 7 new tests fail.
   - The key one is the multi-remote level test `closing the last window of one instance does not end the test for the others`, which goes through the real command and fetch mock. It fails with the issue's error.
3. Related files:
   `npx vitest run packages/webdriverio/tests/session packages/webdriverio/tests/multiRemote.test.ts packages/webdriverio/tests/multiRemoteMock.test.ts` plus the `commands/browser/{getWindowSize,newWindow,reloadSession,setWindowSize,switchWindow}` tests → `Test Files 12 passed (12) · Tests 152 passed (152)`.
4. Lint, types and naming:
   - `npx oxlint` on the 4 touched files → exit 0.
   - `cd packages/webdriverio && tsc --noEmit -p tsconfig.json` → exit 0.
   - The multi-remote naming check from AGENTS.md finds nothing.
5. Real browser: a standalone multi-remote script with two headless Chrome for Testing 148 instances. browserA loads page "A" and browserB loads page "B". The script then runs `browserA.closeWindow()`, `browserB.getTitle()` and `browser.deleteSession()`.
   - Before (main build): BiDi and Classic both `ERROR: All window handles were removed, causing WebdriverIO to close the session.`
   - After: BiDi and Classic both `browserA.closeWindow() -> []`, `browserB.getTitle() -> "B"`, `browser.deleteSession() -> ok`.
   - Note: on BiDi, main already logs one `invalid session id when running "window/handles"` line, before and after this change. It comes from the existing `contextDestroyed` recovery racing the ended session. It is caught there and does not affect the run.
6. `git apply --check fix.patch` on `origin/main@37b1406a7` → clean.
   - It stacks with the #15844 patch in either order. Plain apply works for #15043 after #15844. For #15844 after #15043, use `git am -3`, which auto-merges the import lines.

## How to apply

```sh
git clone https://github.com/webdriverio/webdriverio && cd webdriverio
git checkout -b fix/multi-remote-close-last-window origin/main
git am /path/to/fix.patch
```

## Competition

**PR #15218** by Thavamani13 opened Apr 26 2026 and is a **draft**.
- dprevost-LMI asked on Aug 26 to "resolve Greptile's comments and concerns" and moved it to draft on Aug 29. There has been no activity since.
- The open Greptile P2: `#currentContext` stays stale on the early return.
- It adds a public `isMultiremoteBrowser` field to `BrowserBase`, which breaks the AGENTS.md multi-remote naming rule.
- It was written against the v9 `multiremote.ts` file and object layout. main now has `multiRemote.ts`, an instance `Map` and `getInstance()`.

This patch targets current main, clears the stale context, keeps command errors intact, survives `reloadSession()`, changes no public types, and adds unit, integration and real-browser proof.

## PR title

```
fix(webdriverio): keep a multi-remote test running when one instance closes its last window
```

## PR body (ready to paste)

```markdown
## Proposed changes

Closes #15043

Closing the last window of a browser ends its WebDriver session, and the context manager then threw `All window handles were removed, causing WebdriverIO to close the session.` from the `closeWindow` result. In a multi-remote browser every instance is its own session, so closing the only window of one instance rejected `closeWindow()` and ended the test while the other instances were still open.

- `MultiRemote.addInstance()` marks each instance browser (`registerMultiRemoteInstance`, a `WeakSet` keyed by the browser object, so the mark is kept when the session manager is recreated after `reloadSession()`)
- for a marked browser the context manager no longer throws when no window is left: it clears the cached context and window handle and logs a warning that the session of that instance ended while the others keep running
- if the `closeWindow` command itself failed, its own error reaches the caller unchanged
- a browser that is not part of a multi-remote browser still gets the existing error, unchanged
- no public type or API change

This also covers the review point on #15218 (the cached context was left stale on the early return).

## How you tested

- [x] Unit tests for the touched package(s): `npx vitest run packages/webdriverio/tests/session/context.test.ts packages/webdriverio/tests/multiRemote.test.ts`: 89 passed; all 7 new tests fail without the fix, including a multi-remote test through the real command path. Also ran the other `tests/session` files, `multiRemoteMock` and the window commands: 152 passed.
- [ ] Type definition tests (no public type change)
- [x] Real browser: standalone multi-remote with two headless Chrome instances, `browserA.closeWindow()` on its only window, then `browserB.getTitle()` and `browser.deleteSession()`:
  - before: `All window handles were removed, causing WebdriverIO to close the session.` (BiDi and Classic)
  - after: `closeWindow() -> []`, `browserB.getTitle() -> "B"`, `deleteSession() -> ok` (BiDi and Classic)

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

Happy to open a `v9` backport if you want it there too.

## Further comments

This fix is an Expensable contribution to the WebdriverIO development fund. Once it is merged, I'd like to request the expense payout via the Expense Contribution workflow (Open Collective, https://opencollective.com/webdriverio). Please send the expense key to me at <reachable email>, since the commit uses my GitHub noreply address. Thank you!

### Reviewers: @webdriverio/project-committers
```

## Notes for the submitter

- First-time contributors must sign the Linux Foundation EasyCLA. The bot posts the link on the PR.
- CONTRIBUTING and AGENTS.md welcome agent-assisted contributions and have no disclosure requirement.
- Replace `<reachable email>` in the PR body, or re-author the commit with a reachable email before pushing.
- This and the #15844 handoff are separate PRs on different topics. They touch neighboring lines in `multiRemote.ts` and its test file; `git am -3` auto-merges them in either order.
