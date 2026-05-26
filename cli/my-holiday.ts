#!/usr/bin/env node
import { version } from '../package.json'

function run(argv: readonly string[]): number {
  const args = argv.slice(2)

  if (args.includes('--version') || args.includes('-V')) {
    process.stdout.write(`${version}\n`)
    return 0
  }

  process.stdout.write('my-holiday CLI\n')
  return 0
}

process.exit(run(process.argv))
