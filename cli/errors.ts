import { ApiError } from './api'
import { EXIT } from './exit-codes'

/**
 * A user-facing usage error: bad arguments, failed validation, unknown option.
 * Commands throw this when the request never should have been made. Maps to exit 1.
 */
export class UsageError extends Error {
  /**
   * Optional machine-readable payload. When set, the entrypoint emits this
   * (instead of the `{ error }` envelope) under `--json`, so commands like
   * `migrate` can return structured results even on a non-zero exit.
   */
  readonly json?: unknown

  constructor(message: string, json?: unknown) {
    super(message)
    this.name = 'UsageError'
    this.json = json
  }
}

export interface ExitResult {
  readonly code: number
  readonly message: string
}

/**
 * Pure mapping from a thrown value to an exit code and human-readable message.
 *
 * - `UsageError` → exit 1 (the user gave us bad input)
 * - `ApiError` → exit 2 (the server answered with a non-2xx / unusable response)
 * - network `TypeError` → exit 2 (`fetch` rejects with a TypeError on DNS/connection failure)
 * - anything else → exit 1 (unexpected; treated as a usage-level failure)
 */
export function mapErrorToExit(err: unknown): ExitResult {
  if (err instanceof UsageError) {
    return { code: EXIT.USAGE, message: err.message }
  }
  if (err instanceof ApiError) {
    return { code: EXIT.SERVER, message: err.message }
  }
  if (err instanceof TypeError) {
    return { code: EXIT.SERVER, message: `network error: ${err.message}` }
  }
  const message = err instanceof Error ? err.message : String(err)
  return { code: EXIT.USAGE, message }
}
