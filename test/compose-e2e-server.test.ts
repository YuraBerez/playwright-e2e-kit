import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Runs the static server that .github/workflows/compose-e2e.yml writes with a heredoc, exactly as
// the workflow has it, so the template cannot drift from what is tested.
const WORKFLOW = readFileSync(join(import.meta.dirname, '..', '.github', 'workflows', 'compose-e2e.yml'), 'utf8')
const HEREDOC = /cat > "\$RUNNER_TEMP\/serve-compose\.mjs" <<'EOF'\n([\s\S]*?)\n\s*EOF\n/.exec(WORKFLOW)
if (!HEREDOC) throw new Error('compose-e2e.yml: the serve-compose.mjs heredoc is missing')
const SCRIPT = HEREDOC[1]!.replace(/^ {10}/gm, '')

const tmp = mkdtempSync(join(tmpdir(), 'compose-e2e-server-'))
const serverFile = join(tmp, 'serve-compose.mjs')
const dist = join(tmp, 'dist')

const freePort = () =>
  new Promise<number>((done) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as AddressInfo
      s.close(() => done(port))
    })
  })

/** Starts the server and waits for its ready file. */
async function start(base: string): Promise<{ child: ChildProcess; url: string }> {
  const port = await freePort()
  const ready = join(tmp, `ready-${port}`)
  const child = spawn(process.execPath, [serverFile, dist, String(port), base, ready], { stdio: 'ignore' })
  for (let i = 0; i < 100 && !existsSync(ready); i++) await new Promise((r) => setTimeout(r, 50))
  expect(existsSync(ready)).toBe(true)
  return { child, url: `http://localhost:${port}` }
}

describe('compose-e2e.yml static server', () => {
  const children: ChildProcess[] = []
  beforeAll(() => {
    writeFileSync(serverFile, SCRIPT)
    mkdirSync(join(dist, 'sub'), { recursive: true })
    writeFileSync(join(dist, 'index.html'), '<html>app</html>')
    writeFileSync(join(dist, 'app.wasm'), 'wasm')
    writeFileSync(join(dist, 'sub', 'index.html'), '<html>sub</html>')
    writeFileSync(join(tmp, 'secret.txt'), 'secret')
  })
  afterAll(() => {
    for (const c of children) c.kill()
    rmSync(tmp, { recursive: true, force: true })
  })

  it('serves files under the base path with their MIME type, and 404 outside it', async () => {
    const s = await start('/app/')
    children.push(s.child)
    const wasm = await fetch(`${s.url}/app/app.wasm`)
    expect([wasm.status, wasm.headers.get('content-type')]).toEqual([200, 'application/wasm'])
    expect(await (await fetch(`${s.url}/app/`)).text()).toBe('<html>app</html>')
    expect(await (await fetch(`${s.url}/app`)).text()).toBe('<html>app</html>')
    expect(await (await fetch(`${s.url}/app/sub/`)).text()).toBe('<html>sub</html>')
    expect((await fetch(`${s.url}/other/app.wasm`)).status).toBe(404)
  })

  it('falls back to index.html for navigations only; a missing asset is a 404', async () => {
    const s = await start('/')
    children.push(s.child)
    const nav = await fetch(`${s.url}/settings/profile`)
    expect([nav.status, await nav.text()]).toEqual([200, '<html>app</html>'])
    const htmlAccept = await fetch(`${s.url}/page.php`, { headers: { accept: 'text/html,*/*' } })
    expect(htmlAccept.status).toBe(200)
    for (const asset of ['missing.wasm', 'missing.js', 'missing.css']) expect((await fetch(`${s.url}/${asset}`)).status, asset).toBe(404)
  })

  it('rejects a path outside the root (also a sibling with the same prefix) and a bad escape', async () => {
    const s = await start('/')
    children.push(s.child)
    expect((await fetch(`${s.url}/..%2Fsecret.txt`)).status).toBe(403)
    expect((await fetch(`${s.url}/..%2Fdist-other%2Fx.js`)).status).toBe(403)
    expect((await fetch(`${s.url}/%E0%A4%A`)).status).toBe(400)
  })

  it('exits with a clear error when the port is taken', async () => {
    const port = await freePort()
    const blocker = createServer().listen(port)
    await new Promise((r) => blocker.once('listening', r))
    try {
      const child = spawn(process.execPath, [serverFile, dist, String(port), '/', join(tmp, 'never')], { stdio: ['ignore', 'pipe', 'pipe'] })
      let stderr = ''
      child.stderr!.on('data', (d: Buffer) => (stderr += d.toString()))
      const code = await new Promise((r) => child.on('exit', r))
      expect(code).toBe(1)
      expect(stderr).toMatch(new RegExp(`::error::The static server did not start: port ${port} is already in use`))
      expect(existsSync(join(tmp, 'never'))).toBe(false)
    } finally {
      blocker.close()
    }
  })
})
