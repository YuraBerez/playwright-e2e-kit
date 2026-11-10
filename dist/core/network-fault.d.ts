import type { BrowserContext, Page } from '@playwright/test';
/** URL matcher, as for `page.route()`: a glob string, a RegExp or a predicate. */
export type NetworkFaultUrl = string | RegExp | ((url: URL) => boolean);
export interface NetworkFaultOptions {
    /** The calls to answer, as for `page.route()`: a glob string, a RegExp or a predicate. */
    url: NetworkFaultUrl;
    /** HTTP status of the fault, for example 401 (token refresh) or 503. */
    status: number;
    /** How many matching calls get the fault. Later calls go to the server. Default 1. */
    times?: number;
    /** Only calls with this HTTP method (case does not matter). Default: every method but a CORS preflight. */
    method?: string;
    /** Response body. A string is sent as it is; any other value is sent as JSON. Default: empty. */
    body?: unknown;
    /** Extra response headers. */
    headers?: Record<string, string>;
    /**
     * Add CORS headers (the request's `Origin`, credentials allowed, the `headers` exposed) and answer
     * the CORS preflight of the matching calls, so that a cross-origin app can read the fault and its
     * headers (for example `www-authenticate`) as it reads a real server response. Default `true`.
     */
    cors?: boolean;
    /** Why the test causes the fault. Shown in the error guard entry. */
    reason?: string;
}
/** A fault set up by `networkFault`. */
export interface NetworkFault {
    /** How many calls got the fault so far. */
    readonly hits: number;
    /** Removes the route before all faults are used. Later calls go to the server. */
    remove(): Promise<void>;
}
/**
 * Answers the next `times` calls that match `url` with `status` (for example a 401 for a
 * token-refresh test), then lets the calls go to the server again. With `cors` (the default) it
 * adds CORS headers and answers the preflight, so the browser gives the response to the app.
 *
 * Each error guard that watches the page's context (`errorGuardFixture()`) is told that the faulted
 * response is expected: a 5xx fault and the browser's console echo of it ("Failed to load
 * resource") do not fail the test. Other errors still do.
 *
 * Call it before the action that sends the calls. It works on a page or a whole context.
 */
export declare function networkFault(target: Page | BrowserContext, options: NetworkFaultOptions): Promise<NetworkFault>;
//# sourceMappingURL=network-fault.d.ts.map