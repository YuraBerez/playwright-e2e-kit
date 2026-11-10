// fixtures/app.ts
import { test as base } from '@playwright/test'
import { appReadyFixture, type AppReady } from 'playwright-e2e-kit'

// Playwright's fixture types do not accept a function as an option value, so the cast is typing only.
export const test = base.extend<{ appReady: AppReady | undefined }>(appReadyFixture() as never)
