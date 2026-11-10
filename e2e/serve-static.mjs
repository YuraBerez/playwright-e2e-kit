#!/usr/bin/env node
// Minimal static file server for the fixture apps (no dependencies). Unknown paths fall back to
// index.html, as a single-page app host does.
// Usage: node e2e/serve-static.mjs <dir> <port>
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const [dirArg, portArg] = process.argv.slice(2)
if (!dirArg || !portArg) {
  console.error('Usage: node e2e/serve-static.mjs <dir> <port>')
  process.exit(2)
}
const root = resolve(dirArg)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.frag': 'text/plain; charset=utf-8',
  '.bin': 'application/octet-stream',
}

createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  let file = normalize(join(root, urlPath))
  if (!file.startsWith(root)) {
    res.writeHead(403).end()
    return
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const index = join(file, 'index.html')
    file = existsSync(index) ? index : join(root, 'index.html')
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
  createReadStream(file).pipe(res)
}).listen(Number(portArg), () => console.log(`serving ${root} on http://localhost:${portArg}`))
