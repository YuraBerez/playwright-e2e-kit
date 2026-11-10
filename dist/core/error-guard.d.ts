import type { BrowserContext } from '@playwright/test';
/** The collector that reported an error. */
export type ErrorKind = 'pageerror' | 'console' | 'response5xx' | 'requestfailed';
/**
 * A known, expected error that the guard must not fail on. Keep the list empty if at all possible:
 * each entry hides a real defect class, so give it a reason and a tracking issue.
 */
export interface AllowedError {
    /** One kind, or a list: one entry then covers each listed kind (for example a third-party origin). */
    kind: ErrorKind | readonly ErrorKind[];
    /** Substring (string) or RegExp, tested against the message and the failing URL. */
    message: string | RegExp;
    /** Why this is expected, and the issue that tracks its removal. */
    reason: string;
}
/**
 * An error that the test causes on purpose (for example a fault answered by `networkFault`). Unlike
 * an `AllowedError`, it is added while the test runs and, with `times`, matches only that many
 * errors.
 */
export interface ExpectedError extends AllowedError {
    /** How many errors the entry matches. Default: no limit (until the test ends). */
    times?: number;
}
export interface CollectedError {
    kind: ErrorKind;
    text: string;
    url: string;
}
export interface ErrorGuardOptions {
    /** Allow-list hook: errors that match an entry are not reported. */
    allow?: readonly AllowedError[];
    /**
     * Status from which a response counts as a server error. Default 500: 4xx never fail the guard,
     * so negative tests (401, 409, 400) stay green.
     */
    minStatus?: number;
}
/**
 * A request that the browser cancelled itself (navigation away, superseded fetch) is benign.
 * Chromium reports `net::ERR_ABORTED`; WebKit reports `cancelled` or, for a reload or navigation,
 * `Load request cancelled`. Each string is exempt on its own engine only, so a stray "cancelled"
 * elsewhere is still reported.
 */
export declare function isBenignAbort(failure: string, browserName: string | undefined): boolean;
/** Chromium and WebKit echo every 4xx response as a console error; that echo is not a defect. */
export declare function isClientErrorEcho(consoleText: string): boolean;
/** True when an allow-list entry matches the error (same kind, message or URL matches). */
export declare function isAllowed(error: CollectedError, allow: readonly AllowedError[]): boolean;
/** Numbered, readable report of the collected errors. */
export declare function formatErrors(errors: readonly CollectedError[]): string;
/** Init script: a CSP violation becomes a `console.error`, so the guard reports it. */
export declare const CSP_VIOLATION_SCRIPT = "try {\n        document.addEventListener('securitypolicyviolation', (e) => {\n          console.error('CSP violation: ' + e.violatedDirective + ' blocked ' + (e.blockedURI || '(inline)'))\n        })\n      } catch (_) {\n        /* about:blank and sandboxed frames can throw on some APIs: never break the page */\n      }";
/** The error guards that watch `context` (`errorGuardFixture()` or `errorGuard.watch(context)`). */
export declare function errorGuardsOf(context: BrowserContext): readonly ErrorGuard[];
/**
 * Collects silent failures that no `expect` looks for: uncaught page errors, `console.error`,
 * responses with status >= `minStatus`, CSP violations, and failed requests (network level),
 * across every page of the watched browser contexts.
 */
export declare class ErrorGuard {
    private readonly errors;
    private readonly allow;
    private readonly expected;
    /** Responses with a status from this value on are reported (`response5xx`). */
    readonly minStatus: number;
    constructor(options?: ErrorGuardOptions);
    /** Errors collected so far (after the allow-list). */
    get collected(): readonly CollectedError[];
    watch(context: BrowserContext): Promise<void>;
    /**
     * Tells the guard that the test causes this error on purpose. It is matched as an allow-list
     * entry (same kind, message or URL), but only while the test runs and, with `times`, only that
     * many times. `networkFault` calls it for each fault that it answers.
     */
    expect(error: ExpectedError): void;
    private add;
    /** Throws a readable list (kind, message, URL) if anything was collected. */
    assertClean(): void;
}
//# sourceMappingURL=error-guard.d.ts.map