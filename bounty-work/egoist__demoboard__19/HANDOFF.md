# egoist/demoboard#19 — Allow to configure social links

| | |
|---|---|
| Issue | https://github.com/egoist/demoboard/issues/19 (OPEN, labels: "Funded on Issuehunt", "contribution welcome"; assignee egoist) |
| Bounty | https://oss.issuehunt.io/r/egoist/demoboard/issues/19 |
| Platform / amount | IssueHunt, **$40** (deposit by IssueHunt 2019-07-12, not cancelled; issue status `ready`, GitHub state `open`) |
| Payout evidence | IssueHunt repo page for egoist/demoboard: $610 rewarded across 7 issues, $40 active (this issue). No closed-but-unpaid issues found. |
| Base | `master@1d5c61b261767a04e412769825fe2985421263fb` (last upstream commit 2019-09-21, "feat: add decorator support") |
| Submit as | woahwhattheheck |
| Status | READY FOR SUBMISSION |

## Issue summary

egoist asked for configurable sidebar links: twitter, github, donate, custom. Maintainer guidance in the comments:

- "As Demoboard is used to build demos, usually you want to add links to your original GitHub repository and your Twitter page etc."
- Placement: "I can imagine a fixed bottom section" of the sidebar.
- Icons: "https://feathericons.com and https://akveo.github.io/eva-icons are great source for svg icons."

## Root cause

This is a missing feature. `mount()` only reads `title` and `readme` from its options, and the sidebar menu (`src/Sidebar.js`) is a fixed box with no scroll container, so a bottom section would also overlap the board list.

## Change

- New `socialLinks` mount option, accepted in two forms:
  - Object form, mirroring the issue's list: `{ github, twitter, donate, custom: [{ title, link, icon }] }`. Links render in the fixed order GitHub, Twitter, Donate, then the custom links.
  - Array form for full control of order: `[{ type, link, title, icon }]`. `type` is `github`, `twitter` or `donate`; anything else, or no type, is a custom link.
- Shorthands: `github: 'egoist/demoboard'` and `twitter: '@_egoistlily'` (or `github.com/...`) expand to full URLs. Absolute URLs (`https:`, `mailto:`, `//...`) are used as-is.
- Rendering (`src/SocialLinks.js`):
  - Uses the Feather icons the maintainer suggested (github, twitter, heart, link; MIT; path data checked against `feather-icons@4.29.2`).
  - Built-in links are icon-only, with `title` and `aria-label`.
  - A custom link without its own icon shows the link icon plus its title, so several custom links can be told apart. A custom link with an `icon` node is icon-only.
  - Every link uses `target="_blank" rel="noopener noreferrer"`.
- Type lookup checks own properties only. Types such as `constructor`, `__proto__` or `toString` fall back to `custom` and never resolve to inherited `Object.prototype` members. Inherited keys are also ignored in the object form.
- Invalid or empty entries (no link, non-string link, `github: false`, `null`) are dropped. An empty or absent option renders nothing, so the sidebar is unchanged for existing users.
- `src/Sidebar.js`: the menu is now a flex column. Search and boards sit in a scrollable `menuContent` (`flex: 1; min-height: 0; overflow-y: auto`), with the social section pinned below it. As a side benefit, long board lists can now scroll. Before this change they overflowed the fixed menu.
- `src/App.js`: passes `options.socialLinks` to `Sidebar`.
- The README gets a "Customize Social Links" section and TOC entry, and `demo/index.js` now shows all four kinds of link.
- No flex `gap`, so it works in Safari versions before 14.1.

Files changed: `README.md`, `demo/index.js`, `src/App.js`, `src/Sidebar.js`, `src/SocialLinks.js` (new), `src/utils/socialLinks.js` (new). Totals: 6 files, +287/−11.

## Validation (focused; Node v22.22.0, yarn 1.22.22)

```bash
yarn install --frozen-lockfile --ignore-scripts --ignore-engines      # Done in 32.16s
npx xo src/SocialLinks.js src/utils/socialLinks.js src/Sidebar.js src/App.js demo/index.js
# exit 0. No errors and no warnings; the only output is eslint-plugin-react's generic "React version not specified" notice.
npx prettier -l src/SocialLinks.js src/utils/socialLinks.js src/Sidebar.js src/App.js demo/index.js
# exit 0, no files listed. The README hunk also matches prettier output; other README lines were already unformatted on master.
npx bili
# success Bundled ./src/index.js in cjs format / esm format
NODE_OPTIONS=--openssl-legacy-provider npx poi --config demo/poi.config.js --prod --out-dir /tmp/demo-dist
# Build completed. The openssl flag is the usual webpack-4-on-Node>=17 workaround and is unrelated to this change.
node smoke.js /path/to/demoboard      # smoke.js is in this directory; not part of the patch
# 20 checks passed
```

