/** `signInAndWaitForHome` -> `sign in and wait for home`. */
export declare function humanize(name: string): string;
/** Name of the reported step for one method call of a step group. */
export declare function stepTitle(group: string, method: string): string;
/**
 * Wraps every method of `target` so that each call is reported as a named, boxed `test.step()`
 * (`<group>: <method name>`). `box: true` attributes a failure to the caller (the spec line), not
 * to this wrapper. Each wrapped call returns a Promise.
 */
export declare function boxSteps<T extends object>(target: T, group: string): T;
/**
 * Base class for every step group. Each public method call is reported as a named `test.step()`
 * (visible in the HTML report and traces), with no per-method boilerplate. Steps are therefore
 * always async: make a step method `async` even if its body has no `await`.
 */
export declare abstract class BaseSteps {
    protected constructor(group: string);
}
