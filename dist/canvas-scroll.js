function centerInside(target, area) {
    const cx = target.x + target.width / 2;
    const cy = target.y + target.height / 2;
    return cx >= area.x && cx <= area.x + area.width && cy >= area.y && cy <= area.y + area.height;
}
/**
 * Scrolls a canvas-rendered list (Flutter web, Compose Multiplatform wasm) until `locator` is on
 * screen. These lists are virtualised and drawn on a canvas: an off-screen item is not in the
 * accessibility DOM tree, and `scrollIntoViewIfNeeded` cannot reach it. This moves the mouse over the scrollable and turns the wheel, one step (80% of its
 * size) at a time, until the centre of `locator` is inside the scrollable.
 *
 * Throws after `maxSwipes` steps with no match.
 */
export async function scrollUntilVisible(page, locator, options = {}) {
    const maxSwipes = options.maxSwipes ?? 10;
    const settleTimeout = options.settleTimeout ?? 500;
    const direction = options.direction ?? 'down';
    const area = async () => {
        if (options.within) {
            const box = await options.within.boundingBox();
            if (!box)
                throw new Error(`scrollUntilVisible: the scrollable ${options.within} is not visible.`);
            return box;
        }
        const size = page.viewportSize();
        if (!size)
            throw new Error('scrollUntilVisible: the page has no fixed viewport; pass `within`.');
        return { x: 0, y: 0, ...size };
    };
    // `timeout` undefined: check once, no wait (a `waitFor` timeout of 0 means "no timeout").
    const onScreen = async (box, timeout) => {
        const target = locator.first();
        if (timeout === undefined) {
            if (!(await target.isVisible()))
                return false;
        }
        else {
            try {
                await target.waitFor({ state: 'visible', timeout });
            }
            catch {
                return false;
            }
        }
        const targetBox = await target.boundingBox();
        return !!targetBox && centerInside(targetBox, box);
    };
    let box = await area();
    if (await onScreen(box))
        return;
    for (let swipe = 1; swipe <= maxSwipes; swipe++) {
        const step = direction === 'up' || direction === 'down' ? box.height * 0.8 : box.width * 0.8;
        const sign = direction === 'down' || direction === 'right' ? 1 : -1;
        const vertical = direction === 'up' || direction === 'down';
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(vertical ? 0 : sign * step, vertical ? sign * step : 0);
        box = await area();
        if (await onScreen(box, settleTimeout))
            return;
    }
    throw new Error(`scrollUntilVisible: ${locator} is not on screen after ${maxSwipes} swipes ${direction}.`);
}
