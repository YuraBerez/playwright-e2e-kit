import { errorGuardsOf } from './error-guard.js';
/** The `Origin` of a request, or `undefined` (same-origin navigation, no header). */
async function originOf(request) {
    return (await request.headerValue('origin')) ?? undefined;
}
/**
 * CORS headers for `origin`. `expose` lists the extra headers the app may read: with credentials,
 * the browser takes `*` literally, so each name is listed too.
 */
function corsHeaders(origin, expose = []) {
    const exposed = { 'access-control-expose-headers': [...expose, '*'].join(', ') };
    return origin
        ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', ...exposed, vary: 'Origin' }
        : { 'access-control-allow-origin': '*', ...exposed };
}
function isPreflight(request) {
    return request.method() === 'OPTIONS' && request.headers()['access-control-request-method'] !== undefined;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
export async function networkFault(target, options) {
    const times = options.times ?? 1;
    if (!Number.isInteger(times) || times < 1)
        throw new Error(`networkFault: times must be a positive integer, got ${times}.`);
    const cors = options.cors ?? true;
    const method = options.method?.toUpperCase();
    const context = 'context' in target && typeof target.context === 'function' ? target.context() : target;
    const reason = options.reason ?? `networkFault: ${options.status} on purpose`;
    const body = options.body === undefined ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    const contentType = options.body === undefined || typeof options.body === 'string' ? undefined : 'application/json';
    let hits = 0;
    let removed = false;
    const remove = async () => {
        if (removed)
            return;
        removed = true;
        await target.unroute(options.url, handler);
    };
    async function handler(route, request) {
        if (removed || hits >= times)
            return route.fallback();
        if (isPreflight(request)) {
            const requested = request.headers()['access-control-request-method']?.toUpperCase();
            if (!cors || (method !== undefined && requested !== method))
                return route.fallback();
            return route.fulfill({
                status: 204,
                headers: {
                    ...corsHeaders(await originOf(request)),
                    'access-control-allow-methods': requested || '*',
                    'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? '*',
                    'access-control-max-age': '0',
                },
            });
        }
        if (method !== undefined && request.method() !== method)
            return route.fallback();
        hits++;
        for (const guard of errorGuardsOf(context)) {
            const exact = new RegExp(`^${escapeRegExp(request.url())}$`);
            if (options.status >= guard.minStatus) {
                guard.expect({ kind: 'response5xx', message: `${request.method()} ${request.url()} -> ${options.status}`, reason, times: 1 });
            }
            // The browser's console echo of a failed response; its location is the request URL.
            guard.expect({ kind: 'console', message: exact, reason, times: 1 });
        }
        const headers = {
            ...(contentType ? { 'content-type': contentType } : {}),
            ...(cors ? corsHeaders(await originOf(request), Object.keys(options.headers ?? {})) : {}),
            ...options.headers,
        };
        await route.fulfill({ status: options.status, headers, body });
        if (hits >= times)
            await remove();
    }
    await target.route(options.url, handler);
    return {
        get hits() {
            return hits;
        },
        remove,
    };
}
//# sourceMappingURL=network-fault.js.map