import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import pkg from '../../package.json'

const CLI_PATH = resolve(import.meta.dirname, '../../dist-cli/my-holiday.js')

describe('my-holiday CLI', () => {
  it('prints the package.json version for --version', () => {
    const output = execFileSync(process.execPath, [CLI_PATH, '--version'], {
      encoding: 'utf8',
    })

    expect(output.trim()).toBe(pkg.version)
  })

  it('lists all subcommands in --help output', () => {
    const output = execFileSync(process.execPath, [CLI_PATH, '--help'], {
      encoding: 'utf8',
    })

    for (const command of ['list', 'add', 'remaining', 'export', 'migrate']) {
      expect(output).toContain(command)
    }
  })
})
