// Real-browser self-tests of the kit: the same suite runs against a React, a Vue and a Flutter
// web fixture app, plus an Angular one (test/fixtures-apps/). `E2E_APP=react|vue|angular|flutter`
// runs one app only (CI matrix).
//
// React, Vue and Angular use the kit's default config (no app-ready hook, default `data-testid`): this
// proves that Flutter support changes nothing for them. The Angular spec adds one opt-in
// `angularReady` test. Only the Flutter project uses
// `flutterConfig()`.
import { devices, type PlaywrightTestConfig } from '@playwright/test'
import { defineE2EConfig } from 'playwright-e2e-kit/config'
import { flutterConfig } from 'playwright-e2e-kit/flutter'

type App = 'react' | 'vue' | 'angular' | 'flutter'

const APPS: Record<App, { port: number; out: string; testMatch: RegExp }> = {
  react: { port: 4301, out: 'test/fixtures-apps/react/dist', testMatch: /(specs\/web\.spec|self-tests\/.*\.test)\.ts$/ },
  vue: { port: 4302, out: 'test/fixtures-apps/vue/dist', testMatch: /(specs\/web\.spec|self-tests\/.*\.test)\.ts$/ },
  angular: {
    port: 4304,
    out: 'test/fixtures-apps/angular/dist/angular/browser',
    testMatch: /(specs\/(web|angular)\.spec|self-tests\/.*\.test)\.ts$/,
  },
  flutter: {
    port: 4303,
    out: 'test/fixtures-apps/flutter/build/web',
    testMatch: /(specs\/flutter\.spec|self-tests\/.*\.test)\.ts$/,
  },
}

const selected = process.env.E2E_APP
if (selected && !(selected in APPS)) throw new Error(`E2E_APP must be one of ${Object.keys(APPS).join(', ')}.`)
const apps = (selected ? [selected] : Object.keys(APPS)) as App[]
const root = new URL('..', import.meta.url).pathname
const baseURL = (app: App) => `http://localhost:${APPS[app].port}`

// `E2E_PREBUILT=1` (CI) serves the build output of `node e2e/prepare-app.mjs <app>` as it is.
const prepare = (app: App) => (process.env.E2E_PREBUILT ? '' : `node e2e/prepare-app.mjs ${app} && `)

const webServer: PlaywrightTestConfig['webServer'] = apps.map((app) => ({
  command: `${prepare(app)}node e2e/serve-static.mjs ${APPS[app].out} ${APPS[app].port}`,
  cwd: root,
  url: baseURL(app),
  reuseExistingServer: !process.env.CI,
  // The Flutter build takes about a minute on a cold runner.
  timeout: 300_000,
  stdout: 'ignore',
  stderr: 'pipe',
}))

const flutterUse = flutterConfig().use

export default defineE2EConfig({
  testDir: '.',
  outputDir: 'test-results',
  webServer,
  projects: apps.map((app) => ({
    name: app,
    testMatch: APPS[app].testMatch,
    use: {
      ...devices['Desktop Chrome'],
      ...(app === 'flutter' ? flutterUse : {}),
      baseURL: baseURL(app),
    },
  })),
})
