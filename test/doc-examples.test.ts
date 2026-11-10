import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const DIR = join(ROOT, 'test', 'doc-examples')
const DOCS = join(ROOT, 'docs')
const README = [join(ROOT, 'README.md'), ...readdirSync(DOCS).filter((f) => f.endsWith('.md')).map((f) => join(DOCS, f))]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

// The typed files in test/doc-examples/ are type-checked by `npm run type-check`.
// Each one must appear unchanged in README.md or docs/, so the guide cannot drift from compiling code.
describe('README examples', () => {
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.ts'))) {
    it(`${file} is in README.md or docs/ verbatim`, () => {
      expect(README).toContain(readFileSync(join(DIR, file), 'utf8').trimEnd())
    })
  }
})
