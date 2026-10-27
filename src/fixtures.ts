import type { BrowserContext } from '@playwright/test'
import { CleanupRegistry, formatCleanupFailures, type CleanupFailure, type ResourceFactory } from './data.js'
import { ErrorGuard, type ErrorGuardOptions } from './error-guard.js'

/**
 * Playwright reads the fixture function's source to find its dependencies and requires an
 * object-destructuring first argument. Depending on `browserName` (always available) satisfies
 * that without an empty pattern.
 */
type NoDeps = { browserName: string }

type Use<T> = (value: T) => Promise<void>

/**
 * A fixture that creates a fresh resource for the test and destroys it at teardown, also when the
 * test fails.
 */
export function resourceFixture<T>(factory: ResourceFactory<T>) {
  return async ({ browserName: _browserName }: NoDeps, use: Use<T>): Promise<void> => {
    const resource = await factory.create()
    try {
      await use(resource)
    } finally {
      await factory.destroy(resource)
    }
  }
}

export interface CleanupFixtureOptions {
  /** `warn` (default) logs failed cleanup tasks; `throw` fails the test. */
  onFailure?: 'warn' | 'throw'
}

/** A fixture that gives the test a `CleanupRegistry` and runs it at teardown. */
export function cleanupFixture(options: CleanupFixtureOptions = {}) {
  return async ({ browserName: _browserName }: NoDeps, use: Use<CleanupRegistry>): Promise<void> => {
    const registry = new CleanupRegistry()
    let failures: CleanupFailure[]
    try {
      await use(registry)
    } finally {
      // Runs also when the test failed; the test's own error stays the reported one.
      failures = await registry.runAll()
      if (failures.length > 0 && options.onFailure !== 'throw') console.warn(formatCleanupFailures(failures))
    }
    if (failures.length > 0 && options.onFailure === 'throw') throw new Error(formatCleanupFailures(failures))
  }
}

/**
 * The error guard as an auto fixture: it watches the test's browser context and fails the test at
 * teardown. Watch extra contexts with `errorGuard.watch(context)`.
 */
export function errorGuardFixture(
  options: ErrorGuardOptions = {},
): [({ context }: { context: BrowserContext }, use: Use<ErrorGuard>) => Promise<void>, { auto: true }] {
  return [
    async ({ context }: { context: BrowserContext }, use: Use<ErrorGuard>): Promise<void> => {
      const guard = new ErrorGuard(options)
      await guard.watch(context)
      await use(guard)
      guard.assertClean()
    },
    { auto: true },
  ]
}
