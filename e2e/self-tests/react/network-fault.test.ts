// Self-test (raw page, not a spec): `networkFault` answers the next N calls with a status, the
// browser gives a cross-origin fault and its headers to the app (CORS headers), and the error
// guard does not fail on the expected faults.
import { expect, test as base, type Page } from '@playwright/test'
import { ErrorGuard, errorGuardFixture, networkFault } from 'playwright-e2e-kit'

const test = base.extend<{ errorGuard: ErrorGuard }>({ errorGuard: errorGuardFixture() })

/** Sends `count` POST calls with a JSON body and a bearer token (so the browser sends a preflight cross-origin). */
function post(page: Page, url: string, count: number) {
  return page.evaluate(
    async ([target, n]) => {
      const out: { status: number; body: string; challenge: string | null }[] = []
      for (let i = 0; i < n; i++) {
        const response = await fetch(target, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', authorization: 'Bearer self-test' },
          body: '{}',
        })
        out.push({ status: response.status, body: await response.text(), challenge: response.headers.get('www-authenticate') })
      }
      return out
    },
    [url, count] as const,
  )
}

const challenge = 'Bearer error="invalid_token"'

test('a cross-origin 401 reaches the app with its body and headers', async ({ page, baseURL, errorGuard }) => {
  await page.goto('/')
  // Another host name for the same server: a different origin for the browser.
  const api = new URL('/api/token', baseURL!.replace('localhost', '127.0.0.1')).href
  const fault = await networkFault(page, {
    url: '**/api/token',
    status: 401,
    body: { error: 'invalid_grant' },
    headers: { 'www-authenticate': challenge },
  })
  expect(await post(page, api, 1)).toEqual([{ status: 401, body: '{"error":"invalid_grant"}', challenge }])
  expect(fault.hits).toBe(1)
  expect(errorGuard.collected).toEqual([])
})

test('without cors, a cross-origin app cannot read the headers of the fault', async ({ page, baseURL }) => {
  await page.goto('/')
  const api = new URL('/api/token', baseURL!.replace('localhost', '127.0.0.1')).href
  await networkFault(page, { url: '**/api/token', status: 401, cors: false, headers: { 'www-authenticate': challenge } })
  expect((await post(page, api, 1))[0]?.challenge).toBeNull()
})

test('the next N calls get the fault, later calls reach the server, and the guard stays green', async ({ page, errorGuard }) => {
  await page.goto('/')
  const fault = await networkFault(page, { url: '**/api/items', status: 503, times: 2 })
  const statuses = (await post(page, '/api/items', 3)).map((r) => r.status)
  // The static server answers every path with index.html (200).
  expect(statuses).toEqual([503, 503, 200])
  expect(fault.hits).toBe(2)
  // The two 503s and their console echoes are expected: the auto guard passes at teardown.
  expect(errorGuard.collected).toEqual([])
})

test('a 5xx that the fault did not send still fails the guard', async ({ browser, baseURL }) => {
  const guard = new ErrorGuard()
  const context = await browser.newContext({ baseURL })
  try {
    await guard.watch(context)
    const page = await context.newPage()
    await page.goto('/')
    // A server outage after the fault: the route that networkFault falls back to.
    await page.route('**/api/outage', (route) => route.fulfill({ status: 500 }))
    await networkFault(page, { url: '**/api/outage', status: 500 })
    expect((await post(page, '/api/outage', 2)).map((r) => r.status)).toEqual([500, 500])
    await expect.poll(() => guard.collected.filter((e) => e.kind === 'response5xx').length).toBe(1)
    expect(() => guard.assertClean()).toThrow(/POST .*\/api\/outage -> 500/)
  } finally {
    await context.close()
  }
})
