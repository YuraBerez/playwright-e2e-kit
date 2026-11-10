# playwright-e2e-kit documentation

The [main README](../README.md) has the install steps, the import table and a minimal example.
These guides hold the detail.

## Structure of a suite

- [Layout and layers](layers.md): directory layout, page objects, steps, specs.
- [Fixtures and data](fixtures.md): resources, cleanup, worker-scoped data and sessions.
- [Conventions](conventions.md): flakes, determinism, tags, naming, self-tests, text matching
  (`\b` and non-ASCII).
- [ESLint rules](eslint-rules.md): `e2eLayerRules()` and what each rule forbids.

## Checks and configuration

- [Config](config.md): `defineE2EConfig`, app-ready hook, timeouts for slow backends, traces and
  secrets.
- [Error guard](error-guard.md): browser errors that fail a test, allow lists.
- [Network faults](network-fault.md): `networkFault`, expected errors.
- [Accessibility](accessibility.md): `A11ySteps` and exclusions.

## Frameworks

- [Framework matrix](framework-matrix.md): what each framework gets by default.
- [Flutter web](flutter-web.md): `playwright-e2e-kit/flutter`.
- [Compose Multiplatform web](compose-web.md): `playwright-e2e-kit/compose`, troubleshooting.
- [Compose MP web in CI](ci.md): the reusable GitHub Actions workflow.

## Working on the kit

- [Development and release](development.md): local commands, the product-name check, release checklist.
