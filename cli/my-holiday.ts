#!/usr/bin/env node
import { Command } from 'commander'
import { version } from '../package.json'

const DEFAULT_API_URL = 'http://localhost:3001/api/v1'

const program = new Command()

program
  .name('my-holiday')
  .description('Command-line interface for the my-holiday vacation planner')
  .version(version)
  .option('--api <url>', 'base URL of the my-holiday API', process.env.MY_HOLIDAY_API_URL ?? DEFAULT_API_URL)
  .option('--token <token>', 'bearer token sent as the Authorization header', process.env.MY_HOLIDAY_API_TOKEN)
  .option('--json', 'emit machine-readable JSON', false)

program.command('list').description('List vacation periods for a year')
program.command('add').description('Add a vacation period')
program.command('remaining').description('Show remaining vacation entitlement')
program.command('export').description('Export periods as an ICS or CSV file')
program.command('migrate').description('Import vacation periods from a CSV file')

program.parse(process.argv)
