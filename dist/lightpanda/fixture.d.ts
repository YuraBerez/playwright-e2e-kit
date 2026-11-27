import type { PlaywrightWorkerArgs } from '@playwright/test';
import type { TestFixture, WorkerFixture, WorkerOption } from '../core/fixture-types.js';
import { type LightpandaServerOptions } from './server.js';
/** Worker options of `lightpandaFixture()`. */
export interface LightpandaWorkerOptions {
    /** Run the worker's tests in Lightpanda instead of `browserName`. Default `false`. */
    lightpanda: boolean;
    /** Options of the `lightpanda serve` process of each worker. */
    lightpandaOptions: LightpandaServerOptions;
}
/** Tests with this tag must render: they fail in Lightpanda. */
export declare const RENDER_REQUIRED_TAG = "@critical";
type Playwright = PlaywrightWorkerArgs['playwright'];
/**
 * `playwright` with `chromium.launch()` replaced by a Lightpanda launch. All other members are the
 * real ones, and a property set through the proxy (Playwright sets `_defaultLaunchOptions`) goes
 * to the real object.
 */
export declare function withLightpanda(playwright: Playwright, options: LightpandaServerOptions): Playwright;
/**
 * The Lightpanda switch: the `lightpanda` and `lightpandaOptions` worker options, and an override
 * of the `playwright` worker fixture. Spread into
 * `test.extend<{}, LightpandaWorkerOptions>({ ...lightpandaFixture() })`; turn it on per project
 * with `use: { lightpanda: true }` (`lightpandaProjects()` does it for you).
 *
 * With `lightpanda: true`, `playwright.chromium.launch()` starts a `lightpanda serve` process and
 * connects to it over CDP. Playwright's own `browser` fixture calls it, so the kit does not copy
 * that fixture: each Playwright version keeps its own. One process for each worker: one Lightpanda
 * connection holds one browser context, and a worker runs one test at a time. With `false` the
 * `playwright` fixture is the real one, so the other projects see no change. A test tagged
 * `@critical` fails in a Lightpanda project: a critical scenario must run in a browser that renders.
 */
export declare function lightpandaFixture(defaults?: LightpandaServerOptions): {
    lightpanda: WorkerOption<boolean>;
    lightpandaOptions: WorkerOption<LightpandaServerOptions>;
    playwright: WorkerFixture<typeof import("playwright-core"), {
        playwright: Playwright;
    } & LightpandaWorkerOptions>;
    lightpandaGuard: TestFixture<void, Pick<LightpandaWorkerOptions, "lightpanda">>;
};
export {};
//# sourceMappingURL=fixture.d.ts.map