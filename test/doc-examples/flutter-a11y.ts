// steps/a11y.steps.ts
import type { Page } from '@playwright/test'
import { A11ySteps, type A11yExclusion } from 'playwright-e2e-kit/a11y'

const exclusions: A11yExclusion[] = [
  {
    rule: 'aria-allowed-role',
    attribute: '[flt-semantics-identifier="map"]',
    reason: 'The map view has a Flutter-generated role that axe rejects.',
    issue: '#1',
  },
]

export const makeA11y = (page: Page) => new A11ySteps(page, { exclusions })
