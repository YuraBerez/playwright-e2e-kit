import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { BaseSteps } from './steps.js'

/** WCAG 2.0 and 2.1, levels A and AA. */
export const WCAG_A_AA_TAGS: readonly string[] = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * A documented, tracked accessibility exclusion. No blanket disabling: each entry names ONE axe
 * rule on ONE CSS selector, why it is acceptable for now, and the follow-up issue that removes it.
 */
export interface A11yExclusion {
  /** axe rule id, e.g. `color-contrast`. */
  rule: string
  /** CSS selector of the offending element(s), as axe reports it in `node.target`. */
  selector: string
  reason: string
  /** Follow-up issue that removes the entry. */
  issue: string
}

/** The part of an axe violation that the audit reads. */
export interface A11yViolation {
  id: string
  impact?: string | null
  help: string
  helpUrl: string
  nodes: { target: readonly unknown[]; failureSummary?: string }[]
}

/** Removes excluded nodes, then the violations that have no node left. */
export function withoutExclusions<V extends A11yViolation>(
  violations: readonly V[],
  exclusions: readonly A11yExclusion[],
): V[] {
  return violations
    .map((v) => ({
      ...v,
      nodes: v.nodes.filter((n) => !exclusions.some((x) => x.rule === v.id && n.target.some((t) => String(t) === x.selector))),
    }))
    .filter((v) => v.nodes.length > 0)
}

/** One block per violation: impact, rule, help, help URL, then each node and its failure summary. */
export function formatViolations(violations: readonly A11yViolation[]): string {
  return violations
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.help} (${v.helpUrl})\n${v.nodes
          .map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary?.replaceAll('\n', ' ')}`)
          .join('\n')}`,
    )
    .join('\n')
}

export interface A11yOptions {
  /** Exclusions hook: tracked entries that the audit ignores. */
  exclusions?: readonly A11yExclusion[]
  /** axe tags to run. Default: WCAG 2.0/2.1 A and AA. */
  tags?: readonly string[]
  /** Step group name in reports. Default `a11y`. */
  group?: string
}

/**
 * Automated accessibility audit (axe-core) of whatever screen or state the page shows now. It
 * belongs to no single screen, so it is a step, not a page-object verb.
 */
export class A11ySteps extends BaseSteps {
  private readonly exclusions: readonly A11yExclusion[]
  private readonly tags: readonly string[]

  constructor(
    private readonly page: Page,
    options: A11yOptions = {},
  ) {
    super(options.group ?? 'a11y')
    this.exclusions = options.exclusions ?? []
    this.tags = options.tags ?? WCAG_A_AA_TAGS
  }

  /** Fails with every violation (rule, impact, help URL, offending nodes) except the excluded ones. */
  async expectNoViolations(): Promise<void> {
    const { violations } = await new AxeBuilder({ page: this.page }).withTags([...this.tags]).analyze()
    const remaining = withoutExclusions(violations, this.exclusions)
    expect(
      remaining.length,
      `${this.page.url()} has ${remaining.length} accessibility violation(s):\n${formatViolations(remaining)}`,
    ).toBe(0)
  }
}
