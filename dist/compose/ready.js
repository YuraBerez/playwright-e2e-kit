import { attachComposeDiagnosis, diagnoseCompose, formatComposeDiagnosis } from './diagnose.js';
/**
 * Selector of the accessibility root that Compose Multiplatform web (wasmJs) builds next to its
 * canvas, inside the viewport's open shadow root. Playwright CSS pierces open shadow roots.
 */
export const COMPOSE_A11Y_ROOT = '#cmp_a11y_root';
function within(timeout) {
    return timeout === undefined ? 'within the default timeout' : `within ${timeout} ms`;
}
/**
 * App-ready hook for a Compose Multiplatform web (wasmJs) app. `ComposeViewport` creates the
 * canvas and an empty `#cmp_a11y_root` when the wasm module starts, and fills the root with one
 * node per semantics node after the first composition and layout. This hook waits for that first
 * node: from then on `getByRole` / `getByText` / `getByTestId` see the widgets.
 *
 * Compose sends no "first frame" event, so nothing must be installed before navigation. The tree
 * needs no activation: it is on by default (`isA11YEnabled = true`). An app that sets
 * `isA11YEnabled = false` has no tree, and this hook fails with an error that says so.
 *
 * On a timeout it runs `diagnoseCompose(page)`, adds its summary to the error and attaches it to
 * the test as `compose-diagnosis.json`.
 */
export const composeReady = async (page, options = {}) => {
    try {
        await page.locator(`${COMPOSE_A11Y_ROOT} > *`).first().waitFor({ state: 'attached', timeout: options.timeout });
    }
    catch (cause) {
        const diagnosis = await diagnoseCompose(page).catch(() => undefined);
        let detail;
        if (diagnosis) {
            // The attachment is a help only: its failure must never replace the timeout error.
            await attachComposeDiagnosis(diagnosis).catch(() => undefined);
            detail = `Diagnosis (attached as compose-diagnosis.json): ${formatComposeDiagnosis(diagnosis)}`;
        }
        else {
            // The page could not run the diagnosis (closed, or navigating): the plain check only.
            const hasRoot = (await page.locator(COMPOSE_A11Y_ROOT).count().catch(() => 0)) > 0;
            detail = hasRoot
                ? `${COMPOSE_A11Y_ROOT} is there but has no nodes: the first composition did not finish (see the browser console).`
                : `There is no ${COMPOSE_A11Y_ROOT}: check that the page is a Compose Multiplatform wasmJs app and that ` +
                    'ComposeViewport does not set isA11YEnabled = false.';
        }
        throw new Error(`composeReady: the Compose accessibility tree did not get a node ${within(options.timeout)}. ${detail}`, {
            cause,
        });
    }
};
/** `composeReady` with fixed options, as an `AppReady`. */
export function composeReadyWith(options) {
    return (page) => composeReady(page, options);
}
//# sourceMappingURL=ready.js.map