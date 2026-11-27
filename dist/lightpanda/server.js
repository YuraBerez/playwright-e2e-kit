import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
const KILL_AFTER_MS = 5_000;
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
/** True when the CDP server on `port` answers and is a Lightpanda (not another process on the port). */
async function isLightpanda(port) {
    try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1_000) });
        if (!response.ok)
            return false;
        const version = (await response.json());
        return 'Lightpanda-Version' in version || String(version.Browser).startsWith('Lightpanda');
    }
    catch {
        return false;
    }
}
/**
 * Starts `lightpanda serve` on a free local port and resolves when its CDP server answers.
 * `--cdp-allow-timezone-override` is always on, so the `timezoneId` of the Playwright context
 * applies (the kit pins `UTC`). The process is killed when the worker process exits, also when
 * Playwright stops the worker without its teardown.
 */
export async function launchLightpanda(options = {}) {
    const executable = lightpandaExecutablePath(options);
    if (!existsSync(executable)) {
        throw new Error(`lightpanda binary not found at ${executable}. Run \`npx @lightpanda/browser install\` or set LIGHTPANDA_EXECUTABLE_PATH.`);
    }
    const port = await freePort();
    const child = spawn(executable, ['serve', '--host', '127.0.0.1', '--port', String(port), '--cdp-allow-timezone-override', ...(options.args ?? [])], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
        // Keep the tail only: enough for a start failure, bounded for a long worker.
        stderr = (stderr + chunk).slice(-4000);
    });
    // `error`: the binary cannot start (for example EACCES); `exit` does not come then.
    let failure;
    let ended = false;
    const exited = new Promise((resolve) => {
        child.once('error', (error) => {
            failure = `lightpanda could not start ${executable}: ${error.message}`;
            ended = true;
            resolve();
        });
        child.once('exit', (code, signal) => {
            failure ??= `lightpanda exited with ${code !== null ? `code ${code}` : `signal ${signal}`}.`;
            ended = true;
            resolve();
        });
    });
    const killOnExit = () => {
        if (!ended)
            child.kill('SIGKILL');
    };
    process.once('exit', killOnExit);
    const close = async () => {
        if (!ended) {
            child.kill('SIGTERM');
            const timer = setTimeout(() => child.kill('SIGKILL'), KILL_AFTER_MS);
            await exited;
            clearTimeout(timer);
        }
        process.removeListener('exit', killOnExit);
    };
    const timeout = options.startTimeout ?? 10_000;
    const deadline = Date.now() + timeout;
    while (!(await isLightpanda(port))) {
        const error = ended ? `${failure}\n${stderr}` : Date.now() > deadline ? `lightpanda did not answer on port ${port} in ${timeout} ms.\n${stderr}` : undefined;
        if (error) {
            await close();
            throw new Error(error.trimEnd());
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return { wsEndpoint: `ws://127.0.0.1:${port}`, close };
}
//# sourceMappingURL=server.js.map