export interface LightpandaServerOptions {
    /**
     * Path of the `lightpanda` binary. Default: `LIGHTPANDA_EXECUTABLE_PATH`, else the folder that
     * `npx @lightpanda/browser install` writes to (`~/.cache/lightpanda-node/lightpanda`).
     */
    executablePath?: string;
    /** Extra `lightpanda serve` arguments, for example `['--load-resources', 'stylesheet']`. */
    args?: readonly string[];
    /** Time for the CDP server to answer. Default 10 s. */
    startTimeout?: number;
}
/** One `lightpanda serve` process. */
export interface LightpandaServer {
    /** The CDP WebSocket endpoint, for `chromium.connectOverCDP()`. */
    wsEndpoint: string;
    /** Stops the process. */
    close(): Promise<void>;
}
/** The binary that `launchLightpanda()` starts when `executablePath` is not set. */
export declare function lightpandaExecutablePath(options?: Pick<LightpandaServerOptions, 'executablePath'>): string;
/**
 * Starts `lightpanda serve` on a free local port and resolves when its CDP server answers.
 * `--cdp-allow-timezone-override` is always on, so the `timezoneId` of the Playwright context
 * applies (the kit pins `UTC`).
 */
export declare function launchLightpanda(options?: LightpandaServerOptions): Promise<LightpandaServer>;
//# sourceMappingURL=server.d.ts.map