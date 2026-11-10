# Error guard

`errorGuardFixture()` is an auto fixture: it runs in **every** test with no spec code. It watches
all pages of the test's browser context and, at teardown, fails the test with a numbered list of
`[kind] message` and URL for each of:

- uncaught page errors (`pageerror`),
- `console.error` messages, including CSP violations (`CSP violation: <directive> blocked <url>`),
- responses with status **>= 500** (`response5xx`, `METHOD url -> status`),
- failed requests (`requestfailed`, `METHOD url -> net::ERR_…`: refused, DNS, CORS, reset).

4xx responses never fail it, so negative tests stay green. The browser's console echo of a 4xx
(`Failed to load resource: … status of 4xx`) is ignored for the same reason. A request that the
browser cancelled itself is ignored on its own engine only (`net::ERR_ABORTED` on Chromium,
`cancelled` / `Load request cancelled` on WebKit).

To watch a second browser context (for example a separate session), call
`errorGuard.watch(context)` in the fixture that creates it.

**Expected errors at run time:** `errorGuard.expect({ kind, message, reason, times })` tells the
guard that the test causes this error on purpose. It matches as an allow-list entry, but only in
this test and, with `times`, only that many errors. `networkFault` uses it.

**Allow-list hook:** `errorGuardFixture({ allow })` takes `{ kind, message, reason }` entries
(`message` is a substring or a RegExp, tested against the message and the URL). Keep the list
empty if possible. Each entry needs a reason and a tracking issue. `kind` is one kind or a list
(`kind: ['console', 'requestfailed', 'pageerror']`), so one entry covers a third-party origin that
fails in several ways.

**Flutter web (opt-in):** `import { flutterErrorAllowList } from 'playwright-e2e-kit/flutter'` and
pass it as `errorGuardFixture({ allow: flutterErrorAllowList })`. It allows only known noise
(CanvasKit and font fetches from gstatic, service worker registration), each entry with a reason.
Apps that do not import this entry see no change.

**Init scripts and frames.** The guard installs one init script per context. An init script runs in
every frame, also in `about:blank` and in sandboxed or third-party iframes, where `localStorage`,
`sessionStorage` and some other APIs throw a `SecurityError`. The kit scripts are wrapped in
`try/catch` and never touch storage. Do the same in your own init scripts:

```ts
await context.addInitScript(() => {
  try {
    window.localStorage.setItem('consent', 'true')
  } catch {
    /* about:blank or a sandboxed frame: skip */
  }
})
```

**Third-party iframes.** The guard watches the whole context, so it also sees `pageerror`,
`console.error` and failed or 5xx requests that come from an embedded frame (an ad, a map or a
payment widget). It cannot tell the frame from the app. To ignore a frame, add a narrow entry with a reason. Match
by what the entry kind records: `requestfailed` and `console` carry the URL of the failing request
or the logging frame, so a URL (or a pattern of it) works. A `pageerror` carries the URL of the
top page, never the frame's, so match it by a message pattern of the frame's error:

```ts
errorGuardFixture({
  allow: [
    { kind: 'requestfailed', message: 'https://widgets.example.com/', reason: 'Embedded widget, not ours (#12)' },
    { kind: 'console', message: /widgets\.example\.com/, reason: 'Embedded widget, not ours (#12)' },
    { kind: 'pageerror', message: /WidgetSdk is not defined/, reason: 'Embedded widget, not ours (#12)' },
  ],
})
```

