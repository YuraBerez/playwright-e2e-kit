import type { ResourceFactory } from 'playwright-e2e-kit'

/**
 * Stand-in for a back-door test-data API: an in-memory store per worker. The suite checks in
 * `afterAll` that every record created by a fixture or a cleanup task is gone again.
 */
export const store = new Set<string>()

export interface TestRecord {
  id: string
  name: string
}

let next = 0

export const recordFactory: ResourceFactory<TestRecord> = {
  create: () => {
    const record = { id: `record-${process.pid}-${next++}`, name: `Ada ${next}` }
    store.add(record.id)
    return record
  },
  destroy: (record) => {
    store.delete(record.id)
  },
}
