### 🤔 This is a ...

- [x] ⌨️ Accessibility improvement
- [x] ✅ Test Case

### 🔗 Related Issues

Refs #11600

IssueHunt: https://oss.issuehunt.io/r/ant-design/ant-design/issues/11600

### 💡 Background and Solution

#11600 asked for proper `listbox` / `option` roles in Select. Current Select already renders an `input[role="combobox"]` that controls a `role="listbox"` popup of `role="option"` items. This contribution adds regression coverage for the open popup; the existing demo accessibility check covers closed selects.

The `Select popup a11y` block in `components/select/__tests__/a11y.test.tsx` (renamed from `.ts`, preserving the original demo check):

- checks `aria-haspopup`, `aria-expanded`, `aria-controls` and the listbox ID, and option `aria-selected` / `aria-disabled`;
- checks that virtual mode's `aria-activedescendant` references an option and that multiple mode marks every selected option;
- runs axe on inline open popups for single, nonvirtual, searchable, multiple, tags and nonvirtual grouped selections.

Audit notes, outside this test-only patch:

- Virtual grouped options had `role="presentation"` with `aria-selected`; react-component/select#1226 addresses this in `@rc-component/select@1.11.0`. The reviewed antd source pinned `~1.10.1`, so the grouped regression here uses `virtual={false}`.
- Empty popups have separate empty-listbox / missing-active-descendant issues. A companion react-component/select source patch is prepared; these cases are not claimed fixed by this antd PR.

### Validation

The original patch was checked against `36627e209ec37c3ea6784b093053b1d4207b6d38` with `npm test -- components/select`, touched-file eslint/biome/prettier and `npx tsc --noEmit`. The retained result reports the Select tests and those checks passed. Publication preserves the exact tested new file (Git blob `d75191486f4a12149726df9e07f136913a2756c2`) and verifies the original file still matches its patch preimage. No tests or builds were rerun during publication.

### 📝 Change Log

| Language | Changelog |
| --- | --- |
| 🇺🇸 English | No changelog required (test only) |
| 🇨🇳 Chinese | 无需更新日志（仅测试） |

### IssueHunt compensation

This is @woahwhattheheck's contribution for the advertised $35 IssueHunt bounty on #11600. I request acceptance and the applicable reward/payment for this additional accessibility coverage. After merge, I will submit this same PR on the IssueHunt issue page for maintainer approval. The closed issue's existing implementation and contributor credit remain intact; this request does not assert that an award or payment has already occurred.
