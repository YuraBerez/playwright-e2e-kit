import { test, type Page } from '@playwright/test'

/** Name of the attachment that `composeReady` adds to the test when it times out. */
export const COMPOSE_DIAGNOSIS_ATTACHMENT = 'compose-diagnosis.json'

/** At most this many ids and unnamed nodes are listed (the counts are always complete). */
const MAX_LISTED = 50

/** What `diagnoseCompose(page)` finds in the Compose accessibility tree of the page. */
export interface ComposeDiagnosis {
  /** URL of the page. */
  url: string
  /** A `<canvas>` is on the page (also inside open shadow roots). */
  canvas: boolean
  /** `#cmp_a11y_root` is on the page. */
  a11yRoot: boolean
  /** Number of element nodes under `#cmp_a11y_root` (0 when the root is empty or missing). */
  nodeCount: number
  /** DOM ids of the nodes, that is the `Modifier.testTag` values that reached the DOM (first 50). */
  nodesWithId: string[]
  /** Number of nodes with an id (complete). */
  nodesWithIdCount: number
  /** Nodes with a role that needs a name but that have no accessible name, as `role#id` or `role` (first 50). */
  nodesWithoutName: string[]
  /** Number of nodes without an accessible name (complete). */
  nodesWithoutNameCount: number
  /** Computed `pointer-events` of the root, of the canvas, and the distinct values of the nodes. */
  pointerEvents: { root: string | null; canvas: string | null; nodes: string[] }
  /** Likely causes and fixes, in the order of the troubleshooting table in docs/compose-web.md. */
  hints: string[]
}

type Facts = Omit<ComposeDiagnosis, 'hints'>

/** Roles that a user (and `getByRole(role, { name })`) can find only by their accessible name. */
const NAMED_ROLES = [
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitem',
  'option',
  'combobox',
  'slider',
  'spinbutton',
  'heading',
  'img',
]

/**
 * Runs in the page. Finds the root and the canvas through open shadow roots (Compose puts both
 * in the viewport's shadow root) and reads the tree. Self-contained: Playwright serializes it.
 */
function inspectPage(args: { rootId: string; namedRoles: string[]; max: number }): Facts {
  const all: Element[] = []
  const collect = (scope: Document | ShadowRoot): void => {
    for (const el of Array.from(scope.querySelectorAll('*'))) {
      all.push(el)
      if (el.shadowRoot) collect(el.shadowRoot)
    }
  }
  collect(document)
  const root = all.find((el) => el.id === args.rootId) ?? null
  const canvas = all.find((el) => el.tagName === 'CANVAS') ?? null
  const nodes = root ? Array.from(root.querySelectorAll('*')) : []
  const pointer = (el: Element | null) => (el ? getComputedStyle(el).pointerEvents : null)
  const withId = nodes.filter((el) => el.id !== '').map((el) => el.id)
  const named = (el: Element) =>
    !!(el.getAttribute('aria-label')?.trim() || el.getAttribute('aria-labelledby')?.trim() || el.getAttribute('title')?.trim()) ||
    !!el.textContent?.trim()
  const withoutName = nodes
    .filter((el) => args.namedRoles.includes(el.getAttribute('role') ?? '') && !named(el))
    .map((el) => `${el.getAttribute('role')}${el.id ? `#${el.id}` : ''}`)
  return {
    url: location.href,
    canvas: canvas !== null,
    a11yRoot: root !== null,
    nodeCount: nodes.length,
    nodesWithId: withId.slice(0, args.max),
    nodesWithIdCount: withId.length,
    nodesWithoutName: withoutName.slice(0, args.max),
    nodesWithoutNameCount: withoutName.length,
    pointerEvents: { root: pointer(root), canvas: pointer(canvas), nodes: [...new Set(nodes.map((el) => pointer(el) ?? ''))] },
  }
}

/** The likely causes and fixes for what `diagnoseCompose` found. Pure: exported for the unit tests. */
export function composeHints(facts: Facts): string[] {
  const hints: string[] = []
  if (!facts.a11yRoot) {
    hints.push(
      facts.canvas
        ? 'There is a canvas but no #cmp_a11y_root: the app is still loading (give composeReady a longer timeout), or ComposeViewport sets isA11YEnabled = false (remove it: the tree is on by default).'
        : 'There is no canvas and no #cmp_a11y_root: the page is not a Compose Multiplatform wasmJs app, or the wasm module did not start (see the browser console and the network log).',
    )
    return hints
  }
  if (facts.nodeCount === 0) {
    hints.push('#cmp_a11y_root is empty: the first composition did not finish, or the app threw at start-up (see the browser console).')
    return hints
  }
  if (facts.nodesWithIdCount === 0) {
    hints.push(
      'No node has an id: no Modifier.testTag reached the DOM. Put the test tag on the node that keeps its own semantics; a tag on a child of a merging node (Button, clickable, semantics(mergeDescendants = true)) is merged away.',
    )
  }
  if (facts.nodesWithoutNameCount > 0) {
    hints.push(
      `${facts.nodesWithoutNameCount} node(s) with a role have no accessible name, so getByRole(role, { name }) cannot find them: add Modifier.semantics { contentDescription = "…" } (the label of a TextField is not exposed) or a test tag.`,
    )
  }
  if (facts.pointerEvents.nodes.includes('none')) {
    hints.push('The nodes have pointer-events: none and the canvas takes the pointer: use tap() / composeTap(), not click().')
  }
  return hints
}

/**
 * Reads the Compose accessibility tree of the page and explains the usual failures: the root is
 * missing (`isA11YEnabled = false`) or empty, no `Modifier.testTag` became a DOM id, nodes have no
 * accessible name, the nodes do not take the pointer. Read-only: it does not change the page.
 * `composeReady` attaches it to the test as `compose-diagnosis.json` when it times out.
 */
export async function diagnoseCompose(page: Page): Promise<ComposeDiagnosis> {
  const facts = await page.evaluate(inspectPage, { rootId: 'cmp_a11y_root', namedRoles: NAMED_ROLES, max: MAX_LISTED })
  return { ...facts, hints: composeHints(facts) }
}

/** One-line summary of a diagnosis for an error message. */
export function formatComposeDiagnosis(d: ComposeDiagnosis): string {
  const root = d.a11yRoot ? `#cmp_a11y_root with ${d.nodeCount} node(s)` : 'no #cmp_a11y_root'
  const facts = `${d.canvas ? 'canvas' : 'no canvas'}, ${root}, ${d.nodesWithIdCount} with an id, ${d.nodesWithoutNameCount} without a name`
  return d.hints.length > 0 ? `${facts}. ${d.hints.join(' ')}` : `${facts}.`
}

/**
 * Attaches the diagnosis to the running test. Does nothing outside a test (for example in a
 * global setup), because there `test.info()` throws.
 */
export async function attachComposeDiagnosis(diagnosis: ComposeDiagnosis): Promise<void> {
  let info: ReturnType<typeof test.info>
  try {
    info = test.info()
  } catch {
    return
  }
  await info.attach(COMPOSE_DIAGNOSIS_ATTACHMENT, { body: JSON.stringify(diagnosis, null, 2), contentType: 'application/json' })
}
