import type { AllowedError } from '../core/error-guard.js'

/**
 * Known Flutter web noise for the error guard. Opt-in: import it from `playwright-e2e-kit/flutter`
 * and pass it as `errorGuardFixture({ allow: flutterErrorAllowList })`. Each entry is narrow (one
 * kind, one host or message) and carries its reason. It never hides an app-origin failure.
 */
export const flutterErrorAllowList: readonly AllowedError[] = [
  {
    kind: 'requestfailed',
    message: /https:\/\/(www|fonts)\.gstatic\.com\//,
    reason:
      'CanvasKit (canvaskit.wasm) and fallback fonts (Roboto, Noto) load from gstatic at runtime; an offline or blocked CI network fails them, and Flutter falls back to other fonts.',
  },
  {
    kind: 'console',
    message: /Failed to load font .*(gstatic|fonts\.googleapis)/,
    reason: 'Flutter logs a console error when a fallback font fetch fails; the matching request failure is allowed above.',
  },
  {
    kind: 'console',
    message: /Service worker registration failed|Failed to register a ServiceWorker/i,
    reason: 'flutter_service_worker.js can fail to register (insecure context, test server without it); the app works without it.',
  },
]
