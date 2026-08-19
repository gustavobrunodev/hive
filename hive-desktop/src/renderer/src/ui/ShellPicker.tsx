import { useState } from 'react'
import { Badge, CommandLine, RadioCard, RadioGroup } from '@hive/design-system'
import { shellName, shellSigil, shellSupportNote, t } from '../i18n'
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  CornerDownRightIcon,
  ExternalLinkIcon,
  MinusIcon,
  RefreshIcon,
  TerminalIcon
} from './icons'

/** Structural mirror of `main/agentAdapter.ts` (renderer-side mirror convention). */
export type ShellSupport = 'native' | 'fallback' | 'launch-only'
export type ShellSupportNote =
  | 'posix-bash-zsh-only'
  | 'windows-git-bash'
  | 'powershell-preview'
  | 'cmd-no-executor'
  | 'install-git-bash'
  | 'no-cli-binding'

export type ShellFamily = 'cmd' | 'powershell' | 'bash' | 'zsh' | 'fish' | 'sh'

/** Structural mirror of `main/shellService.ts`'s `ShellAgentSupport`. */
export interface ShellAgentSupport {
  agentId: string
  displayName: string
  support: ShellSupport
  note?: ShellSupportNote
  /** Id of the shell this agent really runs its own commands in, or `null` when its CLI decides. */
  runsIn: string | null
}

/** Structural mirror of `main/shellService.ts`'s `ShellOption`. */
export interface ShellOption {
  id: string
  path: string
  family: ShellFamily
  /** True for the shell "Automático" resolves to on this machine. */
  automatic: boolean
  agents: ShellAgentSupport[]
  /** The literal command line a turn is spawned with here. */
  preview: string
}

/** Structural mirror of `main/shellService.ts`'s `ShellCatalogView`. */
export interface ShellCatalogView {
  shells: ShellOption[]
  selectedId: string | null
  resolvedId: string | null
  missingSelection: boolean
  platform: string
}

interface ShellPickerProps {
  view: ShellCatalogView | null
  /** `null` selects "Automático" (re-resolved per machine). */
  onSelect: (id: string | null) => void
  /** Re-runs detection (AT-R1) — "eu acabei de instalar o Git Bash". */
  onRefresh: () => void
  refreshing: boolean
  /** Writes to the system clipboard. The renderer's own `navigator.clipboard` is denied here. */
  onCopy?: (text: string) => void
  /** Opens a URL in the user's browser (the "instale o Git para Windows" way out). */
  onOpenUrl?: (url: string) => void
}

/** The value the radio group carries for "Automático" — `null` doesn't survive a DOM attribute. */
const AUTO_VALUE = '__auto__'

/** Where the `install-git-bash` note sends someone — the CLI's own recommendation, verbatim. */
const GIT_FOR_WINDOWS_URL = 'https://git-scm.com/downloads/win'

/**
 * What the last detection found and the control that runs it again — the same
 * shape (and literally the same button class) as the agent picker's strip, so
 * "procurar de novo" is one affordance in this sheet, not two dialects.
 */
function ShellScanStrip({
  count,
  refreshing,
  onRefresh
}: {
  count: number
  refreshing: boolean
  onRefresh: () => void
}): React.JSX.Element {
  return (
    <div className="wb-shell-scan" data-busy={refreshing || undefined}>
      {/* Only the count. Naming the shell in use here too would repeat, 40px
          above it, exactly what the "Automático" row and the "Em uso" badge
          already say — the duplicated-affordance defect this project keeps
          re-learning (STATE.md, M12). */}
      <p className="wb-shell-scan-text" aria-live="polite">
        {refreshing ? t('shell.detecting') : t('shell.scanSummary', count)}
      </p>
      <button type="button" className="wb-agent-scan-btn" onClick={onRefresh} disabled={refreshing}>
        <RefreshIcon size={13} />
        {t('shell.rescan')}
      </button>
    </div>
  )
}

/**
 * The shell's own prompt sigil in a small tile — `$`, `%`, `PS>`, `C:\`.
 *
 * Recognition, not decoration: this is the mark a person already reads a
 * terminal by, and it is the only leading visual that tells four rows apart at
 * a glance. The "automatic" tile carries the sigil of the shell that rule
 * lands on, behind a dashed border — because that is precisely what
 * "Automático" is: not a terminal, a rule that resolves to one of the rows
 * below.
 */
