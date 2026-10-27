import type { BrowserContext } from '@playwright/test';
/** The collector that reported an error. */
export type ErrorKind = 'pageerror' | 'console' | 'response5xx' | 'requestfailed';
/**
 * A known, expected error that the guard must not fail on. Keep the list empty if at all possible:
 * each entry hides a real defect class, so give it a reason and a tracking issue.
 */
export interface AllowedError {
    kind: ErrorKind;
    /** Substring (string) or RegExp, tested against the message and the failing URL. */
    message: string | RegExp;
    /** Why this is expected, and the issue that tracks its removal. */
    reason: string;
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
export declare const CSP_VIOLATION_SCRIPT = "document.addEventListener('securitypolicyviolation', (e) => {\n        console.error('CSP violation: ' + e.violatedDirective + ' blocked ' + (e.blockedURI || '(inline)'))\n      })";
/**
 * Collects silent failures that no `expect` looks for: uncaught page errors, `console.error`,
 * responses with status >= `minStatus`, CSP violations, and failed requests (network level),
 * across every page of the watched browser contexts.
 */
export declare class ErrorGuard {
    private readonly errors;
    private readonly allow;
    private readonly minStatus;
    constructor(options?: ErrorGuardOptions);
    /** Errors collected so far (after the allow-list). */
    get collected(): readonly CollectedError[];
    watch(context: BrowserContext): Promise<void>;
    private add;
    /** Throws a readable list (kind, message, URL) if anything was collected. */
    assertClean(): void;
}
