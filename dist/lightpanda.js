// Entry point `playwright-e2e-kit/lightpanda`. Only re-exports: the code lives in lightpanda/.
// No other entry point imports this file (test/boundaries.test.ts).
export { lightpandaFixture, RENDER_REQUIRED_TAG, withLightpanda } from './lightpanda/fixture.js';
export { LIGHTPANDA_USER_AGENT, lightpandaProjects, selectEngine, } from './lightpanda/projects.js';
export { launchLightpanda, lightpandaExecutablePath, } from './lightpanda/server.js';
//# sourceMappingURL=lightpanda.js.map