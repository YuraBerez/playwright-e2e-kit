import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import {
  CSP_VIOLATION_SCRIPT,
  ErrorGuard,
  formatErrors,
  isAllowed,
  isBenignAbort,
  isClientErrorEcho,
  type AllowedError,
} from '../src/error-guard.js'

type Context = Parameters<ErrorGuard['watch']>[0]

class FakeContext extends EventEmitter {
  initScripts: unknown[] = []
  constructor(private readonly browserName: string | undefined) {
    super()
  }
  browser() {
    return this.browserName ? { browserType: () => ({ name: () => this.browserName }) } : null
  }
  async addInitScript(script: unknown) {
    this.initScripts.push(script)
  }
}

async function watched(browserName: string | undefined = 'chromium', allow: AllowedError[] = [], minStatus?: number) {
  const ctx = new FakeContext(browserName)
  const guard = new ErrorGuard({ allow, minStatus })
  await guard.watch(ctx as unknown as Context)
  return { ctx, guard }
}

const consoleMsg = (type: string, text: string, url = '', pageUrl = 'https://app/x') => ({
  type: () => type,
  text: () => text,
  location: () => ({ url }),
  page: () => ({ url: () => pageUrl }),
})
const request = (url: string, errorText?: string) => ({
  method: () => 'GET',
  url: () => url,
  failure: () => (errorText ? { errorText } : null),
})
const response = (url: string, status: number) => ({ status: () => status, url: () => url, request: () => request(url) })

describe('isBenignAbort', () => {
  it('accepts Chromium net::ERR_ABORTED', () => {
    expect(isBenignAbort('net::ERR_ABORTED', 'chromium')).toBe(true)
  })

  it('accepts WebKit "cancelled"', () => {
    expect(isBenignAbort('cancelled', 'webkit')).toBe(true)
  })

  it('accepts WebKit "Load request cancelled" (reload mid-request)', () => {
    expect(isBenignAbort('Load request cancelled', 'webkit')).toBe(true)
    expect(isBenignAbort('Load request cancelled', 'chromium')).toBe(false)
  })

  it('does not exempt "cancelled" outside WebKit', () => {
    expect(isBenignAbort('cancelled', 'chromium')).toBe(false)
    expect(isBenignAbort('cancelled', undefined)).toBe(false)
  })

  it('does not exempt the Chromium string on WebKit', () => {
    expect(isBenignAbort('net::ERR_ABORTED', 'webkit')).toBe(false)
  })

  it('reports real network failures on every engine', () => {
    for (const browser of ['chromium', 'webkit']) {
      expect(isBenignAbort('net::ERR_CONNECTION_REFUSED', browser)).toBe(false)
      expect(isBenignAbort('Load failed', browser)).toBe(false)
    }
  })
})

describe('isClientErrorEcho', () => {
  it('matches the 4xx echo only', () => {
    expect(isClientErrorEcho('Failed to load resource: the server responded with a status of 401 (Unauthorized)')).toBe(true)
    expect(isClientErrorEcho('Failed to load resource: the server responded with a status of 503 ()')).toBe(false)
    expect(isClientErrorEcho('Failed to load resource: net::ERR_CONNECTION_REFUSED')).toBe(false)
  })
})

describe('isAllowed', () => {
  const err = { kind: 'console' as const, text: 'ResizeObserver loop', url: 'https://cdn.example.com/w.js' }
  it('matches string message against text or URL, of the same kind', () => {
    expect(isAllowed(err, [{ kind: 'console', message: 'ResizeObserver', reason: 'r' }])).toBe(true)
    expect(isAllowed(err, [{ kind: 'console', message: 'cdn.example.com', reason: 'r' }])).toBe(true)
    expect(isAllowed(err, [{ kind: 'pageerror', message: 'ResizeObserver', reason: 'r' }])).toBe(false)
    expect(isAllowed(err, [{ kind: 'console', message: 'other', reason: 'r' }])).toBe(false)
  })
  it('matches RegExp against text or URL', () => {
    expect(isAllowed(err, [{ kind: 'console', message: /loop$/, reason: 'r' }])).toBe(true)
    expect(isAllowed(err, [{ kind: 'console', message: /w\.js$/, reason: 'r' }])).toBe(true)
    expect(isAllowed(err, [{ kind: 'console', message: /nope/, reason: 'r' }])).toBe(false)
  })
})

