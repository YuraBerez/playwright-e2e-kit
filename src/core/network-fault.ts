import type { BrowserContext, Page, Request, Route } from '@playwright/test'
import { errorGuardsOf } from './error-guard.js'

/** URL matcher, as for `page.route()`: a glob string, a RegExp or a predicate. */
export type NetworkFaultUrl = string | RegExp | ((url: URL) => boolean)

export interface NetworkFaultOptions {
  /** The calls to answer, as for `page.route()`: a glob string, a RegExp or a predicate. */
  url: NetworkFaultUrl
  /** HTTP status of the fault, for example 401 (token refresh) or 503. */
  status: number
  /** How many matching calls get the fault. Later calls go to the server. Default 1. */
  times?: number
  /** Only calls with this HTTP method (case does not matter). Default: every method but a CORS preflight. */
  method?: string
  /** Response body. A string is sent as it is; any other value is sent as JSON. Default: empty. */
  body?: unknown
  /** Extra response headers. */
  headers?: Record<string, string>
  /**
   * Add CORS headers (the request's `Origin`, credentials allowed, the `headers` exposed) and answer
   * the CORS preflight of the matching calls, so that a cross-origin app can read the fault and its
   * headers (for example `www-authenticate`) as it reads a real server response. Default `true`.
   */
  cors?: boolean
  /** Why the test causes the fault. Shown in the error guard entry. */
  reason?: string
}

/** A fault set up by `networkFault`. */
export interface NetworkFault {
  /** How many calls got the fault so far. */
  readonly hits: number
  /** Removes the route before all faults are used. Later calls go to the server. */
  remove(): Promise<void>
}

/** The `Origin` of a request, or `undefined` (same-origin navigation, no header). */
async function originOf(request: Request): Promise<string | undefined> {
  return (await request.headerValue('origin')) ?? undefined
}

/**
 * CORS headers for `origin`. `expose` lists the extra headers the app may read: with credentials,
 * the browser takes `*` literally, so each name is listed too.
 */
function corsHeaders(origin: string | undefined, expose: readonly string[] = []): Record<string, string> {
  const exposed = { 'access-control-expose-headers': [...expose, '*'].join(', ') }
  return origin
    ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', ...exposed, vary: 'Origin' }
    : { 'access-control-allow-origin': '*', ...exposed }
}

function isPreflight(request: Request): boolean {
  return request.method() === 'OPTIONS' && request.headers()['access-control-request-method'] !== undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
export async function networkFault(target: Page | BrowserContext, options: NetworkFaultOptions): Promise<NetworkFault> {
  const times = options.times ?? 1
  if (!Number.isInteger(times) || times < 1) throw new Error(`networkFault: times must be a positive integer, got ${times}.`)
  const cors = options.cors ?? true
  const method = options.method?.toUpperCase()
  const context = 'context' in target && typeof target.context === 'function' ? target.context() : (target as BrowserContext)
  const reason = options.reason ?? `networkFault: ${options.status} on purpose`
  const body =
    options.body === undefined ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
  const contentType = options.body === undefined || typeof options.body === 'string' ? undefined : 'application/json'
  let hits = 0
  let removed = false

  const remove = async (): Promise<void> => {
    if (removed) return
    removed = true
    await target.unroute(options.url, handler)
  }

  async function handler(route: Route, request: Request): Promise<void> {
    if (removed || hits >= times) return route.fallback()
    if (isPreflight(request)) {
      const requested = request.headers()['access-control-request-method']?.toUpperCase()
      if (!cors || (method !== undefined && requested !== method)) return route.fallback()
      return route.fulfill({
        status: 204,
        headers: {
          ...corsHeaders(await originOf(request)),
          'access-control-allow-methods': requested || '*',
          'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? '*',
          'access-control-max-age': '0',
        },
      })
    }
    if (method !== undefined && request.method() !== method) return route.fallback()
    hits++
    for (const guard of errorGuardsOf(context)) {
      const exact = new RegExp(`^${escapeRegExp(request.url())}$`)
      if (options.status >= guard.minStatus) {
        guard.expect({ kind: 'response5xx', message: `${request.method()} ${request.url()} -> ${options.status}`, reason, times: 1 })
      }
      // The browser's console echo of a failed response; its location is the request URL.
      guard.expect({ kind: 'console', message: exact, reason, times: 1 })
    }
    const headers = {
      ...(contentType ? { 'content-type': contentType } : {}),
      ...(cors ? corsHeaders(await originOf(request), Object.keys(options.headers ?? {})) : {}),
      ...options.headers,
    }
    await route.fulfill({ status: options.status, headers, body })
    if (hits >= times) await remove()
  }

  await target.route(options.url, handler)
  return {
    get hits() {
      return hits
    },
    remove,
  }
}
