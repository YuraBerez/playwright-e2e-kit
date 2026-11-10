// Entry point `playwright-e2e-kit/compose` (Compose Multiplatform web, wasmJs). Only re-exports:
// the code lives in compose/. No other entry point imports this file (test/boundaries.test.ts).
export { COMPOSE_TEST_ID_ATTRIBUTE, composeConfig } from './compose/config.js'
export { composeFixture } from './compose/fixture.js'
export { COMPOSE_A11Y_ROOT, composeReady, composeReadyWith, type ComposeReadyOptions } from './compose/ready.js'
export {
  COMPOSE_BACKING_FIELD_CLASS,
  composeClear,
  composeReadText,
  composeTap,
  composeType,
  type ComposeClearOptions,
  type ComposeTapOptions,
  type ComposeTypeOptions,
} from './compose/input.js'
export { composeScrollUntilVisible, type ComposeScrollOptions } from './compose/scroll.js'
export { ComposeScreen } from './compose/screen.js'
export { scrollUntilVisible, type ScrollUntilVisibleOptions } from './canvas/scroll.js'
export { composeErrorAllowList } from './compose/allow-list.js'
