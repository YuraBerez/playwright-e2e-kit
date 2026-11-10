import { describe, expect, it, vi } from 'vitest'

const analyze = vi.fn()
const withTags = vi.fn(() => ({ analyze }))
const builder = vi.fn(function (this: unknown) {
  return { withTags }
})
const toBe = vi.fn()
const attach = vi.fn()
const pwExpect = vi.fn(() => ({ toBe }))
vi.mock('@axe-core/playwright', () => ({ default: builder }))
vi.mock('@playwright/test', () => ({
  expect: (...a: unknown[]) => (pwExpect as (...x: unknown[]) => unknown)(...a),
  test: { info: () => ({ attach }), step: (_t: string, body: () => unknown) => body() },
}))

const { A11ySteps, WCAG_A_AA_TAGS, formatViolations, withoutExclusions } = await import('../src/a11y.js')
type Page = ConstructorParameters<typeof A11ySteps>[0]

const violation = (id: string, targets: string[], impact: string | null = 'serious') => ({
  id,
  impact,
  help: `${id} help`,
  helpUrl: `https://dequeuniversity.com/rules/${id}`,
  nodes: targets.map((t) => ({ target: [t], failureSummary: 'Fix:\nthis' })),
})

describe('withoutExclusions', () => {
  it('drops excluded nodes of the same rule only, then empty violations', () => {
    const result = withoutExclusions(
      [violation('color-contrast', ['.a', '.b']), violation('label', ['.a']), violation('region', ['.c'])],
      [
        { rule: 'color-contrast', selector: '.a', reason: 'r', issue: 'i' },
        { rule: 'region', selector: '.c', reason: 'r', issue: 'i' },
      ],
    )
    expect(result.map((v) => [v.id, v.nodes.map((n) => n.target[0])])).toEqual([
      ['color-contrast', ['.b']],
      ['label', ['.a']],
    ])
  })
})

describe('withoutExclusions matchers', () => {
  const base = { reason: 'r', issue: 'i' }
  const flt = violation('label', ['flt-semantics[flt-semantics-identifier="map"]'])
  const ids = violation('color-contrast', ['#flt-sem-12', '#flt-sem-9', '#other'])

  it('matches an attribute selector inside the target', () => {
    const r = withoutExclusions([flt], [{ rule: 'label', attribute: '[flt-semantics-identifier="map"]', ...base }])
    expect(r).toEqual([])
  })

  it('does not match an attribute that is absent or a different rule', () => {
    expect(withoutExclusions([flt], [{ rule: 'label', attribute: '[flt-semantics-identifier="list"]', ...base }])).toHaveLength(1)
    expect(withoutExclusions([flt], [{ rule: 'region', attribute: '[flt-semantics-identifier="map"]', ...base }])).toHaveLength(1)
  })

  it('matches a RegExp against the target, also with a g flag, repeatedly', () => {
    const ex = [{ rule: 'color-contrast', selectorPattern: /^#flt-sem-\d+$/g, ...base }]
    for (let i = 0; i < 2; i++) {
      expect(withoutExclusions([ids], ex)[0]?.nodes.map((n) => n.target[0])).toEqual(['#other'])
    }
  })

  it('keeps an exact selector exact: no substring or prefix match', () => {
    const v = violation('label', ['.abc', '.a'])
    expect(withoutExclusions([v], [{ rule: 'label', selector: '.a', ...base }])[0]?.nodes.map((n) => n.target[0])).toEqual(['.abc'])
  })
})

describe('formatViolations', () => {
  it('lists impact, rule, help URL and nodes on one line each', () => {
    expect(formatViolations([violation('label', ['#x'])])).toBe(
      '[serious] label: label help (https://dequeuniversity.com/rules/label)\n    #x\n      Fix: this',
    )
  })
})

describe('A11ySteps', () => {
  const page = { url: () => 'https://app/screen' } as unknown as Page

  it('audits with the WCAG A/AA tags and passes with no violation', async () => {
    analyze.mockResolvedValueOnce({ violations: [] })
    await new A11ySteps(page).expectNoViolations()
    expect(builder).toHaveBeenCalledWith({ page })
    expect(withTags).toHaveBeenLastCalledWith([...WCAG_A_AA_TAGS])
    expect(pwExpect).toHaveBeenLastCalledWith(0, expect.stringContaining('has 0 accessibility violation(s)'))
    expect(toBe).toHaveBeenLastCalledWith(0)
  })

  it('reports remaining violations and honours exclusions and custom tags', async () => {
    analyze.mockResolvedValueOnce({ violations: [violation('label', ['#x']), violation('region', ['.c'])] })
    await new A11ySteps(page, {
      tags: ['wcag22aa'],
      exclusions: [{ rule: 'region', selector: '.c', reason: 'r', issue: 'i' }],
    }).expectNoViolations()
    expect(withTags).toHaveBeenLastCalledWith(['wcag22aa'])
    expect(attach).toHaveBeenCalledTimes(1)
    expect(pwExpect).toHaveBeenLastCalledWith(1, expect.stringMatching(/https:\/\/app\/screen has 1 accessibility violation\(s\):\n\[serious\] label/))
  })

  it('attaches the full axe report (all violations) as JSON on failure only', async () => {
    attach.mockClear()
    analyze.mockResolvedValueOnce({ violations: [violation('label', ['#x']), violation('region', ['.c'])] })
    await new A11ySteps(page, { exclusions: [{ rule: 'region', selector: '.c', reason: 'r', issue: 'i' }] }).expectNoViolations()
    const [name, opts] = attach.mock.calls[0] as [string, { body: string; contentType: string }]
    expect(name).toBe('axe-report.json')
    expect(opts.contentType).toBe('application/json')
    const report = JSON.parse(opts.body) as { url: string; violations: unknown[]; remaining: unknown[] }
    expect(report.url).toBe('https://app/screen')
    expect(report.violations).toHaveLength(2)
    expect(report.remaining).toHaveLength(1)

    attach.mockClear()
    analyze.mockResolvedValueOnce({ violations: [] })
    await new A11ySteps(page).expectNoViolations()
    expect(attach).not.toHaveBeenCalled()
  })

  it('keeps defaults identical for React/Vue consumers: WCAG tags, no exclusions', async () => {
    analyze.mockResolvedValueOnce({ violations: [violation('label', ['#x'])] })
    await new A11ySteps(page).expectNoViolations()
    expect(withTags).toHaveBeenLastCalledWith(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    expect(pwExpect).toHaveBeenLastCalledWith(1, expect.any(String))
  })
})