function ShellSigil({
  shell,
  auto
}: {
  shell: ShellOption | null
  auto?: boolean
}): React.JSX.Element {
  return (
    <span className="wb-shell-sigil" data-auto={auto || undefined} aria-hidden="true">
      {shell ? shellSigil(shell.id, shell.family) : <TerminalIcon size={13} />}
    </span>
  )
}

/** The glyph between an agent and the shell it lands in — one per support state. */
function RouteMark({ support }: { support: ShellSupport }): React.JSX.Element {
  if (support === 'native') return <ArrowRightIcon size={12} />
  if (support === 'fallback') return <CornerDownRightIcon size={12} />
  return <MinusIcon size={12} />
}

/**
 * One agent, and the shell it will really run its own commands in.
 *
 * This line is the feature. The picker used to answer "o que isso muda para
 * cada agente" in three lines of prose per agent, and the one fact a reader
 * needed — *which shell* — was never in it. So a user could pick "Prompt de
 * Comando", read the paragraph, and still be told by the agent that it was
 * using PowerShell. Name the destination, mark it when it isn't the one that
 * was picked, and the surprise has nowhere left to happen.
 */
function ShellRoute({ agent }: { agent: ShellAgentSupport }): React.JSX.Element {
  const target = agent.runsIn === null ? t('shell.routeUnknown') : shellName(agent.runsIn)
  return (
    <li className="wb-shell-route" data-support={agent.support}>
      <span className="wb-shell-route-agent">{agent.displayName}</span>
      <span className="wb-shell-route-target">
        <span className="wb-shell-route-mark">
          <RouteMark support={agent.support} />
        </span>
        {target}
      </span>
    </li>
  )
}

/**
 * The reasons behind the routes — one line each, and only when there is
 * something the route itself doesn't already say. A note per agent per row is
 * how the old version turned into a wall nobody read.
 */
