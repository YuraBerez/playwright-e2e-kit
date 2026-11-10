// fixtures/app.ts
import { test as base } from '@playwright/test'
import { errorGuardFixture, type AppReady, type ErrorGuard } from 'playwright-e2e-kit'
import { flutterErrorAllowList, flutterFixture } from 'playwright-e2e-kit/flutter'

// Playwright's fixture types do not accept a function as an option value, so the cast is typing only.
export const test = base.extend<{ appReady: AppReady | undefined; errorGuard: ErrorGuard }>({
  ...(flutterFixture() as object), // instead of appReadyFixture()
  errorGuard: errorGuardFixture({ allow: flutterErrorAllowList }),
})
