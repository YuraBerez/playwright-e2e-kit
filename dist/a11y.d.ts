import { type Page } from '@playwright/test';
import { BaseSteps } from './steps.js';
/** WCAG 2.0 and 2.1, levels A and AA. */
export declare const WCAG_A_AA_TAGS: readonly string[];
/** Fields every exclusion shares. */
interface A11yExclusionBase {
    /** axe rule id, e.g. `color-contrast`. */
    rule: string;
    reason: string;
    /** Follow-up issue that removes the entry. */
    issue: string;
}
/**
 * A documented, tracked accessibility exclusion. No blanket disabling: each entry names ONE axe
 * rule on the elements ONE matcher selects, why it is acceptable for now, and the follow-up issue
 * that removes it. Give exactly one matcher: `selector`, `attribute` or `selectorPattern`.
 */
export type A11yExclusion = A11yExclusionBase & ({
    /** CSS selector of the offending element(s), compared as a whole with `node.target`. */
    selector: string;
    attribute?: never;
    selectorPattern?: never;
} | {
    /**
     * Attribute selector, e.g. `[flt-semantics-identifier="map"]`. Matches every node whose
     * target contains it, so it survives a changed tag, parent or generated id.
     */
    attribute: string;
    selector?: never;
    selectorPattern?: never;
} | {
    /** Pattern tested against each part of `node.target`, e.g. `/^#flt-sem-\d+$/`. */
    selectorPattern: RegExp;
    selector?: never;
    attribute?: never;
});
/** The part of an axe violation that the audit reads. */
export interface A11yViolation {
    id: string;
    impact?: string | null;
    help: string;
    helpUrl: string;
    nodes: {
        target: readonly unknown[];
        failureSummary?: string;
    }[];
}
/** Removes excluded nodes, then the violations that have no node left. */
export declare function withoutExclusions<V extends A11yViolation>(violations: readonly V[], exclusions: readonly A11yExclusion[]): V[];
/** One block per violation: impact, rule, help, help URL, then each node and its failure summary. */
export declare function formatViolations(violations: readonly A11yViolation[]): string;
export interface A11yOptions {
    /** Exclusions hook: tracked entries that the audit ignores. */
    exclusions?: readonly A11yExclusion[];
    /** axe tags to run. Default: WCAG 2.0/2.1 A and AA. */
    tags?: readonly string[];
    /** Step group name in reports. Default `a11y`. */
    group?: string;
}
/**
 * Automated accessibility audit (axe-core) of whatever screen or state the page shows now. It
 * belongs to no single screen, so it is a step, not a page-object verb.
 */
export declare class A11ySteps extends BaseSteps {
    private readonly page;
    private readonly exclusions;
    private readonly tags;
    constructor(page: Page, options?: A11yOptions);
    /** Fails with every violation (rule, impact, help URL, offending nodes) except the excluded ones,
     * and attaches the full axe report as `axe-report.json`. */
    expectNoViolations(): Promise<void>;
}
export {};
