import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { BaseSteps } from './steps.js';
/** WCAG 2.0 and 2.1, levels A and AA. */
export const WCAG_A_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
/** Removes excluded nodes, then the violations that have no node left. */
export function withoutExclusions(violations, exclusions) {
    return violations
        .map((v) => ({
        ...v,
        nodes: v.nodes.filter((n) => !exclusions.some((x) => x.rule === v.id && n.target.some((t) => String(t) === x.selector))),
    }))
        .filter((v) => v.nodes.length > 0);
}
/** One block per violation: impact, rule, help, help URL, then each node and its failure summary. */
export function formatViolations(violations) {
    return violations
        .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.helpUrl})\n${v.nodes
        .map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary?.replaceAll('\n', ' ')}`)
        .join('\n')}`)
        .join('\n');
}
/**
 * Automated accessibility audit (axe-core) of whatever screen or state the page shows now. It
 * belongs to no single screen, so it is a step, not a page-object verb.
 */
export class A11ySteps extends BaseSteps {
    page;
    exclusions;
    tags;
    constructor(page, options = {}) {
        super(options.group ?? 'a11y');
        this.page = page;
        this.exclusions = options.exclusions ?? [];
        this.tags = options.tags ?? WCAG_A_AA_TAGS;
    }
    /** Fails with every violation (rule, impact, help URL, offending nodes) except the excluded ones. */
    async expectNoViolations() {
        const { violations } = await new AxeBuilder({ page: this.page }).withTags([...this.tags]).analyze();
        const remaining = withoutExclusions(violations, this.exclusions);
        expect(remaining.length, `${this.page.url()} has ${remaining.length} accessibility violation(s):\n${formatViolations(remaining)}`).toBe(0);
    }
}
