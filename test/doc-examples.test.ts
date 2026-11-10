import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const DIR = join(ROOT, 'test', 'doc-examples')
const README = readFileSync(join(ROOT, 'README.md'), 'utf8')

// The typed files in test/doc-examples/ are type-checked by `npm run type-check`.
// Each one must appear unchanged in the README, so the guide cannot drift from compiling code.
describe('README examples', () => {
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.ts'))) {
    it(`${file} is in the README verbatim`, () => {
      expect(README).toContain(readFileSync(join(DIR, file), 'utf8').trimEnd())
    })
  }
})
