import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { BaseSteps } from './core/steps.js';
/** WCAG 2.0 and 2.1, levels A and AA. */
export const WCAG_A_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
/** True when the exclusion's matcher selects this target part. */
function targetMatches(x, target) {
    if (x.selector !== undefined)
        return target === x.selector;
    if (x.attribute !== undefined)
        return target.includes(x.attribute);
    if (x.selectorPattern !== undefined)
        return new RegExp(x.selectorPattern.source, x.selectorPattern.flags.replace(/[gy]/g, '')).test(target);
    return false;
}
/**
 * True when the element's opening tag (axe `node.html`) has the attribute of an attribute
 * selector: `[name]` or `[name="value"]` (single, double or no quotes).
 */
export function htmlHasAttribute(html, attribute) {
    const m = /^\[\s*([^\s~|^$*=\]]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*)))?\s*\]$/.exec(attribute);
    if (!html || !m)
        return false;
    const name = m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tag = /^<[^>]*>/.exec(html)?.[0] ?? html;
    const value = m[2] ?? m[3] ?? m[4];
    if (value === undefined)
        return new RegExp(`\\s${name}(\\s|=|/?>)`).test(tag);
    const v = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return tag.includes(` ${m[1]}="${v}"`);
}
/**
 * The strings an exclusion is tested against for one target part. axe gives an element inside a
 * shadow root (Compose Multiplatform web, web components) as a nested array, one selector per
 * shadow host: it is matched as a whole (joined, as before) and part by part.
 */
function targetStrings(target) {
    return Array.isArray(target) ? [String(target), ...target.map(String)] : [String(target)];
}
/** True when the exclusion selects the node, through one of its target parts or its element. */
function nodeMatches(x, node) {
    if (node.target.some((t) => targetStrings(t).some((part) => targetMatches(x, part))))
        return true;
    return x.attribute !== undefined && htmlHasAttribute(node.html, x.attribute);
}
/** Removes excluded nodes, then the violations that have no node left. */
export function withoutExclusions(violations, exclusions) {
    return violations
        .map((v) => ({
        ...v,
        nodes: v.nodes.filter((n) => !exclusions.some((x) => x.rule === v.id && nodeMatches(x, n))),
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
    /** Fails with every violation (rule, impact, help URL, offending nodes) except the excluded ones,
     * and attaches the full axe report as `axe-report.json`. */
    async expectNoViolations() {
        const { violations } = await new AxeBuilder({ page: this.page }).withTags([...this.tags]).analyze();
        const remaining = withoutExclusions(violations, this.exclusions);
        if (remaining.length > 0) {
            // The full report (all violations, before exclusions) for triage: the message shows the remaining ones only.
            await test.info().attach('axe-report.json', {
                body: JSON.stringify({ url: this.page.url(), tags: this.tags, violations, remaining }, null, 2),
                contentType: 'application/json',
            });
        }
        expect(remaining.length, `${this.page.url()} has ${remaining.length} accessibility violation(s):\n${formatViolations(remaining)}`).toBe(0);
    }
}
//# sourceMappingURL=a11y.js.map