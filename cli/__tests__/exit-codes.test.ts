// @vitest-environment node
import { execFile } from 'node:child_process'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const CLI_PATH = resolve(import.meta.dirname, '../../dist-cli/my-holiday.js')

interface CliResult {
  code: number
  stdout: string
  stderr: string
}

/** Run the built CLI as a subprocess and capture exit code + streams. */
function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolvePromise) => {
    execFile(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' }, (error, stdout, stderr) => {
      const code = error && typeof error.code === 'number' ? error.code : 0
      resolvePromise({ code, stdout, stderr })
    })
  })
}

interface TestServer {
  url: string
  close: () => Promise<void>
}

function startServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<TestServer> {
  return new Promise((resolvePromise) => {
    const server: Server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolvePromise({
        url: `http://127.0.0.1:${port}/api/v1`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      })
    })
  })
}

describe('CLI exit codes (built binary)', () => {
  let successUrl: string
  let errorUrl: string
  let deadUrl: string
  const open: TestServer[] = []

  beforeAll(async () => {
    const ok = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('[]')
    })
    successUrl = ok.url
    open.push(ok)

    const err = await startServer((_req, res) => {
      res.writeHead(500)
      res.end('boom')
    })
    errorUrl = err.url
    open.push(err)

    // Claim a port, then release it — connecting to it now refuses (network failure).
    const dead = await startServer(() => {})
    deadUrl = dead.url
    await dead.close()
  })

  afterAll(async () => {
    for (const server of open) await server.close()
  })

  it('exits 0 on success', async () => {
    const { code } = await runCli(['list', '--api', successUrl])
    expect(code).toBe(0)
  })

  it('exits 2 on a server 500', async () => {
    const { code } = await runCli(['list', '--api', errorUrl])
    expect(code).toBe(2)
  })

  it('exits 2 with a "network" message on an unreachable API', async () => {
    const { code, stderr } = await runCli(['list', '--api', deadUrl])
    expect(code).toBe(2)
    expect(stderr).toMatch(/network/i)
  })

  it('exits 1 on a validation error (add with a bad date)', async () => {
    const { code } = await runCli(['add', '--start', 'nope', '--end', '2026-01-02', '--api', successUrl])
    expect(code).toBe(1)
  })

  it('prints errors to stdout as JSON with --json', async () => {
    const { code, stdout } = await runCli(['list', '--json', '--api', deadUrl])
    expect(code).toBe(2)
    const parsed = JSON.parse(stdout.trim()) as { error?: { code: number; message: string } }
    expect(parsed.error).toBeDefined()
    expect(parsed.error?.code).toBe(2)
  })
})
