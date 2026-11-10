import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { BaseSteps } from './core/steps.js'

/** WCAG 2.0 and 2.1, levels A and AA. */
export const WCAG_A_AA_TAGS: readonly string[] = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** Fields every exclusion shares. */
interface A11yExclusionBase {
  /** axe rule id, e.g. `color-contrast`. */
  rule: string
  reason: string
  /** Follow-up issue that removes the entry. */
  issue: string
}

/**
 * A documented, tracked accessibility exclusion. No blanket disabling: each entry names ONE axe
 * rule on the elements ONE matcher selects, why it is acceptable for now, and the follow-up issue
 * that removes it. Give exactly one matcher: `selector`, `attribute` or `selectorPattern`.
 */
export type A11yExclusion = A11yExclusionBase &
  (
    | {
        /** CSS selector of the offending element(s), compared as a whole with `node.target`. */
        selector: string
        attribute?: never
        selectorPattern?: never
      }
    | {
        /**
         * Attribute selector, e.g. `[flt-semantics-identifier="map"]`. Matches every node whose
         * target contains it, or whose element (axe `node.html`) has that attribute, so it
         * survives a changed tag, parent or generated id. axe targets an element by its `id`
         * when it has one (every Flutter semantics node has), so the element check is the one
         * that matches there.
         */
        attribute: string
        selector?: never
        selectorPattern?: never
      }
    | {
        /** Pattern tested against each part of `node.target`, e.g. `/^#flt-sem-\d+$/`. */
        selectorPattern: RegExp
        selector?: never
        attribute?: never
      }
  )

/** True when the exclusion's matcher selects this target part. */
function targetMatches(x: A11yExclusion, target: string): boolean {
  if (x.selector !== undefined) return target === x.selector
  if (x.attribute !== undefined) return target.includes(x.attribute)
  if (x.selectorPattern !== undefined) return new RegExp(x.selectorPattern.source, x.selectorPattern.flags.replace(/[gy]/g, '')).test(target)
  return false
}

/**
 * True when the element's opening tag (axe `node.html`) has the attribute of an attribute
 * selector: `[name]` or `[name="value"]` (single, double or no quotes).
 */
export function htmlHasAttribute(html: string | undefined, attribute: string): boolean {
  const m = /^\[\s*([^\s~|^$*=\]]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*)))?\s*\]$/.exec(attribute)
  if (!html || !m) return false
  const name = m[1]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tag = /^<[^>]*>/.exec(html)?.[0] ?? html
  const value = m[2] ?? m[3] ?? m[4]
  if (value === undefined) return new RegExp(`\\s${name}(\\s|=|/?>)`).test(tag)
  const v = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  return tag.includes(` ${m[1]}="${v}"`)
}

/**
 * The strings an exclusion is tested against for one target part. axe gives an element inside a
 * shadow root (Compose Multiplatform web, web components) as a nested array, one selector per
 * shadow host: it is matched as a whole (joined, as before) and part by part.
 */
function targetStrings(target: unknown): string[] {
  return Array.isArray(target) ? [String(target), ...target.map(String)] : [String(target)]
}

/** True when the exclusion selects the node, through one of its target parts or its element. */
function nodeMatches(x: A11yExclusion, node: A11yViolation['nodes'][number]): boolean {
  if (node.target.some((t) => targetStrings(t).some((part) => targetMatches(x, part)))) return true
  return x.attribute !== undefined && htmlHasAttribute(node.html, x.attribute)
}

/** The part of an axe violation that the audit reads. */
export interface A11yViolation {
  id: string
  impact?: string | null
  help: string
  helpUrl: string
  nodes: { target: readonly unknown[]; html?: string; failureSummary?: string }[]
}

/** Removes excluded nodes, then the violations that have no node left. */
export function withoutExclusions<V extends A11yViolation>(
  violations: readonly V[],
  exclusions: readonly A11yExclusion[],
): V[] {
  return violations
    .map((v) => ({
      ...v,
      nodes: v.nodes.filter((n) => !exclusions.some((x) => x.rule === v.id && nodeMatches(x, n))),
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

  /** Fails with every violation (rule, impact, help URL, offending nodes) except the excluded ones,
   * and attaches the full axe report as `axe-report.json`. */
  async expectNoViolations(): Promise<void> {
    const { violations } = await new AxeBuilder({ page: this.page }).withTags([...this.tags]).analyze()
    const remaining = withoutExclusions(violations, this.exclusions)
    if (remaining.length > 0) {
      // The full report (all violations, before exclusions) for triage: the message shows the remaining ones only.
      await test.info().attach('axe-report.json', {
        body: JSON.stringify({ url: this.page.url(), tags: this.tags, violations, remaining }, null, 2),
        contentType: 'application/json',
      })
    }
    expect(
      remaining.length,
      `${this.page.url()} has ${remaining.length} accessibility violation(s):\n${formatViolations(remaining)}`,
    ).toBe(0)
  }
}
