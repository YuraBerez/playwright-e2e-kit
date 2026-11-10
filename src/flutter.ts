// Entry point `playwright-e2e-kit/flutter`. Only re-exports: the code lives in flutter/.
// The main entry point never imports this file (test/boundaries.test.ts).
export { FLUTTER_TEST_ID_ATTRIBUTE, flutterConfig } from './flutter/config.js'
export { flutterFixture } from './flutter/fixture.js'
export {
  FLUTTER_FIRST_FRAME_FLAG,
  enableFlutterSemantics,
  flutterReady,
  flutterReadyWith,
  installFlutterFirstFrameListener,
  type FlutterReadyOptions,
} from './flutter/ready.js'
export { FlutterScreen } from './flutter/screen.js'
export { scrollUntilVisible, type ScrollUntilVisibleOptions } from './canvas/scroll.js'
export { flutterErrorAllowList } from './flutter/allow-list.js'
