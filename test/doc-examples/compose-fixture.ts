// fixtures/app.ts
import { test as base } from '@playwright/test'
import { errorGuardFixture, type AppReady, type ErrorGuard } from 'playwright-e2e-kit'
import { composeErrorAllowList, composeFixture } from 'playwright-e2e-kit/compose'

export const test = base.extend<{ appReady: AppReady | undefined; errorGuard: ErrorGuard }>({
  ...composeFixture(), // instead of appReadyFixture()
  errorGuard: errorGuardFixture({ allow: composeErrorAllowList }),
})
