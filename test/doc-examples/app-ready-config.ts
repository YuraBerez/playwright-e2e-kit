// playwright.config.ts
import { nuxtReady } from 'playwright-e2e-kit'
import { defineE2EConfig } from 'playwright-e2e-kit/config'

export default defineE2EConfig({ testDir: './e2e' }, { appReady: nuxtReady })
