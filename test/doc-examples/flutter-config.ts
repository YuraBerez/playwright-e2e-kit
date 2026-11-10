// playwright.config.ts
import { flutterConfig } from 'playwright-e2e-kit/flutter'

export default flutterConfig({ testDir: './e2e', use: { baseURL: 'http://localhost:8080' } })