`smoke.js` compiles `src/` with the repo's own `babel.config.js` and server-renders the normalizer, `SocialLinks` and `Sidebar`. It checks:

- object and array forms, ordering, and shorthand expansion (including the `github.com/...` and `/user` forms)
- that `Object.prototype` names fall back to `custom`
- that invalid entries are dropped
- hrefs, `target`/`rel` and `aria-label`
- visible titles on custom links, and icon-only custom links when an `icon` is given
- that the section renders after the boards, that nothing changes without the option, and that the links hide with a collapsed menu

Browser check (Playwright Chromium 1134 against the built demo; screenshots in `screenshots/`):

- 1280×720: the social bar's bottom is 720, flush with the viewport. Links in order: GitHub, Twitter, Donate, Discord. Colour is #999, and hover changes it to the theme colour rgb(0,136,204).
- 1280×330: the bar is still flush at 330, and the board list scrolls above it (`contentScrollable: true`).
- 390×700 mobile: the links are hidden until the menu is toggled, then sit pinned at the bottom (651–700).
- No console errors. The only failed request is the README's external CircleCI badge on badgen.net (502), which is existing content.

The full `yarn test` (xo over the whole repo) was not run, per the team's focused-validation rule.

## How to apply

```bash
git clone https://github.com/egoist/demoboard && cd demoboard
git checkout -b feat/social-links 1d5c61b261767a04e412769825fe2985421263fb
git am /path/to/fix.patch      # verified: applies cleanly, resulting tree identical to the fix branch
```

After opening the GitHub PR, submit it on IssueHunt with "Submit pull request" at https://oss.issuehunt.io/r/egoist/demoboard/issues/19. IssueHunt only pays PRs submitted there.

## Competition and risks (read before submitting)

- **PR #234** ("Add configurable social links", apples-kksk, opened 2026-05-09, OPEN, submitted on IssueHunt) is a credible competitor. It covers the core ask: an array of `{type, url, label}`, a fixed bottom section, docs and a demo.
  - Ours differs as follows:
    1. Prototype-safe type lookup. #234 indexes `icons[type]` and `labels[type]` on plain objects, so `type: 'constructor'` renders a native function as the label.
    2. Feather icons as the maintainer suggested; #234 uses hand-drawn filled paths.
    3. The object form maps 1:1 to the issue's list, plus user/repo and username shorthands.
    4. Custom links show their title instead of identical chain icons.
    5. No flex `gap`.
    6. `min-height: 0` on the scroll area.
  - #234 is older and close in scope, so ours is better but not decisively so.
  - **Note:** the woahwhattheheck account already left a review on #234 on 2026-10-06, suggesting the `hasOwnProperty` fix, which has not been applied yet. Opening a competing PR from the same account after reviewing theirs may look poor to the maintainer. Decide whether to submit anyway.
- **PR #44** (kenanchristian, 2019) was closed unmerged by its author in 2021.
- **Maintainer activity:** demoboard's last commit to master was 2019-09-21, and dependabot PRs have sat open since 2020–2021. Merge, and therefore payout, is uncertain no matter which PR is better.
- The repo has no CONTRIBUTING file and no AI-contribution policy. Commit convention (`feat: ...`) is followed.

## PR title

```
feat: allow to configure social links
```

## PR body

~~~markdown
Closes #19

Adds a `socialLinks` option to `mount()` that shows GitHub, Twitter, donate and custom links in a fixed section at the bottom of the sidebar, as discussed in #19 (fixed bottom section, Feather icons).

```js
mount(demoboard, '#app', {
  socialLinks: {
    github: 'egoist/demoboard',      // or a full URL
    twitter: '_egoistlily',          // or a full URL
    donate: 'https://patreon.com/egoist',
    custom: [
      { title: 'Website', link: 'https://egoist.sh' },                    // link icon + title
      { title: 'Discord', link: 'https://chat.egoist.moe', icon: <Icon /> } // icon only
    ]
  }
})
```

- An ordered array form is also accepted: `[{ type: 'twitter', link }, { title, link }]`
- GitHub/Twitter accept `user/repo` / username shorthands; absolute URLs are kept as-is
- Built-in links are icon-only with tooltip + `aria-label`; custom links without an icon show their title
- Type lookup only checks own properties, so names like `constructor` are treated as custom links
- The board list now scrolls above the fixed section (long lists could not scroll before)
- Without `socialLinks` the sidebar renders exactly as before
- README section + TOC entry, and the demo shows all four link kinds

Checked with `xo` + `prettier` on the changed files, `bili`, the demo production build, and a Chromium check of the built demo (wide, short and mobile viewports).

IssueHunt: https://oss.issuehunt.io/r/egoist/demoboard/issues/19. This PR is submitted there for the funded bounty. I'd appreciate the IssueHunt reward being released to me when this is merged. Thanks!
~~~
