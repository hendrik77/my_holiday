import { VACATION_TYPES } from '../../src/types'
import { UsageError } from '../errors'

/** Shells we can emit a completion script for. */
export const COMPLETION_SHELLS = ['bash', 'zsh', 'fish'] as const
export type CompletionShell = (typeof COMPLETION_SHELLS)[number]

const TYPES = VACATION_TYPES.join(' ')

function bashScript(): string {
  return `# holiday bash completion. Install:  holiday completion bash > /etc/bash_completion.d/holiday
_holiday() {
  local cur prev cmd i
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  local commands="list add change delete remaining export migrate calendar today completion help"
  local global="--api --token --json --help --version"

  case "$prev" in
    --type) COMPREPLY=( $(compgen -W "${TYPES}" -- "$cur") ); return ;;
    --format) COMPREPLY=( $(compgen -W "ics csv" -- "$cur") ); return ;;
    completion) COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") ); return ;;
  esac

  cmd=""
  for (( i=1; i < COMP_CWORD; i++ )); do
    case "\${COMP_WORDS[i]}" in
      -*) ;;
      *) cmd="\${COMP_WORDS[i]}"; break ;;
    esac
  done

  if [ -z "$cmd" ]; then
    COMPREPLY=( $(compgen -W "$commands $global" -- "$cur") )
    return
  fi

  local opts="$global"
  case "$cmd" in
    list) opts="$opts --year" ;;
    add) opts="$opts --start --end --type --note --half-day" ;;
    change) opts="$opts --start --end --type --note --half-day --no-half-day" ;;
    remaining) opts="$opts --year" ;;
    export) opts="$opts --format --year --out --bom" ;;
    migrate) opts="$opts --dry-run" ;;
    calendar) opts="$opts --year --month --no-color" ;;
  esac
  COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
}
complete -F _holiday holiday
`
}

function zshScript(): string {
  return `#compdef holiday
# holiday zsh completion. Install: mkdir -p "\${fpath[1]}" && holiday completion zsh > "\${fpath[1]}/_holiday"
_holiday() {
  local -a commands
  commands=(
    'list:List vacation periods for a year'
    'add:Add a vacation period'
    'change:Update an existing vacation period'
    'delete:Delete a vacation period'
    'remaining:Show remaining vacation entitlement'
    'export:Export periods as an ICS or CSV file'
    'migrate:Import vacation periods from a CSV file'
    'calendar:Show a terminal calendar for a year'
    'today:Show a one-line vacation status'
    'completion:Print a shell completion script'
  )

  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi

  case "\${words[2]}" in
    add) _arguments '--start=[start date YYYY-MM-DD]' '--end=[end date YYYY-MM-DD]' \\
      '--type=[vacation type]:type:(${TYPES})' '--note=[note]' '--half-day[count a single day as a half day]' ;;
    change) _arguments '--start=[new start date]' '--end=[new end date]' \\
      '--type=[vacation type]:type:(${TYPES})' '--note=[new note]' '--half-day[mark as a half day]' '--no-half-day[clear the half-day flag]' ;;
    export) _arguments '--format=[output format]:format:(ics csv)' '--year=[calendar year]' \\
      '--out=[write to file]:file:_files' '--bom[prepend a UTF-8 BOM]' ;;
    calendar) _arguments '--year=[calendar year]' '--month=[month 1-12]' '--no-color[disable ANSI colors]' ;;
    list|remaining) _arguments '--year=[calendar year]' ;;
    migrate) _arguments '--dry-run[parse locally without sending]' ':file:_files' ;;
    completion) _arguments ':shell:(bash zsh fish)' ;;
  esac
}
_holiday "$@"
`
}

