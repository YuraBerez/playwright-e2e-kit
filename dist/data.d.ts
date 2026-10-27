/**
 * Data layer: test state is set up through a back door (an HTTP test-data API, a database seed),
 * not through the UI, and is removed after the test. An app implements `ResourceFactory` for each
 * kind of test data; fixtures wrap it with automatic cleanup.
 */
export interface ResourceFactory<T> {
    /** Creates one fresh resource for one test. */
    create(): Promise<T> | T;
    /** Removes it. Must tolerate a resource that is already gone. */
    destroy(resource: T): Promise<void> | void;
}
export interface CleanupFailure {
    label: string;
    error: unknown;
}
/**
 * Collects cleanup tasks while a test runs and runs them at teardown, last-in first-out (a child
 * resource is removed before its parent). A failing task does not stop the others.
 */
export declare class CleanupRegistry {
    private readonly tasks;
    /** Registers a cleanup task. `label` names it in the failure report. */
    add(label: string, run: () => Promise<void> | void): void;
    /** Number of tasks not yet run. */
    get size(): number;
    /** Runs every task (LIFO) and returns the failures. The registry is empty afterwards. */
    runAll(): Promise<CleanupFailure[]>;
}
/** Readable report of cleanup failures. */
export declare function formatCleanupFailures(failures: readonly CleanupFailure[]): string;