function ShellNotes({
  agents,
  onOpenUrl
}: {
  agents: ShellAgentSupport[]
  onOpenUrl?: (url: string) => void
}): React.JSX.Element | null {
  const notes = agents
    .map((agent) => ({
      agent,
      text: shellSupportNote(
        agent.displayName,
        agent.support,
        agent.note,
        agent.runsIn === null ? null : shellName(agent.runsIn)
      )
    }))
    .filter((entry): entry is { agent: ShellAgentSupport; text: string } => entry.text !== null)

  if (notes.length === 0) return null
  return (
    <ul className="wb-shell-notes">
      {notes.map(({ agent, text }) => (
        <li key={agent.agentId} className="wb-shell-note" data-support={agent.support}>
          {text}
          {agent.note === 'install-git-bash' && onOpenUrl && (
            <button
              type="button"
              className="wb-shell-note-cta"
              onClick={() => onOpenUrl(GIT_FOR_WINDOWS_URL)}
            >
              {t('shell.installGitCta')}
              <ExternalLinkIcon size={11} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * The receipt: the exact command line a turn is spawned with in this shell,
 * behind a disclosure.
 *
 * Collapsed by default because most people want the answer, not the proof —
 * but the proof is one click away and comes from `shellSpawnTarget`, the same
 * function that does the spawning. That is the difference between a setting
 * you believe and one you have to take on faith.
 */
function ShellCommand({
  shell,
  onCopy
}: {
  shell: ShellOption
  onCopy?: (text: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="wb-shell-command">
      <button
        type="button"
        className="wb-shell-command-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <ChevronDownIcon size={12} />
        {open ? t('shell.commandHide') : t('shell.commandShow')}
      </button>
      {open && (
        <CommandLine
          className="wb-shell-command-line"
          command={shell.preview}
          // No prompt sigil here on purpose: the command already opens with
          // this shell's own absolute path, and `C:\` in front of
          // `C:\WINDOWS\system32\cmd.exe` reads as a mangled path, not a prompt.
          onCopy={onCopy}
          copyLabel={t('shell.commandCopy')}
          copiedLabel={t('shell.commandCopied')}
        />
      )}
    </div>
  )
}

/** Everything that follows from choosing one row: where each agent lands, why, and the proof. */
function ShellOutcome({
  shell,
  onCopy,
  onOpenUrl
}: {
  shell: ShellOption | null
  onCopy?: (text: string) => void
  onOpenUrl?: (url: string) => void
}): React.JSX.Element | null {
  if (!shell) return null
  return (
    <div className="wb-shell-outcome">
      {shell.agents.length > 0 && (
        <>
          <p className="wb-shell-outcome-title">{t('shell.routesTitle')}</p>
          <ul className="wb-shell-routes">
            {shell.agents.map((agent) => (
              <ShellRoute key={agent.agentId} agent={agent} />
            ))}
          </ul>
          <ShellNotes agents={shell.agents} onOpenUrl={onOpenUrl} />
        </>
      )}
      <ShellCommand shell={shell} onCopy={onCopy} />
    </div>
  )
}

/**
 * The three things the picker renders from, derived once: the rows, the radio
 * value ("Automático" has no id of its own), and the shell "Automático" lands
 * on.
 *
 * `automatic` is deliberately not `resolvedId`. They agree while automatic is
 * the selection and diverge the moment someone picks a row — `resolvedId` then
 * means "where the next turn runs" (which is the pick), while the "Automático"
 * row still has to describe *its own* rule. Reading the wrong one made that
 * row announce "Segue o terminal do sistema: Fish" while Fish was the manual
 * choice and the system's own shell was zsh.
 */
function readView(view: ShellCatalogView | null): {
  shells: ShellOption[]
  selectedValue: string
  automatic: ShellOption | null
} {
  const shells = view?.shells ?? []
  return {
    shells,
    selectedValue: view?.selectedId ?? AUTO_VALUE,
    automatic: shells.find((shell) => shell.automatic) ?? null
  }
}

/**
 * The terminal picker (agent-terminal, AT-R1/AT-R2/AT-R5).
 *
 * A list of option rows, not a dropdown: this is a choice whose consequences
 * differ per agent, and the consequences have to be readable *while*
 * choosing. Each row carries the absolute path detection found — the same
 * standard of evidence as `AgentPicker`'s `--version` line — and the selected
 * row opens to show where every enabled agent will actually run, plus the
 * command line that proves it.
 */
export function ShellPicker({
  view,
  onSelect,
  onRefresh,
  refreshing,
  onCopy,
  onOpenUrl
}: ShellPickerProps): React.JSX.Element {
  const { shells, selectedValue, automatic } = readView(view)
  const windows = view?.platform === 'win32'

  return (
    <div className="wb-shell-picker">
      <ShellScanStrip count={shells.length} refreshing={refreshing} onRefresh={onRefresh} />

      {view?.missingSelection && (
        <p className="wb-shell-missing" role="alert">
          <AlertTriangleIcon size={14} />
          {t('shell.missingSelection', shellName(view.selectedId ?? ''))}
        </p>
      )}

      {shells.length === 0 && !refreshing ? (
        <p className="wb-shell-empty">{t('shell.empty')}</p>
      ) : (
        <RadioGroup
          className="wb-shell-list"
          value={selectedValue}
          onValueChange={(value) => onSelect(value === AUTO_VALUE ? null : value)}
          aria-label={t('shell.groupLabel')}
        >
          <RadioCard
            value={AUTO_VALUE}
            title={t('shell.autoLabel')}
            leading={<ShellSigil shell={automatic} auto />}
            meta={
              automatic
                ? windows
                  ? t('shell.autoDescriptionPicked', shellName(automatic.id))
                  : t('shell.autoDescriptionSystem', shellName(automatic.id))
                : t('shell.autoDescriptionEmpty')
            }
            selected={selectedValue === AUTO_VALUE}
          >
            <ShellOutcome shell={automatic} onCopy={onCopy} onOpenUrl={onOpenUrl} />
          </RadioCard>
          {shells.map((shell) => (
            <RadioCard
              key={shell.id}
              value={shell.id}
              title={shellName(shell.id)}
              leading={<ShellSigil shell={shell} />}
              // Paths wrap rather than truncate: this line is the row's
              // evidence, and an ellipsis hides the tail — which is the half
              // that tells two PowerShells (or two Git installs) apart.
              meta={shell.path}
              metaMono
              badge={
                shell.id === view?.resolvedId ? (
                  <Badge className="wb-shell-live" variant="muted">
                    <span className="wb-shell-live-dot" aria-hidden="true" />
                    {t('shell.liveBadge')}
                  </Badge>
                ) : undefined
              }
              selected={selectedValue === shell.id}
            >
              <ShellOutcome shell={shell} onCopy={onCopy} onOpenUrl={onOpenUrl} />
            </RadioCard>
          ))}
        </RadioGroup>
      )}
    </div>
  )
}
