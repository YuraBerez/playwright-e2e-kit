// playwright.config.ts
import { composeConfig } from 'playwright-e2e-kit/compose'

export default composeConfig({ testDir: './e2e', use: { baseURL: 'http://localhost:8080' } })
