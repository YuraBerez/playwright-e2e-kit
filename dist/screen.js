import { expect } from '@playwright/test';
/** Escapes every RegExp metacharacter in `text`, so it matches literally. */
export function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Base class of a reusable UI piece (dialog, table, header). A component has no route: it is
 * composed privately by the screens that render it and re-exposed as verbs. Subclasses keep their
 * locators `private`.
 */
export class BaseComponent {
    page;
    constructor(page) {
        this.page = page;
    }
}
/**
 * Base class of every routed screen. Subclasses keep their locators `private` and expose verbs,
 * `open()` and `verify…()` checks about that screen only.
 *
 * `open()` only navigates: a route guard may redirect, so callers check what actually opened with
 * `verifyShown()` / `verifyUrl()`.
 */
export class BaseScreen extends BaseComponent {
    async open() {
        await this.page.goto(this.path);
    }
    async reload() {
        await this.page.reload();
    }
    /** The browser is at this screen's URL (a guard did not redirect elsewhere). */
    async verifyUrl() {
        await expect(this.page).toHaveURL(this.expectedUrl);
    }
    /** Override for parametrised routes. The default matches `path` anywhere in the URL. */
    get expectedUrl() {
        return new RegExp(escapeRegExp(this.path));
    }
}