function fishScript(): string {
  return `# holiday fish completion. Install: holiday completion fish > ~/.config/fish/completions/holiday.fish
complete -c holiday -f

# Subcommands
complete -c holiday -n __fish_use_subcommand -a list -d 'List vacation periods for a year'
complete -c holiday -n __fish_use_subcommand -a add -d 'Add a vacation period'
complete -c holiday -n __fish_use_subcommand -a change -d 'Update an existing vacation period'
complete -c holiday -n __fish_use_subcommand -a delete -d 'Delete a vacation period'
complete -c holiday -n __fish_use_subcommand -a remaining -d 'Show remaining vacation entitlement'
complete -c holiday -n __fish_use_subcommand -a export -d 'Export periods as an ICS or CSV file'
complete -c holiday -n __fish_use_subcommand -a migrate -d 'Import vacation periods from a CSV file'
complete -c holiday -n __fish_use_subcommand -a calendar -d 'Show a terminal calendar for a year'
complete -c holiday -n __fish_use_subcommand -a today -d 'Show a one-line vacation status'
complete -c holiday -n __fish_use_subcommand -a completion -d 'Print a shell completion script'

# Global options
complete -c holiday -l api -d 'API base URL'
complete -c holiday -l token -d 'Bearer token'
complete -c holiday -l json -d 'Emit machine-readable JSON'
complete -c holiday -l help -d 'Show help'
complete -c holiday -l version -d 'Show version'

# Per-command options
complete -c holiday -n '__fish_seen_subcommand_from list remaining calendar export' -l year -d 'Calendar year'
complete -c holiday -n '__fish_seen_subcommand_from add' -l start -d 'Start date YYYY-MM-DD'
complete -c holiday -n '__fish_seen_subcommand_from add' -l end -d 'End date YYYY-MM-DD'
complete -c holiday -n '__fish_seen_subcommand_from add' -l type -d 'Vacation type' -a '${TYPES}'
complete -c holiday -n '__fish_seen_subcommand_from add' -l note -d 'Note'
complete -c holiday -n '__fish_seen_subcommand_from add' -l half-day -d 'Count a single day as a half day'
complete -c holiday -n '__fish_seen_subcommand_from change' -l start -d 'New start date YYYY-MM-DD'
complete -c holiday -n '__fish_seen_subcommand_from change' -l end -d 'New end date YYYY-MM-DD'
complete -c holiday -n '__fish_seen_subcommand_from change' -l type -d 'Vacation type' -a '${TYPES}'
complete -c holiday -n '__fish_seen_subcommand_from change' -l note -d 'New note'
complete -c holiday -n '__fish_seen_subcommand_from change' -l half-day -d 'Mark as a half day'
complete -c holiday -n '__fish_seen_subcommand_from change' -l no-half-day -d 'Clear the half-day flag'
complete -c holiday -n '__fish_seen_subcommand_from export' -l format -d 'Output format' -a 'ics csv'
complete -c holiday -n '__fish_seen_subcommand_from export' -l out -d 'Write to a file'
complete -c holiday -n '__fish_seen_subcommand_from export' -l bom -d 'Prepend a UTF-8 BOM'
complete -c holiday -n '__fish_seen_subcommand_from migrate' -l dry-run -d 'Parse locally without sending'
complete -c holiday -n '__fish_seen_subcommand_from calendar' -l month -d 'Month 1-12'
complete -c holiday -n '__fish_seen_subcommand_from calendar' -l no-color -d 'Disable ANSI colors'
complete -c holiday -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'
`
}

const GENERATORS: Record<CompletionShell, () => string> = {
  bash: bashScript,
  zsh: zshScript,
  fish: fishScript,
}

/**
 * Return a static shell-completion script for the given shell. The script is
 * hand-maintained (commander has no stable generator) and enumerates the CLI's
 * subcommands, flags, and `--type` values (sourced from VACATION_TYPES).
 */
export function runCompletion(shell: string): string {
  if (!(shell in GENERATORS)) {
    throw new UsageError(`shell must be one of: ${COMPLETION_SHELLS.join(', ')}`)
  }
  return GENERATORS[shell as CompletionShell]()
}
