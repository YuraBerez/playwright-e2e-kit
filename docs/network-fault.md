# Network faults

`networkFault(page, { url, status, times, method, body, headers, cors, reason })` answers the next
`times` (default 1) calls that match `url` (a glob, a RegExp or a predicate, as for
`page.route()`) with `status`, then lets the calls go to the server again. Use it for a failure
that the test environment cannot make on demand: a 401 on a token refresh, a 503 from one
service, a 429.

- **CORS** (`cors`, default `true`): the fault gets `Access-Control-Allow-Origin` (the request's
  `Origin`), `Access-Control-Allow-Credentials` and `Access-Control-Expose-Headers` with each
  name in `headers`, and the CORS preflight of the matching calls gets a 204. A cross-origin app
  (an API on another host) can then read the fault's body and headers, for example
  `www-authenticate`, as from a real server. A preflight does not count as a call.
- **Error guard:** each guard that watches the page's context (`errorGuardFixture()`) gets the
  faulted responses as expected errors: a 5xx fault and the browser's console echo of it
  ("Failed to load resource") do not fail the test. Only the faulted calls are expected; a 5xx
  from the server after the fault still fails it.
- `body`: a string is sent as it is; any other value is sent as JSON (`content-type:
  application/json`). `method` limits the fault to one HTTP method.
- It returns `{ hits, remove() }`: `hits` counts the faulted calls, `remove()` ends the fault
  early. It works on a `Page` or a `BrowserContext`. Call it before the action that sends the call.

A spec cannot use the raw `page`, so call it in a step or a fixture:

```ts
// steps/session.steps.ts
import type { Page } from '@playwright/test'
import { BaseSteps, networkFault } from 'playwright-e2e-kit'

export class SessionSteps extends BaseSteps {
  constructor(private readonly page: Page) {
    super('session')
  }

  /** The next token refresh fails as for a revoked refresh token; the app must sign the user out. */
  async failNextTokenRefresh(): Promise<void> {
    await networkFault(this.page, {
      url: '**/auth/refresh',
      status: 401,
      body: { error: 'invalid_grant' },
      reason: 'revoked refresh token',
    })
  }
}
```

