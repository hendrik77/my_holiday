/** Output for a command: `output` goes to stdout, optional `warning` to stderr. */
export interface CommandResult {
  readonly output: string
  readonly warning?: string
}
