import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { BrowserContext, Page } from '@playwright/test'
import { ErrorGuard } from '../src/core/error-guard.js'
import { networkFault } from '../src/core/network-fault.js'

type Handler = (route: FakeRoute, request: FakeRequest) => Promise<void>

interface FakeRequest {
  method(): string
  url(): string
  headers(): Record<string, string>
  headerValue(name: string): Promise<string | null>
}

function req(method: string, url: string, headers: Record<string, string> = {}): FakeRequest {
  return {
    method: () => method,
    url: () => url,
    headers: () => headers,
    headerValue: async (name) => headers[name] ?? null,
  }
}

class FakeRoute {
  fulfilled?: { status: number; headers?: Record<string, string>; body?: string }
  fellBack = false
  async fulfill(response: { status: number; headers?: Record<string, string>; body?: string }) {
    this.fulfilled = response
  }
  async fallback() {
    this.fellBack = true
  }
}

class FakeContext extends EventEmitter {
  handlers: Handler[] = []
  browser() {
    return null
  }
  async addInitScript() {}
  async route(_url: unknown, handler: Handler) {
    this.handlers.push(handler)
  }
  unroute = vi.fn(async (_url: unknown, handler: Handler) => {
    this.handlers = this.handlers.filter((h) => h !== handler)
  })
}

/** A page whose route calls go to its fake context, as one target. */
function setup() {
  const ctx = new FakeContext()
  const page = { context: () => ctx, route: ctx.route.bind(ctx), unroute: ctx.unroute }
  const call = async (request: FakeRequest) => {
    const route = new FakeRoute()
    const handler = ctx.handlers[0]
    if (!handler) return undefined
    await handler(route, request)
    return route
  }
  return { ctx, page: page as unknown as Page, call }
}

const ORIGIN = { origin: 'http://app.test' }

