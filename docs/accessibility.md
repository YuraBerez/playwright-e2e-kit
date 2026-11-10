# Accessibility

`new A11ySteps(page, { exclusions })` (from `playwright-e2e-kit/a11y`) gives
`expectNoViolations()`. It audits the screen or state that the page shows now against WCAG 2.0/2.1
**A and AA** rules, and fails with each violation: rule, impact, help URL and the nodes.

Fix violations in the app. Only when a fix must wait, add an exclusion: one axe rule on one
matcher, with a reason and a follow-up issue. The matcher is one of:

- `selector`: exact CSS selector, compared as a whole with the axe `node.target`;
- `attribute`: attribute selector, for example `[flt-semantics-identifier="map"]`; matches each
  node whose target contains it, so a changed tag or parent does not break it;
- `selectorPattern`: a RegExp tested against each part of the target, for generated ids
  (`/^#flt-sem-\d+$/`).

When the audit fails, the full axe report (all violations, before exclusions, and the remaining
ones) is attached to the test as `axe-report.json`. Never disable a rule for all elements. The
exclusions file is the only place where raw CSS is allowed in an e2e suite. Axe cannot check all
items (reading order, focus management, screen-reader behaviour), so keep manual checks.

**Third-party iframes.** Axe also audits the content of iframes, so a violation inside an embedded
frame fails the step. A node in a frame has a nested `target`: the iframe selector first, then the
node. To exclude a frame, match the first part (the iframe) with a matcher, for one rule:

```ts
const exclusions: A11yExclusion[] = [
  {
    rule: 'color-contrast',
    selector: '#payment-frame',
    reason: 'Third-party widget: we cannot change its markup.',
    issue: '#13',
  },
]
```

A frame that you do not own cannot be fixed in the app, so the exclusion is allowed there.
Keep one entry per rule and frame; do not exclude the iframe for all rules.

