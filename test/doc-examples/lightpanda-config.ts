// playwright.config.ts
import { devices } from '@playwright/test'
import { defineE2EConfig } from 'playwright-e2e-kit/config'
import { lightpandaProjects } from 'playwright-e2e-kit/lightpanda'

export default defineE2EConfig({
  testDir: './e2e',
  projects: lightpandaProjects({
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], baseURL: 'https://localhost:4173' },
  }),
})
