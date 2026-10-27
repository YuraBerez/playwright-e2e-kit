import { type Page } from '@playwright/test';
import { BaseSteps } from './steps.js';
/** WCAG 2.0 and 2.1, levels A and AA. */
export declare const WCAG_A_AA_TAGS: readonly string[];
/**
 * A documented, tracked accessibility exclusion. No blanket disabling: each entry names ONE axe
 * rule on ONE CSS selector, why it is acceptable for now, and the follow-up issue that removes it.
 */
export interface A11yExclusion {
    /** axe rule id, e.g. `color-contrast`. */
    rule: string;
    /** CSS selector of the offending element(s), as axe reports it in `node.target`. */
    selector: string;
    reason: string;
    /** Follow-up issue that removes the entry. */
    issue: string;
}
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
    /** Fails with every violation (rule, impact, help URL, offending nodes) except the excluded ones. */
    expectNoViolations(): Promise<void>;
}
