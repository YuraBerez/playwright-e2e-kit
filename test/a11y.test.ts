import { describe, expect, it, vi } from 'vitest'

const analyze = vi.fn()
const withTags = vi.fn(() => ({ analyze }))
const builder = vi.fn(function (this: unknown) {
  return { withTags }
})
const toBe = vi.fn()
const pwExpect = vi.fn(() => ({ toBe }))
vi.mock('@axe-core/playwright', () => ({ default: builder }))
vi.mock('@playwright/test', () => ({
  expect: (...a: unknown[]) => (pwExpect as (...x: unknown[]) => unknown)(...a),
  test: { step: (_t: string, body: () => unknown) => body() },
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
    expect(pwExpect).toHaveBeenLastCalledWith(1, expect.stringMatching(/https:\/\/app\/screen has 1 accessibility violation\(s\):\n\[serious\] label/))
  })
})
