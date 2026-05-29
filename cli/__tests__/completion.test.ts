// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { VACATION_TYPES } from '../../src/types'
import { runCompletion } from '../commands/completion'
import { UsageError } from '../errors'

describe('runCompletion', () => {
  it('emits a bash completion script wired to the holiday command', () => {
    const script = runCompletion('bash')

    expect(script).toContain('complete -F _holiday holiday')
    expect(script).toContain('calendar')
    expect(script).toContain('--type')
  })

  it('emits a zsh completion script with a #compdef header', () => {
    const script = runCompletion('zsh')

    expect(script).toMatch(/^#compdef holiday/m)
    expect(script).toContain('today')
  })

  it('emits a fish completion script using complete -c holiday', () => {
    const script = runCompletion('fish')

    expect(script).toContain('complete -c holiday')
    expect(script).toContain('completion')
  })

  it('lists every vacation type so --type tab-completes', () => {
    for (const shell of ['bash', 'zsh', 'fish'] as const) {
      const script = runCompletion(shell)
      for (const type of VACATION_TYPES) {
        expect(script).toContain(type)
      }
    }
  })

  it('throws a UsageError for an unsupported shell', () => {
    expect(() => runCompletion('powershell')).toThrow(UsageError)
  })
})
