#!/usr/bin/env node
import { Command } from 'commander'
import { version } from '../package.json'

const program = new Command()

program
  .name('my-holiday')
  .description('Command-line interface for the my-holiday vacation planner')
  .version(version)
  .option('--api <url>', 'API base URL (default: $MY_HOLIDAY_API_URL or http://localhost:3001/api/v1)')
  .option('--token <token>', 'bearer token for the Authorization header (default: $MY_HOLIDAY_API_TOKEN)')
  .option('--json', 'emit machine-readable JSON', false)

program.command('list').description('List vacation periods for a year')
program.command('add').description('Add a vacation period')
program.command('remaining').description('Show remaining vacation entitlement')
program.command('export').description('Export periods as an ICS or CSV file')
program.command('migrate').description('Import vacation periods from a CSV file')

program.parse(process.argv)