describe('networkFault', () => {
  it('answers the next N matching calls with the status, then removes the route', async () => {
    const { ctx, page, call } = setup()
    const fault = await networkFault(page, { url: '**/token', status: 401, times: 2, body: { error: 'expired' } })
    const first = await call(req('POST', 'http://api.test/token', ORIGIN))
    expect(first?.fulfilled).toEqual({
      status: 401,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': 'http://app.test',
        'access-control-allow-credentials': 'true',
        'access-control-expose-headers': '*',
        vary: 'Origin',
      },
      body: '{"error":"expired"}',
    })
    await call(req('POST', 'http://api.test/token', ORIGIN))
    expect(fault.hits).toBe(2)
    expect(ctx.unroute).toHaveBeenCalledOnce()
    expect(await call(req('POST', 'http://api.test/token'))).toBeUndefined()
  })

  it('answers the CORS preflight without counting it', async () => {
    const { page, call } = setup()
    const fault = await networkFault(page, { url: '**/token', status: 401, method: 'post' })
    const preflight = await call(
      req('OPTIONS', 'http://api.test/token', { ...ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization' }),
    )
    expect(preflight?.fulfilled?.status).toBe(204)
    expect(preflight?.fulfilled?.headers).toMatchObject({
      'access-control-allow-origin': 'http://app.test',
      'access-control-allow-methods': 'POST',
      'access-control-allow-headers': 'authorization',
    })
    expect(fault.hits).toBe(0)
    // A preflight for another method, and a call with another method, go to the server.
    expect((await call(req('OPTIONS', 'http://api.test/token', { ...ORIGIN, 'access-control-request-method': 'GET' })))?.fellBack).toBe(true)
    expect((await call(req('GET', 'http://api.test/token')))?.fellBack).toBe(true)
    expect((await call(req('POST', 'http://api.test/token')))?.fulfilled?.status).toBe(401)
  })

  it('exposes each extra header, also for a credentialed call', async () => {
    const { page, call } = setup()
    await networkFault(page, { url: '**/x', status: 401, headers: { 'www-authenticate': 'Bearer', 'retry-after': '1' } })
    expect((await call(req('GET', 'http://api.test/x', ORIGIN)))?.fulfilled?.headers).toMatchObject({
      'access-control-expose-headers': 'www-authenticate, retry-after, *',
      'www-authenticate': 'Bearer',
    })
  })

  it('without cors adds no CORS headers and leaves the preflight to the server', async () => {
    const { page, call } = setup()
    await networkFault(page, { url: '**/x', status: 503, cors: false, body: 'down', headers: { 'retry-after': '1' } })
    expect((await call(req('OPTIONS', 'http://api.test/x', { 'access-control-request-method': 'GET' })))?.fellBack).toBe(true)
    expect((await call(req('GET', 'http://api.test/x')))?.fulfilled).toEqual({ status: 503, headers: { 'retry-after': '1' }, body: 'down' })
  })

  it('uses a wildcard origin when the request has no Origin, and preflight methods default to *', async () => {
    const { page, call } = setup()
    await networkFault(page, { url: '**/x', status: 500 })
    const preflight = await call(req('OPTIONS', 'http://api.test/x', { 'access-control-request-method': '' }))
    expect(preflight?.fulfilled?.headers).toMatchObject({ 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' })
    expect((await call(req('GET', 'http://api.test/x')))?.fulfilled?.headers).toEqual({
      'access-control-allow-origin': '*',
      'access-control-expose-headers': '*',
    })
  })

  it('tells the watching error guard that the faulted response and its console echo are expected', async () => {
    const { ctx, page, call } = setup()
    const guard = new ErrorGuard()
    await guard.watch(ctx as unknown as BrowserContext)
    await networkFault(page, { url: '**/x', status: 503, reason: 'outage test' })
    await call(req('GET', 'http://api.test/x'))
    const response = { status: () => 503, url: () => 'http://api.test/x', request: () => req('GET', 'http://api.test/x') }
    const echo = {
      type: () => 'error',
      text: () => 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
      location: () => ({ url: 'http://api.test/x' }),
      page: () => null,
    }
    ctx.emit('response', response)
    ctx.emit('console', echo)
    expect(guard.collected).toEqual([])
    // Only the faulted call: a second 503 from the server is still reported.
    ctx.emit('response', response)
    expect(guard.collected.map((e) => e.kind)).toEqual(['response5xx'])
  })

  it('does not expect a response below the guard threshold', async () => {
    const { ctx, page, call } = setup()
    const guard = new ErrorGuard()
    const expectSpy = vi.spyOn(guard, 'expect')
    await guard.watch(ctx as unknown as BrowserContext)
    await networkFault(page, { url: '**/x', status: 401 })
    await call(req('GET', 'http://api.test/x'))
    expect(expectSpy.mock.calls.map(([e]) => e.kind)).toEqual(['console'])
  })

  it('works on a context, and remove() stops it early (twice is a no-op)', async () => {
    const ctx = new FakeContext()
    const fault = await networkFault(ctx as unknown as BrowserContext, { url: '**/x', status: 500, times: 3 })
    const route = new FakeRoute()
    await ctx.handlers[0]!(route, req('GET', 'http://api.test/x'))
    expect(route.fulfilled?.status).toBe(500)
    const handler = ctx.handlers[0]!
    await fault.remove()
    await fault.remove()
    expect(ctx.unroute).toHaveBeenCalledOnce()
    // A call already queued on the removed route goes to the server.
    const late = new FakeRoute()
    await handler(late, req('GET', 'http://api.test/x'))
    expect(late.fellBack).toBe(true)
  })

  it('rejects a times value that is not a positive integer', async () => {
    const { page } = setup()
    await expect(networkFault(page, { url: '**/x', status: 500, times: 0 })).rejects.toThrow(/times must be a positive integer/)
    await expect(networkFault(page, { url: '**/x', status: 500, times: 1.5 })).rejects.toThrow(/times must be a positive integer/)
  })
})
