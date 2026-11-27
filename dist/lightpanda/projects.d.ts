import type { PlaywrightTestConfig } from '@playwright/test';
type Project = NonNullable<PlaywrightTestConfig['projects']>[number];
export interface LightpandaProjectsOptions {
    /** Tests with this tag run in Lightpanda, all others in `project`. Default `/@lightpanda/`. */
    tag?: RegExp;
    /** Name of the Lightpanda project. Default `${project.name}-lightpanda`. */
    name?: string;
    /** `use` of the Lightpanda project, on top of the shared keys of `project.use`. */
    use?: Project['use'];
}
export declare const LIGHTPANDA_USER_AGENT = "Lightpanda/1.0";
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
export declare function lightpandaProjects(project: Project, options?: LightpandaProjectsOptions): [Project, Project];
export {};
//# sourceMappingURL=projects.d.ts.map