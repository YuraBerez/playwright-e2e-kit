// Playwright sends an empty user agent when `userAgent` is not set. Chromium reads that as "no
// override", Lightpanda uses it as is (`navigator.userAgent === ''`). So the project sets the
// binary's own one.
export const LIGHTPANDA_USER_AGENT = 'Lightpanda/1.0';
// Keys of a device descriptor that Lightpanda does not emulate (no layout, no paint) or refuses
// (`userAgent` with "Mozilla"). The Lightpanda project drops them.
const RENDERING_KEYS = ['userAgent', 'viewport', 'screen', 'deviceScaleFactor', 'isMobile', 'hasTouch', 'defaultBrowserType', 'channel'];
/**
 * One RegExp that matches only when the project grep (any of its entries, as Playwright ORs a list)
 * and the tag both match. Each part is a lookahead from the start, so `^` in a part still works.
 */
function both(grep, tag) {
    const any = grep.map((g) => `(?:${g.source})`).join('|');
    const flags = [...grep, tag].some((r) => r.flags.includes('i')) ? 'i' : '';
    return new RegExp(`^(?=[\\s\\S]*?(?:${any}))(?=[\\s\\S]*?(?:${tag.source}))`, flags);
}
/**
 * Splits one project in two by tag:
 * - `project` runs every test without the tag (`grepInvert` gets the tag);
 * - `${name}-lightpanda` runs only the tagged tests, in Lightpanda (`use.lightpanda: true`). It
 *   keeps the context options of `project.use` (`baseURL`, `storageState`, …), drops the device
 *   keys that need a renderer (`viewport`, `deviceScaleFactor`, …) and sets
 *   `userAgent: LIGHTPANDA_USER_AGENT`.
 *
 * The test file and its `test` stay the same; the fixtures need `lightpandaFixture()`. Tag a test
 * `@lightpanda` when it checks behaviour, not pixels: a negative path, a validation message, a
 * redirect, a permission, an API error. Keep layout, visual and accessibility checks in `project`.
 */
export function lightpandaProjects(project, options = {}) {
    const tag = options.tag ?? /@lightpanda/;
    const toList = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
    const shared = { ...project.use };
    for (const key of RENDERING_KEYS)
        delete shared[key];
    return [
        { ...project, grepInvert: [...toList(project.grepInvert), tag] },
        {
            ...project,
            name: options.name ?? `${project.name ?? 'e2e'}-lightpanda`,
            // A project grep (for example `/@smoke/`) still applies: the test needs the grep and the tag.
            grep: project.grep === undefined ? tag : both(toList(project.grep), tag),
            use: { ...shared, browserName: 'chromium', userAgent: LIGHTPANDA_USER_AGENT, ...options.use, lightpanda: true },
        },
    ];
}
//# sourceMappingURL=projects.js.map