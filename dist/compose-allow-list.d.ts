import type { AllowedError } from './error-guard.js';
/**
 * Known Compose Multiplatform web (wasmJs) noise for the error guard. Opt-in: import it from
 * `playwright-e2e-kit/compose` and pass it as `errorGuardFixture({ allow: composeErrorAllowList })`.
 * Each entry is narrow (one kind, one message) and carries its reason. It never hides an app-origin
 * failure.
 */
export declare const composeErrorAllowList: readonly AllowedError[];
