/**
 * Process exit codes for the CLI.
 *
 * 0 success · 1 user/usage error (bad args, validation) · 2 server/network error.
 */
export const EXIT = {
  OK: 0,
  USAGE: 1,
  SERVER: 2,
} as const
