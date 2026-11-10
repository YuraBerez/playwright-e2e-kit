#!/usr/bin/env node
// Installs and builds one fixture app (test/fixtures-apps/<app>) and prints nothing else on
// success. The fixture apps keep their own dependencies: the kit's root package never needs them.
// Usage: node e2e/prepare-app.mjs <react|vue|angular|flutter|compose>
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const APPS = {
  react: { dir: 'test/fixtures-apps/react', out: 'test/fixtures-apps/react/dist' },
  vue: { dir: 'test/fixtures-apps/vue', out: 'test/fixtures-apps/vue/dist' },
  angular: { dir: 'test/fixtures-apps/angular', out: 'test/fixtures-apps/angular/dist/angular/browser' },
  flutter: { dir: 'test/fixtures-apps/flutter', out: 'test/fixtures-apps/flutter/build/web' },
  compose: { dir: 'test/fixtures-apps/compose', out: 'test/fixtures-apps/compose/build/dist/wasmJs/productionExecutable' },
}

function run(cmd, args, cwd) {
  // NG_CLI_ANALYTICS: the Angular CLI must not ask about analytics in CI.
  execFileSync(cmd, args, { cwd, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, NG_CLI_ANALYTICS: 'false' } })
}

function prepare(name) {
  const app = APPS[name]
  if (!app) throw new Error(`Unknown fixture app "${name}". Use one of: ${Object.keys(APPS).join(', ')}.`)
  const cwd = fileURLToPath(new URL(`../${app.dir}`, import.meta.url))
  if (name === 'flutter') {
    run('flutter', ['pub', 'get'], cwd)
    // Bundle CanvasKit locally: the run does not depend on the CDN.
    run('flutter', ['build', 'web', '--release', '--no-web-resources-cdn'], cwd)
    return
  }
  if (name === 'compose') {
    // Gradle wrapper (pinned Gradle) and a JDK 21 (JAVA_HOME). Kotlin downloads its own Node.js
    // and Binaryen for the wasm build.
    run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['wasmJsBrowserDistribution', '--console=plain', '-q'], cwd)
    return
  }
  if (!existsSync(`${cwd}/node_modules`)) run('npm', ['ci', '--no-audit', '--no-fund'], cwd)
  run('npm', ['run', 'build'], cwd)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  prepare(process.argv[2])
}
