/**
 * Known Compose Multiplatform web (wasmJs) noise for the error guard. Opt-in: import it from
 * `playwright-e2e-kit/compose` and pass it as `errorGuardFixture({ allow: composeErrorAllowList })`.
 * Each entry is narrow (one kind, one message) and carries its reason. It never hides an app-origin
 * failure.
 */
export const composeErrorAllowList = [
    {
        kind: 'console',
        message: /^WebGL: INVALID_ENUM: getParameter: invalid parameter name, WEBGL_debug_renderer_info not enabled$/,
        reason: 'Skiko (the Compose canvas renderer) reads the GPU name through WEBGL_debug_renderer_info at start-up. WebKit logs this as a console error when the extension is off; Chromium logs it as a warning. Rendering is not affected.',
    },
];
//# sourceMappingURL=allow-list.js.map