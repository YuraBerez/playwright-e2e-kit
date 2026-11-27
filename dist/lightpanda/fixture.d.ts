import type { Browser, PlaywrightWorkerArgs, PlaywrightWorkerOptions, TestInfo, WorkerInfo } from '@playwright/test';
import { type LightpandaServerOptions } from './server.js';
type Use<T> = (value: T) => Promise<void>;
/** Worker options of `lightpandaFixture()`. */
export interface LightpandaWorkerOptions {
    /** Run the worker's tests in Lightpanda instead of `browserName`. Default `false`. */
    lightpanda: boolean;
    /** Options of the `lightpanda serve` process of each worker. */
    lightpandaOptions: LightpandaServerOptions;
}
/** Tests with this tag must render: they fail in Lightpanda. */
export declare const RENDER_REQUIRED_TAG = "@critical";
type BrowserArgs = Pick<PlaywrightWorkerArgs, 'playwright'> & Pick<PlaywrightWorkerOptions, 'browserName' | 'connectOptions'> & LightpandaWorkerOptions & {
    /** Playwright's internal auto fixture with the resolved launch options (sent to a remote browser). */
    _browserOptions?: Record<string, unknown>;
};
/**
 * The `browser` worker fixture with a Lightpanda switch, plus the `lightpanda` and
 * `lightpandaOptions` worker options. Spread into
 * `test.extend<{}, LightpandaWorkerOptions>({ ...lightpandaFixture() })`; turn it on per project
 * with `use: { lightpanda: true }` (`lightpandaProjects()` does it for you).
 *
 * With `lightpanda: true` each worker starts its own `lightpanda serve` process (one Lightpanda
 * connection holds one browser context, and Playwright runs one test per worker at a time) and
 * connects over CDP. With `false` it does what Playwright's own `browser` fixture does, so the
 * other projects see no change. A test tagged `@critical` fails in a Lightpanda project: a critical
 * scenario must run in a browser that renders.
 */
export declare function lightpandaFixture(defaults?: LightpandaServerOptions): {
    lightpanda: [boolean, {
        scope: "worker";
        option: true;
    }];
    lightpandaOptions: [LightpandaServerOptions, {
        scope: "worker";
        option: true;
    }];
    browser: [(args: BrowserArgs, use: Use<Browser>, workerInfo: WorkerInfo) => Promise<void>, {
        scope: "worker";
        timeout: 0;
    }];
    lightpandaGuard: [(args: Pick<LightpandaWorkerOptions, "lightpanda">, use: Use<void>, testInfo: TestInfo) => Promise<void>, {
        auto: true;
    }];
};
export {};
//# sourceMappingURL=fixture.d.ts.map