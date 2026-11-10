import type { BrowserContext, ConsoleMessage, Response } from '@playwright/test'

/** The collector that reported an error. */
export type ErrorKind = 'pageerror' | 'console' | 'response5xx' | 'requestfailed'

/**
 * A known, expected error that the guard must not fail on. Keep the list empty if at all possible:
 * each entry hides a real defect class, so give it a reason and a tracking issue.
 */
export interface AllowedError {
  kind: ErrorKind
  /** Substring (string) or RegExp, tested against the message and the failing URL. */
  message: string | RegExp
  /** Why this is expected, and the issue that tracks its removal. */
  reason: string
}

/**
 * An error that the test causes on purpose (for example a fault answered by `networkFault`). Unlike
 * an `AllowedError`, it is added while the test runs and, with `times`, matches only that many
 * errors.
 */
export interface ExpectedError extends AllowedError {
  /** How many errors the entry matches. Default: no limit (until the test ends). */
  times?: number
}

export interface CollectedError {
  kind: ErrorKind
  text: string
  url: string
}

export interface ErrorGuardOptions {
  /** Allow-list hook: errors that match an entry are not reported. */
  allow?: readonly AllowedError[]
  /**
   * Status from which a response counts as a server error. Default 500: 4xx never fail the guard,
   * so negative tests (401, 409, 400) stay green.
   */
  minStatus?: number
}

/**
 * A request that the browser cancelled itself (navigation away, superseded fetch) is benign.
 * Chromium reports `net::ERR_ABORTED`; WebKit reports `cancelled` or, for a reload or navigation,
 * `Load request cancelled`. Each string is exempt on its own engine only, so a stray "cancelled"
 * elsewhere is still reported.
 */
export function isBenignAbort(failure: string, browserName: string | undefined): boolean {
  if (failure === 'net::ERR_ABORTED') return browserName !== 'webkit'
  return browserName === 'webkit' && /^(load request )?cancelled$/i.test(failure)
}

/** Chromium and WebKit echo every 4xx response as a console error; that echo is not a defect. */
export function isClientErrorEcho(consoleText: string): boolean {
  return /^Failed to load resource: .*status of 4\d\d/.test(consoleText)
}

/** True when an allow-list entry matches the error (same kind, message or URL matches). */
export function isAllowed(error: CollectedError, allow: readonly AllowedError[]): boolean {
  return allow.some(
    (rule) =>
      rule.kind === error.kind &&
      (typeof rule.message === 'string'
        ? error.text.includes(rule.message) || error.url.includes(rule.message)
        : matches(rule.message, error.text) || matches(rule.message, error.url)),
  )
}

/** Tests a RegExp without state: a `g` or `y` flag would keep `lastIndex` between calls and skip matches. */
function matches(pattern: RegExp, value: string): boolean {
  return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '')).test(value)
}

/** Numbered, readable report of the collected errors. */
export function formatErrors(errors: readonly CollectedError[]): string {
  const lines = errors.map((e, i) => `  ${i + 1}. [${e.kind}] ${e.text}\n     at ${e.url || '(no url)'}`)
  return `Error guard: ${errors.length} unexpected browser/server error(s) during the test:\n${lines.join('\n')}`
}

/** Init script: a CSP violation becomes a `console.error`, so the guard reports it. */
export const CSP_VIOLATION_SCRIPT = `try {
        document.addEventListener('securitypolicyviolation', (e) => {
          console.error('CSP violation: ' + e.violatedDirective + ' blocked ' + (e.blockedURI || '(inline)'))
        })
      } catch (_) {
        /* about:blank and sandboxed frames can throw on some APIs: never break the page */
      }`

const watchers = new WeakMap<BrowserContext, ErrorGuard[]>()

/** The error guards that watch `context` (`errorGuardFixture()` or `errorGuard.watch(context)`). */
export function errorGuardsOf(context: BrowserContext): readonly ErrorGuard[] {
  return watchers.get(context) ?? []
}

/**
 * Collects silent failures that no `expect` looks for: uncaught page errors, `console.error`,
 * responses with status >= `minStatus`, CSP violations, and failed requests (network level),
 * across every page of the watched browser contexts.
 */
export class ErrorGuard {
  private readonly errors: CollectedError[] = []
  private readonly allow: readonly AllowedError[]
  private readonly expected: { entry: AllowedError; left: number }[] = []
  /** Responses with a status from this value on are reported (`response5xx`). */
  readonly minStatus: number

  constructor(options: ErrorGuardOptions = {}) {
    this.allow = options.allow ?? []
    this.minStatus = options.minStatus ?? 500
  }

  /** Errors collected so far (after the allow-list). */
  get collected(): readonly CollectedError[] {
    return this.errors
  }

  async watch(context: BrowserContext): Promise<void> {
    const browserName = context.browser()?.browserType().name()
    const guards = watchers.get(context) ?? []
    if (!guards.includes(this)) watchers.set(context, [...guards, this])
    // Init scripts are exempt from the page's own CSP.
    await context.addInitScript({ content: CSP_VIOLATION_SCRIPT })
    context.on('weberror', (webError) => {
      const error = webError.error()
      this.add({
        kind: 'pageerror',
        text: error.stack?.split('\n').slice(0, 3).join(' | ') ?? error.message,
        url: webError.page()?.url() ?? '',
      })
    })
    context.on('console', (msg: ConsoleMessage) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      // Network-level failures ("net::ERR_…") and 5xx echoes are NOT skipped here.
      if (isClientErrorEcho(text)) return
      this.add({ kind: 'console', text, url: msg.location().url || msg.page()?.url() || '' })
    })
    context.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText ?? 'unknown failure'
      // Every failure but a self-cancelled request (refused, DNS, CORS, reset) means the app could not reach its server.
      if (isBenignAbort(failure, browserName)) return
      this.add({ kind: 'requestfailed', text: `${request.method()} ${request.url()} -> ${failure}`, url: request.url() })
    })
    context.on('response', (response: Response) => {
      if (response.status() < this.minStatus) return
      this.add({
        kind: 'response5xx',
        text: `${response.request().method()} ${response.url()} -> ${response.status()}`,
        url: response.url(),
      })
    })
  }

  /**
   * Tells the guard that the test causes this error on purpose. It is matched as an allow-list
   * entry (same kind, message or URL), but only while the test runs and, with `times`, only that
   * many times. `networkFault` calls it for each fault that it answers.
   */
  expect(error: ExpectedError): void {
    const { times, ...entry } = error
    this.expected.push({ entry, left: times ?? Number.POSITIVE_INFINITY })
  }

  private add(error: CollectedError): void {
    if (isAllowed(error, this.allow)) return
    const expected = this.expected.find((e) => e.left > 0 && isAllowed(error, [e.entry]))
    if (expected) {
      expected.left--
      return
    }
    this.errors.push(error)
  }

  /** Throws a readable list (kind, message, URL) if anything was collected. */
  assertClean(): void {
    if (this.errors.length === 0) return
    throw new Error(formatErrors(this.errors))
  }
}
