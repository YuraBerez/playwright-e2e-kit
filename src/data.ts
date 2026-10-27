/**
 * Data layer: test state is set up through a back door (an HTTP test-data API, a database seed),
 * not through the UI, and is removed after the test. An app implements `ResourceFactory` for each
 * kind of test data; fixtures wrap it with automatic cleanup.
 */
export interface ResourceFactory<T> {
  /** Creates one fresh resource for one test. */
  create(): Promise<T> | T
  /** Removes it. Must tolerate a resource that is already gone. */
  destroy(resource: T): Promise<void> | void
}

export interface CleanupFailure {
  label: string
  error: unknown
}

/**
 * Collects cleanup tasks while a test runs and runs them at teardown, last-in first-out (a child
 * resource is removed before its parent). A failing task does not stop the others.
 */
export class CleanupRegistry {
  private readonly tasks: { label: string; run: () => Promise<void> | void }[] = []

  /** Registers a cleanup task. `label` names it in the failure report. */
  add(label: string, run: () => Promise<void> | void): void {
    this.tasks.push({ label, run })
  }

  /** Number of tasks not yet run. */
  get size(): number {
    return this.tasks.length
  }

  /** Runs every task (LIFO) and returns the failures. The registry is empty afterwards. */
  async runAll(): Promise<CleanupFailure[]> {
    const failures: CleanupFailure[] = []
    while (this.tasks.length > 0) {
      const task = this.tasks.pop()!
      try {
        await task.run()
      } catch (error) {
        failures.push({ label: task.label, error })
      }
    }
    return failures
  }
}

/** Readable report of cleanup failures. */
export function formatCleanupFailures(failures: readonly CleanupFailure[]): string {
  const lines = failures.map(
    (f, i) => `  ${i + 1}. ${f.label}: ${f.error instanceof Error ? f.error.message : String(f.error)}`,
  )
  return `Cleanup: ${failures.length} task(s) failed:\n${lines.join('\n')}`
}
