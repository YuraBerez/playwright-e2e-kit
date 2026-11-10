# Development and release

## Development

```bash
npm ci
npm run lint        # ESLint, check:no-product-refs, and a check that dist/ matches the sources
npm run type-check
npm test            # Vitest; npm run test:coverage for the coverage report
npm run build       # writes dist/; commit it with the source change
```

**`check:no-product-refs`** keeps the kit project-agnostic. It fails when a tracked file, a commit
message or a tag message contains a term from the deny-list, or a URL whose host is not on the
allow-list. The deny-list comes from the `NO_PRODUCT_REFS` environment variable (comma separated)
and from the git-ignored file `.no-product-refs` (one term or `/regex/` per line). The list is never
committed, so it cannot name a product either.

## Release checklist

The kit runs its own suite in a real Chromium against five fixture apps
(`test/fixtures-apps/`: React, Vue, Angular, Flutter web, Compose Multiplatform web; the Compose
app also runs in WebKit: project `compose-webkit`; Firefox, project `compose-firefox`, only locally with `E2E_COMPOSE_FIREFOX=1`, because the app crashes at startup in headless Firefox in CI), with
`npm run test:e2e` (`E2E_APP=<app>` for one app; Flutter needs the `flutter` SDK, Compose needs a
JDK 21 in `JAVA_HOME` and builds with its Gradle wrapper). Before you push a `v*` tag:

1. CI on the release commit is green: the `gate` job and **all five** `e2e` jobs (react, vue,
   angular, flutter, and compose, which runs through the reusable `compose-e2e.yml`).
2. `dist/` matches the sources (`npm run lint` checks it).
3. A change that breaks a consumer has a new major version.