describe('formatErrors', () => {
  it('numbers the errors and marks a missing URL', () => {
    expect(formatErrors([{ kind: 'console', text: 'a', url: '' }, { kind: 'pageerror', text: 'b', url: 'u' }])).toBe(
      'Error guard: 2 unexpected browser/server error(s) during the test:\n  1. [console] a\n     at (no url)\n  2. [pageerror] b\n     at u',
    )
  })
})

describe('ErrorGuard', () => {
  it('installs the CSP init script and stays clean with no events', async () => {
    const { ctx, guard } = await watched()
    expect(ctx.initScripts).toEqual([{ content: CSP_VIOLATION_SCRIPT }])
    expect(() => guard.assertClean()).not.toThrow()
  })

  it('collects page errors with a short stack, or the message without one', async () => {
    const { ctx, guard } = await watched()
    const withStack = new Error('boom')
    withStack.stack = 'Error: boom\n at a\n at b\n at c'
    ctx.emit('weberror', { error: () => withStack, page: () => ({ url: () => 'https://app/p' }) })
    const noStack = new Error('bare')
    noStack.stack = undefined
    ctx.emit('weberror', { error: () => noStack, page: () => null })
    expect(guard.collected).toEqual([
      { kind: 'pageerror', text: 'Error: boom |  at a |  at b', url: 'https://app/p' },
      { kind: 'pageerror', text: 'bare', url: '' },
    ])
  })

  it('collects console.error but not other levels or the 4xx echo', async () => {
    const { ctx, guard } = await watched()
    ctx.emit('console', consoleMsg('warning', 'w'))
    ctx.emit('console', consoleMsg('error', 'Failed to load resource: the server responded with a status of 404 ()'))
    ctx.emit('console', consoleMsg('error', 'boom', 'https://app/src.js'))
    ctx.emit('console', consoleMsg('error', 'no-location'))
    ctx.emit('console', { ...consoleMsg('error', 'no-page'), page: () => null })
    expect(guard.collected.map((e) => [e.text, e.url])).toEqual([
      ['boom', 'https://app/src.js'],
      ['no-location', 'https://app/x'],
      ['no-page', ''],
    ])
  })

  it('collects failed requests except benign aborts of the engine', async () => {
    const { ctx, guard } = await watched('webkit')
    ctx.emit('requestfailed', request('https://api/a', 'cancelled'))
    ctx.emit('requestfailed', request('https://api/b', 'net::ERR_ABORTED'))
    ctx.emit('requestfailed', request('https://api/c'))
    expect(guard.collected.map((e) => e.text)).toEqual(['GET https://api/b -> net::ERR_ABORTED', 'GET https://api/c -> unknown failure'])
  })

  it('treats a context without a browser as an unknown engine', async () => {
    const { ctx, guard } = await watched(undefined)
    ctx.emit('requestfailed', request('https://api/a', 'cancelled'))
    expect(guard.collected).toHaveLength(1)
  })

  it('collects responses >= 500 only, with a configurable threshold', async () => {
    const { ctx, guard } = await watched()
    ctx.emit('response', response('https://api/ok', 200))
    ctx.emit('response', response('https://api/nf', 404))
    ctx.emit('response', response('https://api/down', 503))
    expect(guard.collected).toEqual([{ kind: 'response5xx', text: 'GET https://api/down -> 503', url: 'https://api/down' }])
    const strict = await watched('chromium', [], 400)
    strict.ctx.emit('response', response('https://api/nf', 404))
    expect(strict.guard.collected).toHaveLength(1)
  })

  it('skips allow-listed errors and throws a readable report otherwise', async () => {
    const { ctx, guard } = await watched('chromium', [{ kind: 'console', message: 'known', reason: 'tracked' }])
    ctx.emit('console', consoleMsg('error', 'known noise'))
    expect(() => guard.assertClean()).not.toThrow()
    ctx.emit('console', consoleMsg('error', 'new defect'))
    expect(() => guard.assertClean()).toThrow(/1 unexpected browser\/server error\(s\)[\s\S]*\[console\] new defect/)
  })
})
