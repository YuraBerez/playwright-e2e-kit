import { test as base } from '@playwright/test'
import {
  appReadyFixture,
  cleanupFixture,
  errorGuardFixture,
  resourceFixture,
  type AppReady,
  type CleanupRegistry,
  type ErrorGuard,
} from 'playwright-e2e-kit'
import { composeErrorAllowList, composeFixture } from 'playwright-e2e-kit/compose'
import { flutterErrorAllowList, flutterFixture } from 'playwright-e2e-kit/flutter'
import { lightpandaFixture, type LightpandaWorkerOptions } from 'playwright-e2e-kit/lightpanda'
import { recordFactory, type TestRecord } from './data.js'

export interface SuiteFixtures {
  errorGuard: ErrorGuard
  cleanup: CleanupRegistry
  record: TestRecord
  appReady: AppReady | undefined
}

/**
 * React, Vue and Angular: the kit's plain fixtures, no Flutter import, no allow-list, and
 * `lightpandaFixture()` for their `-lightpanda` projects.
 */
export const webTest = base.extend<SuiteFixtures, LightpandaWorkerOptions>({
  ...lightpandaFixture(),
  ...appReadyFixture(),
  errorGuard: errorGuardFixture(),
  cleanup: cleanupFixture({ onFailure: 'throw' }),
  record: resourceFixture(recordFactory),
})

/** Flutter: `flutterFixture()` instead of `appReadyFixture()`, and the Flutter allow-list. */
export const flutterTest = base.extend<SuiteFixtures>({
  ...flutterFixture(),
  errorGuard: errorGuardFixture({ allow: flutterErrorAllowList }),
  cleanup: cleanupFixture({ onFailure: 'throw' }),
  record: resourceFixture(recordFactory),
})

/** Compose Multiplatform web: `composeFixture()` instead of `appReadyFixture()`, and the Compose allow-list. */
export const composeTest = base.extend<SuiteFixtures>({
  ...composeFixture(),
  errorGuard: errorGuardFixture({ allow: composeErrorAllowList }),
  cleanup: cleanupFixture({ onFailure: 'throw' }),
  record: resourceFixture(recordFactory),
})
