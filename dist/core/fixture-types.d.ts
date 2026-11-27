import type { TestInfo, WorkerInfo } from '@playwright/test';
/** The `use` callback of a fixture function. */
export type Use<T> = (value: T) => Promise<void>;
/**
 * Playwright reads the fixture function's source to find its dependencies and requires an
 * object-destructuring first argument. Depending on `browserName` (always available) satisfies
 * that without an empty pattern.
 */
export type NoDeps = {
    browserName: string;
};
/** Options of a test-scoped fixture. */
export interface TestFixtureOptions {
    auto?: boolean;
    option?: boolean;
    box?: boolean;
    timeout?: number;
    title?: string;
}
/** Options of a worker-scoped fixture. */
export interface WorkerFixtureOptions extends TestFixtureOptions {
    scope: 'worker';
}
/** A test fixture as the `[function, options]` tuple of `test.extend()`. */
export type TestFixture<T, Deps = NoDeps, O extends TestFixtureOptions = TestFixtureOptions> = [
    (deps: Deps, use: Use<T>, testInfo: TestInfo) => Promise<void>,
    O
];
/** A worker fixture (`scope: 'worker'`) as the `[function, options]` tuple of `test.extend()`. */
export type WorkerFixture<T, Deps = NoDeps, O extends WorkerFixtureOptions = WorkerFixtureOptions> = [
    (deps: Deps, use: Use<T>, workerInfo: WorkerInfo) => Promise<void>,
    O
];
/** A worker option with its default value. */
export type WorkerOption<T> = [T, {
    scope: 'worker';
    option: true;
}];
/** A test option with its default value. */
export type TestOption<T> = [T, {
    option: true;
}];
//# sourceMappingURL=fixture-types.d.ts.map