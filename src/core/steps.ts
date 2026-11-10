import { test } from '@playwright/test'

/** `signInAndWaitForHome` -> `sign in and wait for home`. */
export function humanize(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
}

/** Name of the reported step for one method call of a step group. */
export function stepTitle(group: string, method: string): string {
  return `${group}: ${humanize(method)}`
}

/**
 * Wraps every method of `target` so that each call is reported as a named, boxed `test.step()`
 * (`<group>: <method name>`). `box: true` attributes a failure to the caller (the spec line), not
 * to this wrapper. Each wrapped call returns a Promise.
 */
export function boxSteps<T extends object>(target: T, group: string): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value: unknown = Reflect.get(obj, prop, receiver)
      if (typeof prop !== 'string' || typeof value !== 'function' || prop === 'constructor') return value
      return (...args: unknown[]) =>
        test.step(
          stepTitle(group, prop),
          () => (value as (...a: unknown[]) => unknown).apply(receiver, args) as Promise<unknown>,
          { box: true },
        )
    },
  })
}

/**
 * Base class for every step group. Each public method call is reported as a named `test.step()`
 * (visible in the HTML report and traces), with no per-method boilerplate. Steps are therefore
 * always async: make a step method `async` even if its body has no `await`.
 */
export abstract class BaseSteps {
  protected constructor(group: string) {
    return boxSteps(this, group)
  }
}
