// Entry point `playwright-e2e-kit/compose` (Compose Multiplatform web, wasmJs). Only re-exports:
// the code lives in compose/. No other entry point imports this file (test/boundaries.test.ts).
export { COMPOSE_TEST_ID_ATTRIBUTE, composeConfig } from './compose/config.js';
export { composeFixture } from './compose/fixture.js';
export { COMPOSE_A11Y_ROOT, composeReady, composeReadyWith } from './compose/ready.js';
export { COMPOSE_BACKING_FIELD_CLASS, composeClear, composeReadText, composeTap, composeType, } from './compose/input.js';
export { composeScrollUntilVisible } from './compose/scroll.js';
export { ComposeScreen } from './compose/screen.js';
export { COMPOSE_DIAGNOSIS_ATTACHMENT, diagnoseCompose, formatComposeDiagnosis, } from './compose/diagnose.js';
export { scrollUntilVisible } from './canvas/scroll.js';
export { composeErrorAllowList } from './compose/allow-list.js';
//# sourceMappingURL=compose.js.map