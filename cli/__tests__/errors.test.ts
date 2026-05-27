// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api'
import { UsageError, mapErrorToExit } from '../errors'
import { EXIT } from '../exit-codes'

describe('mapErrorToExit', () => {
  it('maps a UsageError to the user-error exit code', () => {
    const result = mapErrorToExit(new UsageError('bad date'))

    expect(result.code).toBe(EXIT.USAGE)
    expect(result.message).toBe('bad date')
  })

  it('maps an ApiError to the server-error exit code', () => {
    const result = mapErrorToExit(new ApiError(500, 'boom', 'failed with status 500'))

    expect(result.code).toBe(EXIT.SERVER)
  })

  it('maps a network TypeError to the server-error exit code with a network message', () => {
    const result = mapErrorToExit(new TypeError('fetch failed'))

    expect(result.code).toBe(EXIT.SERVER)
    expect(result.message).toContain('network')
  })

  it('maps an unknown error to the user-error exit code', () => {
    const result = mapErrorToExit(new Error('unexpected'))

    expect(result.code).toBe(EXIT.USAGE)
    expect(result.message).toBe('unexpected')
  })
})
