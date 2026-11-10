import { type Page } from '@playwright/test';
/** Name of the attachment that `composeReady` adds to the test when it times out. */
export declare const COMPOSE_DIAGNOSIS_ATTACHMENT = "compose-diagnosis.json";
/** What `diagnoseCompose(page)` finds in the Compose accessibility tree of the page. */
export interface ComposeDiagnosis {
    /** URL of the page. */
    url: string;
    /** A `<canvas>` is on the page (also inside open shadow roots). */
    canvas: boolean;
    /** `#cmp_a11y_root` is on the page. */
    a11yRoot: boolean;
    /** Number of element nodes under `#cmp_a11y_root` (0 when the root is empty or missing). */
    nodeCount: number;
    /** DOM ids of the nodes, that is the `Modifier.testTag` values that reached the DOM (first 50). */
    nodesWithId: string[];
    /** Number of nodes with an id (complete). */
    nodesWithIdCount: number;
    /** Nodes with a role that needs a name but that have no accessible name, as `role#id` or `role` (first 50). */
    nodesWithoutName: string[];
    /** Number of nodes without an accessible name (complete). */
    nodesWithoutNameCount: number;
    /** Computed `pointer-events` of the root, of the canvas, and the distinct values of the nodes. */
    pointerEvents: {
        root: string | null;
        canvas: string | null;
        nodes: string[];
    };
    /** Likely causes and fixes, in the order of the troubleshooting table in docs/compose-web.md. */
    hints: string[];
}
type Facts = Omit<ComposeDiagnosis, 'hints'>;
/** The likely causes and fixes for what `diagnoseCompose` found. Pure: exported for the unit tests. */
export declare function composeHints(facts: Facts): string[];
/**
 * Reads the Compose accessibility tree of the page and explains the usual failures: the root is
 * missing (`isA11YEnabled = false`) or empty, no `Modifier.testTag` became a DOM id, nodes have no
 * accessible name, the nodes do not take the pointer. Read-only: it does not change the page.
 * `composeReady` attaches it to the test as `compose-diagnosis.json` when it times out.
 */
export declare function diagnoseCompose(page: Page): Promise<ComposeDiagnosis>;
/** One-line summary of a diagnosis for an error message. */
export declare function formatComposeDiagnosis(d: ComposeDiagnosis): string;
/**
 * Attaches the diagnosis to the running test. Does nothing outside a test (for example in a
 * global setup), because there `test.info()` throws.
 */
export declare function attachComposeDiagnosis(diagnosis: ComposeDiagnosis): Promise<void>;
export {};
//# sourceMappingURL=diagnose.d.ts.map