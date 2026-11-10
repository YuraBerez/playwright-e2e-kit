import type { AllowedError } from '../core/error-guard.js';
/**
 * Known Flutter web noise for the error guard. Opt-in: import it from `playwright-e2e-kit/flutter`
 * and pass it as `errorGuardFixture({ allow: flutterErrorAllowList })`. Each entry is narrow (one
 * kind, one host or message) and carries its reason. It never hides an app-origin failure.
 */
export declare const flutterErrorAllowList: readonly AllowedError[];
//# sourceMappingURL=allow-list.d.ts.map