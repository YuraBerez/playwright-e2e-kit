import { launchLightpanda } from './server.js';
/** Tests with this tag must render: they fail in Lightpanda. */
export const RENDER_REQUIRED_TAG = '@critical';
// HTTP headers are ASCII only: the same encoding as Playwright's own fixture.
const jsonForceAscii = (value) => JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
/**
 * Playwright's own `browser` fixture (playwright/lib/index.js), for the projects without
 * Lightpanda: the same checks, the same remote connection and the same launch.
 */
async function playwrightBrowser({ playwright, browserName, _browserOptions, connectOptions }, workerInfo) {
    if (!['chromium', 'firefox', 'webkit'].includes(browserName)) {
        throw new Error(`Unexpected browserName "${browserName}", must be one of "chromium", "firefox" or "webkit"`);
    }
    if (connectOptions) {
        return playwright[browserName].connect(connectOptions.wsEndpoint, {
            ...connectOptions,
            exposeNetwork: connectOptions.exposeNetwork,
            headers: { 'x-playwright-launch-options': jsonForceAscii(_browserOptions), ...connectOptions.headers },
        });
    }
    // The launch options come from `_browserOptions` (it sets the defaults of `launch()`).
    const browser = await playwright[browserName].launch();
    const bindable = browser;
    if (process.env.PLAYWRIGHT_DASHBOARD && bindable.bind)
        await bindable.bind(`worker-${workerInfo.parallelIndex}`);
    return browser;
}
/**
 * The `browser` worker fixture with a Lightpanda switch, plus the `lightpanda` and
 * `lightpandaOptions` worker options. Spread into
 * `test.extend<{}, LightpandaWorkerOptions>({ ...lightpandaFixture() })`; turn it on per project
 * with `use: { lightpanda: true }` (`lightpandaProjects()` does it for you).
 *
 * With `lightpanda: true` each worker starts its own `lightpanda serve` process (one Lightpanda
 * connection holds one browser context, and Playwright runs one test per worker at a time) and
 * connects over CDP. With `false` it does what Playwright's own `browser` fixture does, so the
 * other projects see no change. A test tagged `@critical` fails in a Lightpanda project: a critical
 * scenario must run in a browser that renders.
 */
export function lightpandaFixture(defaults = {}) {
    return {
        lightpanda: [false, { scope: 'worker', option: true }],
        lightpandaOptions: [defaults, { scope: 'worker', option: true }],
        browser: [
            // Playwright reads the destructured names of the first argument to find the dependencies.
            async ({ playwright, browserName, _browserOptions, connectOptions, lightpanda, lightpandaOptions }, use, workerInfo) => {
                let browser;
                let stop = async () => { };
                if (lightpanda) {
                    const server = await launchLightpanda(lightpandaOptions);
                    stop = server.close;
                    try {
                        browser = await playwright.chromium.connectOverCDP(server.wsEndpoint);
                    }
                    catch (error) {
                        await stop();
                        throw error;
                    }
                }
                else {
                    browser = await playwrightBrowser({ playwright, browserName, _browserOptions, connectOptions, lightpanda, lightpandaOptions }, workerInfo);
                }
                try {
                    await use(browser);
                }
                finally {
                    await browser.close({ reason: 'Test ended.' });
                    await stop();
                }
            },
            { scope: 'worker', timeout: 0 },
        ],
        lightpandaGuard: [
            async ({ lightpanda }, use, testInfo) => {
                if (lightpanda && testInfo.tags.includes(RENDER_REQUIRED_TAG)) {
                    throw new Error(`"${testInfo.title}" is tagged ${RENDER_REQUIRED_TAG}: it must run in a browser that renders, not in Lightpanda.`);
                }
                await use();
            },
            { auto: true },
        ],
    };
}
//# sourceMappingURL=fixture.js.map