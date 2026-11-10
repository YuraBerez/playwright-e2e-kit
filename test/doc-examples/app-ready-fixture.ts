// fixtures/app.ts
import { test as base } from '@playwright/test'
import { appReadyFixture, type AppReady } from 'playwright-e2e-kit'

export const test = base.extend<{ appReady: AppReady | undefined }>(appReadyFixture())
