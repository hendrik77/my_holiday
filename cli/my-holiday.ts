#!/usr/bin/env node
import { Command, CommanderError } from 'commander'
import { version } from '../package.json'
import { createApiClient } from './api'
import { runList } from './commands/list'
import { mapErrorToExit } from './errors'
import { EXIT } from './exit-codes'

function buildProgram(): Command {
  const program = new Command()

  program
    .name('my-holiday')
    .description('Command-line interface for the my-holiday vacation planner')
    .version(version)
    .option('--api <url>', 'API base URL (default: $MY_HOLIDAY_API_URL or http://localhost:3001/api/v1)')
    .option('--token <token>', 'bearer token for the Authorization header (default: $MY_HOLIDAY_API_TOKEN)')
    .option('--json', 'emit machine-readable JSON', false)
    .exitOverride()

  program
    .command('list')
    .description('List vacation periods for a year')
    .option('--year <year>', 'filter to a calendar year', (value) => Number.parseInt(value, 10))
    .action(async (options: { year?: number }, command: Command) => {
      const globals = command.optsWithGlobals()
      const client = createApiClient({ api: globals.api, token: globals.token })
      const output = await runList(client, { year: options.year, json: globals.json === true })
      process.stdout.write(`${output}\n`)
    })
  program.command('add').description('Add a vacation period')
  program.command('remaining').description('Show remaining vacation entitlement')
  program.command('export').description('Export periods as an ICS or CSV file')
  program.command('migrate').description('Import vacation periods from a CSV file')

  return program
}

async function main(argv: string[]): Promise<number> {
  const program = buildProgram()

  try {
    await program.parseAsync(argv)
    return EXIT.OK
  } catch (err) {
    // commander threw on its own terms: --help / --version exit 0, usage errors exit 1.
    if (err instanceof CommanderError) {
      return err.exitCode === 0 ? EXIT.OK : EXIT.USAGE
    }

    const { code, message } = mapErrorToExit(err)
    if (program.opts().json === true) {
      process.stdout.write(`${JSON.stringify({ error: { code, message } })}\n`)
    } else {
      process.stderr.write(`${message}\n`)
    }
    return code
  }
}

main(process.argv).then((code) => {
  process.exitCode = code
})
