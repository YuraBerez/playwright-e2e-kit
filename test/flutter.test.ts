import { describe, expect, it } from 'vitest'
import { isAllowed, type CollectedError } from '../src/error-guard.js'
import { flutterErrorAllowList } from '../src/flutter.js'

const err = (kind: CollectedError['kind'], text: string, url = ''): CollectedError => ({ kind, text, url })

describe('flutterErrorAllowList', () => {
  it('documents every entry with a reason', () => {
    expect(flutterErrorAllowList.length).toBeGreaterThan(0)
    for (const e of flutterErrorAllowList) expect(e.reason.length).toBeGreaterThan(20)
  })

  it('allows gstatic CanvasKit and font request failures', () => {
    const u = 'https://www.gstatic.com/flutter-canvaskit/abc/canvaskit.wasm'
    expect(isAllowed(err('requestfailed', `GET ${u} -> net::ERR_INTERNET_DISCONNECTED`, u), flutterErrorAllowList)).toBe(true)
  })

  it('allows service worker registration noise', () => {
    expect(isAllowed(err('console', 'Service worker registration failed: TypeError'), flutterErrorAllowList)).toBe(true)
  })

  it('stays narrow: app-origin failures and other kinds are still reported', () => {
    const api = 'https://api.example.com/v1/places'
    expect(isAllowed(err('requestfailed', `GET ${api} -> net::ERR_FAILED`, api), flutterErrorAllowList)).toBe(false)
    expect(isAllowed(err('response5xx', 'GET https://www.gstatic.com/x -> 500', 'https://www.gstatic.com/x'), flutterErrorAllowList)).toBe(false)
    expect(isAllowed(err('pageerror', 'Service worker registration failed'), flutterErrorAllowList)).toBe(false)
  })
})
