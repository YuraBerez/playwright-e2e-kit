/**
 * Collects cleanup tasks while a test runs and runs them at teardown, last-in first-out (a child
 * resource is removed before its parent). A failing task does not stop the others.
 */
export class CleanupRegistry {
    tasks = [];
    /** Registers a cleanup task. `label` names it in the failure report. */
    add(label, run) {
        this.tasks.push({ label, run });
    }
    /** Number of tasks not yet run. */
    get size() {
        return this.tasks.length;
    }
    /** Runs every task (LIFO) and returns the failures. The registry is empty afterwards. */
    async runAll() {
        const failures = [];
        while (this.tasks.length > 0) {
            const task = this.tasks.pop();
            try {
                await task.run();
            }
            catch (error) {
                failures.push({ label: task.label, error });
            }
        }
        return failures;
    }
}
/** Readable report of cleanup failures. */
export function formatCleanupFailures(failures) {
    const lines = failures.map((f, i) => `  ${i + 1}. ${f.label}: ${f.error instanceof Error ? f.error.message : String(f.error)}`);
    return `Cleanup: ${failures.length} task(s) failed:\n${lines.join('\n')}`;
}
