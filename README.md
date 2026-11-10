# playwright-e2e-kit

A project-agnostic kit for Playwright end-to-end suites. It gives a suite three layers (screens,
steps, specs) plus a data layer, and ESLint rules that enforce the layers. It also has a browser
error guard, an axe accessibility step, a cleanup registry and a base Playwright config.

The kit has no application code. Each application keeps its own screens, steps, specs, its
data-layer implementation, its targets and its credentials.

## Install

The kit is a git dependency. There is no registry and no publish step. Pin an exact tag:

```bash
npm install --save-dev "github:YuraBerez/playwright-e2e-kit#v0.3.0"
```

The built output (`dist/`) is committed, so the install does not build anything and works with
`npm ci`. Peer dependencies: `@playwright/test` (required), `@axe-core/playwright` (only for
`playwright-e2e-kit/a11y`) and `eslint` (only for `playwright-e2e-kit/eslint`).

The package also ships `src/` and the source maps (`dist/**/*.map`), so "Go to Definition" in an IDE and stack traces point to the `.ts` files.

**Move the pin:** change the tag in `package.json`, run `npm install`, and commit
`package.json` and `package-lock.json` together. A change that breaks a consumer gets a new major
version.

| Import | Contents |
|---|---|
| `playwright-e2e-kit` | `BaseScreen`, `BaseComponent`, `BaseSteps`, `boxSteps`, `ErrorGuard`, `errorGuardFixture`, `ResourceFactory`, `resourceFixture`, `workerResourceFixture`, `sessionPerWorker`, `CleanupRegistry`, `cleanupFixture`, `networkFault`, `deterministicUse`, `appReadyFixture`, `AppReady`, `appReadyOption`, `domContentReady`, `nuxtReady`, `angularReady` |
| `playwright-e2e-kit/a11y` | `A11ySteps`, `A11yExclusion`, `withoutExclusions`, `formatViolations` |
| `playwright-e2e-kit/config` | `defineE2EConfig`, `baseConfig`, `quarantineGrepInvert` |
| `playwright-e2e-kit/eslint` | `e2eLayerRules()` (flat config) |
| `playwright-e2e-kit/flutter` | Flutter web only (opt-in; the main entry never imports it): `flutterConfig`, `flutterFixture`, `flutterReady`, `enableFlutterSemantics`, `installFlutterFirstFrameListener`, `FlutterScreen`, `scrollUntilVisible`, `flutterType`, `flutterErrorAllowList` |
| `playwright-e2e-kit/compose` | Compose Multiplatform web (wasmJs) only (opt-in; no other entry imports it): `composeConfig`, `composeFixture`, `composeReady`, `composeTap`, `composeType`, `composeClear`, `composeReadText`, `composeScrollUntilVisible`, `ComposeScreen`, `scrollUntilVisible`, `composeErrorAllowList`, `diagnoseCompose` |

## Minimal example

```ts
// playwright.config.ts
import { defineE2EConfig } from 'playwright-e2e-kit/config'

export default defineE2EConfig({
  testDir: './e2e',
  use: { baseURL: 'https://localhost:4173' },
})
```

```ts
// e2e/screens/login.screen.ts
import { expect } from '@playwright/test'
import { BaseScreen } from 'playwright-e2e-kit'

export class LoginScreen extends BaseScreen {
  readonly path = '/login'
  private readonly emailInput = this.page.getByLabel('Email')
  private readonly submitButton = this.page.getByRole('button', { name: 'Sign in' })

  async signIn(email: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.submitButton.click()
  }

  async verifyOpen(): Promise<void> {
    await expect(this.submitButton).toBeVisible()
  }
}
```

The layers, fixtures, error guard and the other parts are in the guides below.

## Documentation

| Guide | Contents |
|---|---|
| [docs/README.md](docs/README.md) | Index of all guides |
| [Layout and layers](docs/layers.md) | Directory layout, page objects, steps, specs |
| [Fixtures and data](docs/fixtures.md) | Resources, cleanup, worker-scoped data and sessions |
| [Error guard](docs/error-guard.md) | Browser errors that fail a test, allow lists |
| [Network faults](docs/network-fault.md) | `networkFault`: answer calls with errors |
| [Accessibility](docs/accessibility.md) | `A11ySteps`, exclusions |
| [Config](docs/config.md) | `defineE2EConfig`, app-ready hook, timeouts, traces and secrets |
| [Flutter web](docs/flutter-web.md) | `playwright-e2e-kit/flutter` |
| [Compose Multiplatform web](docs/compose-web.md) | `playwright-e2e-kit/compose`, troubleshooting |
| [Compose MP web in CI](docs/ci.md) | Reusable GitHub Actions workflow |
| [Framework matrix](docs/framework-matrix.md) | What each framework gets by default |
| [Conventions](docs/conventions.md) | Flakes, determinism, tags, naming, tests, text matching |
| [ESLint rules](docs/eslint-rules.md) | `e2eLayerRules()` |
| [Development and release](docs/development.md) | Local commands, release checklist |

## License

MIT
