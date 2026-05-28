#!/usr/bin/env node
import { Command, CommanderError } from 'commander'
import { version } from '../package.json'
import { createApiClient } from './api'
import { runAdd } from './commands/add'
import { runExport } from './commands/export'
import { runList } from './commands/list'
import { runMigrate } from './commands/migrate'
import { runRemaining } from './commands/remaining'
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
  program
    .command('add')
    .description('Add a vacation period')
    .option('--start <date>', 'start date (YYYY-MM-DD)')
    .option('--end <date>', 'end date (YYYY-MM-DD)')
    .option('--type <type>', 'vacation type (default: urlaub)')
    .option('--note <text>', 'note')
    .option('--half-day', 'count a single day as a half day', false)
    .action(async (options: { start?: string; end?: string; type?: string; note?: string; halfDay?: boolean }, command: Command) => {
      const globals = command.optsWithGlobals()
      const client = createApiClient({ api: globals.api, token: globals.token })
      const output = await runAdd(client, {
        start: options.start,
        end: options.end,
        type: options.type,
        note: options.note,
        halfDay: options.halfDay === true,
        json: globals.json === true,
      })
      process.stdout.write(`${output}\n`)
    })
  program
    .command('remaining')
    .description('Show remaining vacation entitlement')
    .option('--year <year>', 'calendar year (default: current year)', (value) => Number.parseInt(value, 10))
    .action(async (options: { year?: number }, command: Command) => {
      const globals = command.optsWithGlobals()
      const client = createApiClient({ api: globals.api, token: globals.token })
      const output = await runRemaining(client, { year: options.year, json: globals.json === true })
      process.stdout.write(`${output}\n`)
    })
  program
    .command('export')
    .description('Export periods as an ICS or CSV file')
    .option('--format <format>', 'ics or csv')
    .option('--year <year>', 'calendar year (default: current year)', (value) => Number.parseInt(value, 10))
    .option('--out <file>', 'write to a file instead of stdout')
    .action(async (options: { format?: string; year?: number; out?: string }, command: Command) => {
      const globals = command.optsWithGlobals()
      const client = createApiClient({ api: globals.api, token: globals.token })
      const output = await runExport(client, { format: options.format, year: options.year, out: options.out })
      process.stdout.write(`${output}\n`)
    })
  program
    .command('migrate')
    .description('Import vacation periods from a CSV file')
    .argument('[file]', 'path to the CSV file to import')
    .option('--dry-run', 'parse locally and report what would import, without sending', false)
    .action(async (file: string | undefined, options: { dryRun?: boolean }, command: Command) => {
      const globals = command.optsWithGlobals()
      const client = createApiClient({ api: globals.api, token: globals.token })
      const output = await runMigrate(client, { file, dryRun: options.dryRun === true })
      process.stdout.write(`${output}\n`)
    })

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
