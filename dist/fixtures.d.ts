import type { BrowserContext } from '@playwright/test';
import { CleanupRegistry, type ResourceFactory } from './data.js';
import { ErrorGuard, type ErrorGuardOptions } from './error-guard.js';
/**
 * Playwright reads the fixture function's source to find its dependencies and requires an
 * object-destructuring first argument. Depending on `browserName` (always available) satisfies
 * that without an empty pattern.
 */
type NoDeps = {
    browserName: string;
};
type Use<T> = (value: T) => Promise<void>;
/**
 * A fixture that creates a fresh resource for the test and destroys it at teardown, also when the
 * test fails.
 */
export declare function resourceFixture<T>(factory: ResourceFactory<T>): ({ browserName: _browserName }: NoDeps, use: Use<T>) => Promise<void>;
export interface CleanupFixtureOptions {
    /** `warn` (default) logs failed cleanup tasks; `throw` fails the test. */
    onFailure?: 'warn' | 'throw';
}
/** A fixture that gives the test a `CleanupRegistry` and runs it at teardown. */
export declare function cleanupFixture(options?: CleanupFixtureOptions): ({ browserName: _browserName }: NoDeps, use: Use<CleanupRegistry>) => Promise<void>;
/**
 * The error guard as an auto fixture: it watches the test's browser context and fails the test at
 * teardown. Watch extra contexts with `errorGuard.watch(context)`.
 */
export declare function errorGuardFixture(options?: ErrorGuardOptions): [({ context }: {
    context: BrowserContext;
}, use: Use<ErrorGuard>) => Promise<void>, {
    auto: true;
}];
export {};
