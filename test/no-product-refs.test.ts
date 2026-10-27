import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain ESM script without types
import { isNeutralHost, loadTerms, ownRepo, parseTerms, scanText } from '../scripts/check-no-product-refs.mjs'

// Built from parts, so the repository scan itself does not see these test URLs.
const HTTPS = 'https:' + '//'
const GH = `${HTTPS}github.com`

type Finding = { line: number; match: string; why: string }
const scan = scanText as (text: string, opts?: object) => Finding[]

describe('check:no-product-refs', () => {
  it('parses literal and /regex/ terms, skipping blanks and comments', () => {
    const terms = (parseTerms as (t: string) => RegExp[])('acme\n# comment\n\n/foo-?\\d+/, a.b')
    expect(terms.map(String)).toEqual(['/acme/i', '/foo-?\\d+/i', '/a\\.b/i'])
  })

  it('reads the repository slug', () => {
    expect(ownRepo({ url: `git+${GH}/Owner/Kit.git` })).toBe('owner/kit')
    expect(ownRepo('github:owner/kit')).toBeUndefined()
    expect(ownRepo(undefined)).toBeUndefined()
  })

  it('flags deny-listed terms case-insensitively with the line', () => {
    const terms = (parseTerms as (t: string) => RegExp[])('acme')
    expect(scan('ok\nBuilt for ACME corp', { terms })).toEqual([{ line: 2, match: 'ACME', why: 'deny-listed term' }])
  })

  it('flags unknown URL hosts and GitHub URLs outside the own repository', () => {
    const found = scan(
      `see https://playwright.dev/docs and ${HTTPS}private.internal/x https://api/a https://shop.example.com/\n` +
        `${GH}/owner/kit/issues ${GH}/other/app ${GH}/microsoft/playwright`,
      { repo: 'owner/kit' },
    )
    expect(found.map((f) => f.why)).toEqual(['URL host not on the allow-list', 'GitHub URL outside this repository'])
  })

  it('can skip URL checks (generated lock files)', () => {
    expect(scan(`${HTTPS}private.internal/x`, { urls: false })).toEqual([])
  })

  it('treats single-label and reserved example hosts as neutral', () => {
    const neutral = isNeutralHost as (h: string) => boolean
    expect(['localhost', 'app', 'example.com', 'a.example.org', 'x.test', 'y.invalid', 'z.localhost'].every(neutral)).toBe(true)
    expect(['private.internal', 'example.company.io'].some(neutral)).toBe(false)
  })

  it('loads terms from the environment and the local file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refs-'))
    const file = join(dir, '.no-product-refs')
    writeFileSync(file, 'beta\n')
    const terms = (loadTerms as (env: object, f: string) => RegExp[])({ NO_PRODUCT_REFS: 'alpha' }, file)
    expect(terms.map(String)).toEqual(['/alpha/i', '/beta/i'])
    expect((loadTerms as (env: object, f: string) => RegExp[])({}, join(dir, 'missing'))).toEqual([])
  })
})
