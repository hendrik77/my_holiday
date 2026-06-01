#!/usr/bin/env node
import { Command, CommanderError } from 'commander'
import { version } from '../package.json'
import { createApiClient } from './api'
import { runAdd } from './commands/add'
import { runCalendar } from './commands/calendar'
import { runChange } from './commands/change'
import { runCompletion } from './commands/completion'
import { runDelete } from './commands/delete'
import { runExport } from './commands/export'
import { runList } from './commands/list'
import { runMigrate } from './commands/migrate'
import { runRemaining } from './commands/remaining'
import { runToday } from './commands/today'
import { mapErrorToExit } from './errors'
import { EXIT } from './exit-codes'

function buildProgram(): Command {
  const program = new Command()

  program
    .name('holiday')
    .description('Command-line interface for the my-holiday vacation planner')
    .version(version)
    .option('--api <url>', 'API base URL (default: $MY_HOLIDAY_API_URL or http://localhost:3001/api/v1)')
    .option('--token <token>', 'bearer token for the Authorization header (default: $MY_HOLIDAY_API_TOKEN)')
    .option('--json', 'emit machine-readable JSON', false)
    .configureHelp({ showGlobalOptions: true })
    .exitOverride()

  program
    .command('list')
    .description('List vacation periods for a year')
    .usage('[--year <year>]')
    .addHelpText('after', '\nExample:\n  holiday list --year 2026')
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
    .usage('--start <YYYY-MM-DD> [--end <YYYY-MM-DD>] [--type <type>] [--note <text>] [--half-day]')
    .addHelpText('after', '\nExamples:\n  holiday add --start 2026-07-01 --end 2026-07-15 --type urlaub --note "Sommerurlaub"\n  holiday add --start 2026-10-14            # single day\n  holiday add --start 2026-10-14 --half-day # single half day')
    .option('--start <date>', 'start date (YYYY-MM-DD)')
    .option('--end <date>', 'end date (YYYY-MM-DD); defaults to --start (single day)')
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
    .command('change')
    .description('Update an existing vacation period')
    .usage('<id> [--start <YYYY-MM-DD>] [--end <YYYY-MM-DD>] [--type <type>] [--note <text>] [--half-day|--no-half-day]')
    .addHelpText('after', '\nExample:\n  holiday change 3f9a2c1 --end 2026-07-20 --note "verlängert"   # id (or unique prefix) from `holiday list`')
    .argument('<id>', 'period id or unique prefix (from `holiday list`)')
    .option('--start <date>', 'new start date (YYYY-MM-DD)')
    .option('--end <date>', 'new end date (YYYY-MM-DD)')
    .option('--type <type>', 'new vacation type')
    .option('--note <text>', 'new note (use --note "" to clear)')
    .option('--half-day', 'mark as a half day')
    .option('--no-half-day', 'clear the half-day flag')
    .action(async (id: string, options: { start?: string; end?: string; type?: string; note?: string; halfDay?: boolean }, command: Command) => {
      const globals = command.optsWithGlobals()
      const client = createApiClient({ api: globals.api, token: globals.token })
      const halfDay = command.getOptionValueSource('halfDay') === 'cli' ? options.halfDay === true : undefined
      const output = await runChange(client, {
        id,
        start: options.start,
        end: options.end,
        type: options.type,
        note: options.note,
        halfDay,
        json: globals.json === true,
      })
      process.stdout.write(`${output}\n`)
    })
  program
    .command('delete')
    .description('Delete a vacation period')
    .usage('<id>')
    .addHelpText('after', '\nExample:\n  holiday delete 3f9a2c1   # id (or unique prefix) from `holiday list`')
    .argument('<id>', 'period id or unique prefix (from `holiday list`)')
    .action(async (id: string, _options: Record<string, never>, command: Command) => {
      const globals = command.optsWithGlobals()
      const client = createApiClient({ api: globals.api, token: globals.token })
      const output = await runDelete(client, { id, json: globals.json === true })
      process.stdout.write(`${output}\n`)
    })
  program
    .command('remaining')
    .description('Show remaining vacation entitlement')
    .usage('[--year <year>]')
    .addHelpText('after', '\nExample:\n  holiday remaining --year 2026')
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
    .usage('--format <ics|csv> [--year <year>] [--out <file>] [--bom]')
    .addHelpText('after', '\nExample:\n  holiday export --format ics --year 2026 --out urlaub-2026.ics')
    .option('--format <format>', 'ics or csv')
    .option('--year <year>', 'calendar year (default: current year)', (value) => Number.parseInt(value, 10))
    .option('--out <file>', 'write to a file instead of stdout')
    .option('--bom', 'prepend a UTF-8 BOM to CSV output (for Excel)', false)
    .action(async (options: { format?: string; year?: number; out?: string; bom?: boolean }, command: Command) => {
      const globals = command.optsWithGlobals()
      const client = createApiClient({ api: globals.api, token: globals.token })
      const output = await runExport(client, {
        format: options.format,
        year: options.year,
        out: options.out,
        bom: options.bom === true,
      })
      process.stdout.write(`${output}\n`)
    })
  program
    .command('migrate')
    .description('Import vacation periods from a CSV file')
    .usage('[file] [--dry-run]')
    .addHelpText('after', '\nExample:\n  holiday migrate ./urlaub-2026.csv --dry-run')
    .argument('[file]', 'path to the CSV file to import')
    .option('--dry-run', 'parse locally and report what would import, without sending', false)
    .action(async (file: string | undefined, options: { dryRun?: boolean }, command: Command) => {
      const globals = command.optsWithGlobals()
      const client = createApiClient({ api: globals.api, token: globals.token })
      const { output, ok } = await runMigrate(client, { file, dryRun: options.dryRun === true, json: globals.json === true })
      process.stdout.write(`${output}\n`)
      if (!ok) {
        process.exitCode = EXIT.USAGE
      }
    })
  program
    .command('today')
    .description('Show a one-line vacation status: remaining days and the next/active period')
    .addHelpText('after', '\nExample:\n  holiday today')
    .action(async (_options: Record<string, never>, command: Command) => {
      const globals = command.optsWithGlobals()
      const client = createApiClient({ api: globals.api, token: globals.token })
      const output = await runToday(client, { json: globals.json === true })
      process.stdout.write(`${output}\n`)
    })
  program
    .command('calendar')
    .description('Show a terminal calendar for a year, shading vacation, holidays and weekends')
    .usage('[--year <year>] [--month <1-12>] [--no-color]')
    .addHelpText('after', '\nExample:\n  holiday calendar --year 2026 --month 7')
    .option('--year <year>', 'calendar year (default: current year)', (value) => Number.parseInt(value, 10))
    .option('--month <month>', 'show a single month (1-12) instead of the full year', (value) => Number.parseInt(value, 10))
    .option('--no-color', 'disable ANSI colors (also respects NO_COLOR and non-TTY output)')
    .action(async (options: { year?: number; month?: number; color?: boolean }, command: Command) => {
      const globals = command.optsWithGlobals()
      const client = createApiClient({ api: globals.api, token: globals.token })
      const color = options.color !== false && process.stdout.isTTY === true && !process.env.NO_COLOR
      const output = await runCalendar(client, { year: options.year, month: options.month, color })
      process.stdout.write(`${output}\n`)
    })
  program
    .command('completion')
    .description('Print a shell completion script (bash, zsh, or fish)')
    .usage('<bash|zsh|fish>')
    .addHelpText('after', '\nExample:\n  holiday completion zsh')
    .argument('<shell>', 'bash, zsh, or fish')
    .action((shell: string) => {
      process.stdout.write(runCompletion(shell))
    })

  return program
}

/**
 * Allow `holiday --help <command>` (and `-h <command>`) by rewriting it to the
 * canonical `holiday <command> --help`. Commander treats `--help` as a root flag
 * otherwise and ignores the trailing command. `holiday <command> --help` and
 * `holiday help <command>` already work and are left untouched.
 */
function normalizeHelpArgs(argv: string[], program: Command): string[] {
  const names = new Set(program.commands.map((c) => c.name()).filter((n) => n !== 'help'))
  const rest = argv.slice(2)
  const wantsHelp = rest.includes('--help') || rest.includes('-h')
  const command = rest.find((token) => names.has(token))
  if (wantsHelp && command) {
    return [argv[0], argv[1], command, '--help']
  }
  return argv
}

async function main(argv: string[]): Promise<number> {
  const program = buildProgram()

  try {
    await program.parseAsync(normalizeHelpArgs(argv, program))
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
  if (!process.exitCode) {
    process.exitCode = code
  }
})
