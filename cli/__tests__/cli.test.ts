import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import pkg from '../../package.json'

const CLI_PATH = resolve(import.meta.dirname, '../../dist-cli/my-holiday.js')

describe('holiday CLI', () => {
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

  it('uses "holiday" as the program name in --help output', () => {
    const output = execFileSync(process.execPath, [CLI_PATH, '--help'], {
      encoding: 'utf8',
    })

    expect(output).toMatch(/Usage: holiday/)
  })
})

function help(...args: string[]): string {
  return execFileSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' })
}

describe('holiday per-command help', () => {
  it('shows a command\'s help via "--help <command>" (flag-first order)', () => {
    const output = help('--help', 'add')

    expect(output).toMatch(/Usage: holiday add --start/)
    expect(output).toContain('--type')
  })

  it('shows the same help via "<command> --help" and "help <command>"', () => {
    const flagFirst = help('add', '--help')
    const helpCmd = help('help', 'add')

    for (const output of [flagFirst, helpCmd]) {
      expect(output).toMatch(/Usage: holiday add --start/)
      expect(output).toContain('--type')
    }
  })

  it('includes the curated usage signature and an example in a command\'s help', () => {
    const output = help('add', '--help')

    expect(output).toContain('--start <YYYY-MM-DD>')
    expect(output).toContain('[--half-day]')
    expect(output.toLowerCase()).toContain('example')
  })

  it('shows global options in per-command help', () => {
    const output = help('calendar', '--help')

    expect(output).toContain('--month')
    expect(output).toContain('--json')
  })

  it('still prints the top-level overview for bare --help (no command)', () => {
    const output = help('--help')

    expect(output).toMatch(/Usage: holiday \[options\] \[command\]/)
    expect(output).toContain('calendar')
  })
})
