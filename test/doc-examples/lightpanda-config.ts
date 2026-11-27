// playwright.config.ts
import { devices } from '@playwright/test'
import { defineE2EConfig } from 'playwright-e2e-kit/config'
import { lightpandaProjects, selectEngine } from 'playwright-e2e-kit/lightpanda'

export default defineE2EConfig({
  testDir: './e2e',
  // E2E_ENGINE=playwright or E2E_ENGINE=lightpanda keeps the projects of one engine (one CI job each).
  projects: selectEngine(
    lightpandaProjects({
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], baseURL: 'https://localhost:4173' },
    }),
  ),
})
