/**
 * A request that the browser cancelled itself (navigation away, superseded fetch) is benign.
 * Chromium reports `net::ERR_ABORTED`; WebKit reports `cancelled` or, for a reload or navigation,
 * `Load request cancelled`. Each string is exempt on its own engine only, so a stray "cancelled"
 * elsewhere is still reported.
 */
export function isBenignAbort(failure, browserName) {
    if (failure === 'net::ERR_ABORTED')
        return browserName !== 'webkit';
    return browserName === 'webkit' && /^(load request )?cancelled$/i.test(failure);
}
/** Chromium and WebKit echo every 4xx response as a console error; that echo is not a defect. */
export function isClientErrorEcho(consoleText) {
    return /^Failed to load resource: .*status of 4\d\d/.test(consoleText);
}
/** True when an allow-list entry matches the error (same kind, message or URL matches). */
export function isAllowed(error, allow) {
    return allow.some((rule) => rule.kind === error.kind &&
        (typeof rule.message === 'string'
            ? error.text.includes(rule.message) || error.url.includes(rule.message)
            : matches(rule.message, error.text) || matches(rule.message, error.url)));
}
/** Tests a RegExp without state: a `g` or `y` flag would keep `lastIndex` between calls and skip matches. */
function matches(pattern, value) {
    return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '')).test(value);
}
/** Numbered, readable report of the collected errors. */
export function formatErrors(errors) {
    const lines = errors.map((e, i) => `  ${i + 1}. [${e.kind}] ${e.text}\n     at ${e.url || '(no url)'}`);
    return `Error guard: ${errors.length} unexpected browser/server error(s) during the test:\n${lines.join('\n')}`;
}
/** Init script: a CSP violation becomes a `console.error`, so the guard reports it. */
export const CSP_VIOLATION_SCRIPT = `document.addEventListener('securitypolicyviolation', (e) => {
        console.error('CSP violation: ' + e.violatedDirective + ' blocked ' + (e.blockedURI || '(inline)'))
      })`;
/**
 * Collects silent failures that no `expect` looks for: uncaught page errors, `console.error`,
 * responses with status >= `minStatus`, CSP violations, and failed requests (network level),
 * across every page of the watched browser contexts.
 */
export class ErrorGuard {
    errors = [];
    allow;
    minStatus;
    constructor(options = {}) {
        this.allow = options.allow ?? [];
        this.minStatus = options.minStatus ?? 500;
    }
    /** Errors collected so far (after the allow-list). */
    get collected() {
        return this.errors;
    }
    async watch(context) {
        const browserName = context.browser()?.browserType().name();
        // Init scripts are exempt from the page's own CSP.
        await context.addInitScript({ content: CSP_VIOLATION_SCRIPT });
        context.on('weberror', (webError) => {
            const error = webError.error();
            this.add({
                kind: 'pageerror',
                text: error.stack?.split('\n').slice(0, 3).join(' | ') ?? error.message,
                url: webError.page()?.url() ?? '',
            });
        });
        context.on('console', (msg) => {
            if (msg.type() !== 'error')
                return;
            const text = msg.text();
            // Network-level failures ("net::ERR_…") and 5xx echoes are NOT skipped here.
            if (isClientErrorEcho(text))
                return;
            this.add({ kind: 'console', text, url: msg.location().url || msg.page()?.url() || '' });
        });
        context.on('requestfailed', (request) => {
            const failure = request.failure()?.errorText ?? 'unknown failure';
            // Every failure but a self-cancelled request (refused, DNS, CORS, reset) means the app could not reach its server.
            if (isBenignAbort(failure, browserName))
                return;
            this.add({ kind: 'requestfailed', text: `${request.method()} ${request.url()} -> ${failure}`, url: request.url() });
        });
        context.on('response', (response) => {
            if (response.status() < this.minStatus)
                return;
            this.add({
                kind: 'response5xx',
                text: `${response.request().method()} ${response.url()} -> ${response.status()}`,
                url: response.url(),
            });
        });
    }
    add(error) {
        if (!isAllowed(error, this.allow))
            this.errors.push(error);
    }
    /** Throws a readable list (kind, message, URL) if anything was collected. */
    assertClean() {
        if (this.errors.length === 0)
            return;
        throw new Error(formatErrors(this.errors));
    }
}
