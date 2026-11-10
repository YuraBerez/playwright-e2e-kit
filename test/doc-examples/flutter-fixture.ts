// fixtures/app.ts
import { test as base } from '@playwright/test'
import { errorGuardFixture, type AppReady, type ErrorGuard } from 'playwright-e2e-kit'
import { flutterErrorAllowList, flutterFixture } from 'playwright-e2e-kit/flutter'

export const test = base.extend<{ appReady: AppReady | undefined; errorGuard: ErrorGuard }>({
  ...flutterFixture(), // instead of appReadyFixture()
  errorGuard: errorGuardFixture({ allow: flutterErrorAllowList }),
})
