import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
/** The binary that `launchLightpanda()` starts when `executablePath` is not set. */
export function lightpandaExecutablePath(options = {}) {
    return options.executablePath ?? process.env.LIGHTPANDA_EXECUTABLE_PATH ?? join(homedir(), '.cache', 'lightpanda-node', 'lightpanda');
}
function freePort() {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port'))));
        });
    });
}
async function waitForCdp(port, child, stderr, timeout) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (child.exitCode !== null)
            throw new Error(`lightpanda exited with code ${child.exitCode}.\n${stderr()}`);
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (response.ok)
                return;
        }
        catch {
            // Not listening yet.
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`lightpanda did not answer on port ${port} in ${timeout} ms.\n${stderr()}`);
}
/**
 * Starts `lightpanda serve` on a free local port and resolves when its CDP server answers.
 * `--cdp-allow-timezone-override` is always on, so the `timezoneId` of the Playwright context
 * applies (the kit pins `UTC`).
 */
export async function launchLightpanda(options = {}) {
    const executable = lightpandaExecutablePath(options);
    if (!existsSync(executable)) {
        throw new Error(`lightpanda binary not found at ${executable}. Run \`npx @lightpanda/browser install\` or set LIGHTPANDA_EXECUTABLE_PATH.`);
    }
    const port = await freePort();
    const child = spawn(executable, ['serve', '--host', '127.0.0.1', '--port', String(port), '--cdp-allow-timezone-override', ...(options.args ?? [])], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.setEncoding('utf8').on('data', (chunk) => {
        // Keep the tail only: enough for a start failure, bounded for a long worker.
        stderr = (stderr + chunk).slice(-4000);
    });
    const exited = new Promise((resolve) => child.once('exit', () => resolve()));
    const close = async () => {
        if (child.exitCode === null && child.signalCode === null)
            child.kill();
        await exited;
    };
    try {
        await waitForCdp(port, child, () => stderr, options.startTimeout ?? 10_000);
    }
    catch (error) {
        await close();
        throw error;
    }
    return { wsEndpoint: `ws://127.0.0.1:${port}`, close };
}
//# sourceMappingURL=server.js.map