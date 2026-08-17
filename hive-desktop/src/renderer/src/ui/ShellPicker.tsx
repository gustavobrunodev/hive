import { RadioGroup, RadioGroupItem } from '@hive/design-system'
import { shellName, shellSupportNote, t } from '../i18n'
import { AlertTriangleIcon, CheckIcon, RefreshIcon, TerminalIcon } from './icons'

/** Structural mirror of `main/agentAdapter.ts` (renderer-side mirror convention). */
export type ShellSupport = 'native' | 'launch-only'
export type ShellSupportNote =
  'posix-bash-zsh-only' | 'windows-git-bash' | 'powershell-preview' | 'no-cli-binding'

/** Structural mirror of `main/shellService.ts`'s `ShellAgentSupport`. */
export interface ShellAgentSupport {
  agentId: string
  displayName: string
  support: ShellSupport
  note?: ShellSupportNote
}

/** Structural mirror of `main/shellService.ts`'s `ShellOption`. */
export interface ShellOption {
  id: string
  path: string
  family: 'cmd' | 'powershell' | 'bash' | 'zsh' | 'fish' | 'sh'
  systemDefault: boolean
  agents: ShellAgentSupport[]
}

/** Structural mirror of `main/shellService.ts`'s `ShellCatalogView`. */
export interface ShellCatalogView {
  shells: ShellOption[]
  selectedId: string | null
  resolvedId: string | null
  missingSelection: boolean
}

interface ShellPickerProps {
  view: ShellCatalogView | null
  /** `null` selects "Automático" (the system default, re-resolved per machine). */
  onSelect: (id: string | null) => void
  /** Re-runs detection (AT-R1) — "eu acabei de instalar o Git Bash". */
  onRefresh: () => void
  refreshing: boolean
}

/** The value the radio group carries for "Automático" — `null` doesn't survive a DOM attribute. */
const AUTO_VALUE = '__auto__'

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
          above it, exactly what the "Automático" row and the "padrão do
          sistema" badge already say — the duplicated-affordance defect this
          project keeps re-learning (STATE.md, M12). */}
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

/** One selectable terminal: the radio, its name, and the path detection found. */
function ShellRow({
  value,
  name,
  detail,
  path,
  badge,
  selected
}: {
  value: string
  name: string
  detail: string
  /** Whether `detail` is a filesystem path (mono, wrapping) or a sentence. */
  path: boolean
  badge: string | null
  selected: boolean
}): React.JSX.Element {
  return (
    <label className="wb-shell-row" data-selected={selected || undefined}>
      <RadioGroupItem value={value} aria-label={name} />
      <span className="wb-shell-row-body">
        <span className="wb-shell-row-head">
          <span className="wb-shell-row-name">{name}</span>
          {badge && <span className="wb-shell-row-badge">{badge}</span>}
        </span>
        {/* Paths wrap rather than truncate: this line is the row's evidence,
            and an ellipsis hides the tail — which is the half that tells two
            PowerShells (or two Git installs) apart. */}
        <span className="wb-shell-row-detail" data-path={path || undefined}>
          {detail}
        </span>
      </span>
    </label>
  )
}

/**
 * What the selected terminal actually changes, one line per enabled agent.
 *
 * This block is the reason the picker isn't a dropdown. On Windows the default
 * is `cmd`, and Claude Code has no cmd executor at all — it runs its own
 * commands through Git Bash or PowerShell. Without this, the setting would
 * read as a promise the product can't keep, at exactly the moment the user is
 * deciding.
 */
function ShellSupportList({ agents }: { agents: ShellAgentSupport[] }): React.JSX.Element {
  return (
    <div className="wb-shell-support">
      <p className="wb-shell-support-title">
        <TerminalIcon size={13} />
        {t('shell.supportTitle')}
      </p>
      <ul className="wb-shell-support-list">
        {agents.map((agent) => (
          <li key={agent.agentId} className="wb-shell-support-item" data-support={agent.support}>
            <span className="wb-shell-support-mark" aria-hidden="true">
              {agent.support === 'native' ? (
                <CheckIcon size={12} />
              ) : (
                <AlertTriangleIcon size={12} />
              )}
            </span>
            {shellSupportNote(agent.displayName, agent.support, agent.note)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The four things the picker renders from, derived once: the rows, the radio
 * value ("Automático" has no id of its own), the shell automatic resolves to,
 * and the shell whose caveats are shown — which under "Automático" is the
 * resolved one, because that is where the next turn will actually run.
 */
function readView(view: ShellCatalogView | null): {
  shells: ShellOption[]
  selectedValue: string
  resolved: ShellOption | null
  active: ShellOption | null
} {
  const shells = view?.shells ?? []
  const selectedValue = view?.selectedId ?? AUTO_VALUE
  const resolved = shells.find((shell) => shell.id === view?.resolvedId) ?? null
  return {
    shells,
    selectedValue,
    resolved,
    active: shells.find((shell) => shell.id === selectedValue) ?? resolved
  }
}

/**
 * The terminal picker (agent-terminal, AT-R1/AT-R2/AT-R5).
 *
 * A list of radios, not cards: this is one choice among a handful of items
 * that differ by a name and a path, and a card grid would spend a lot of
 * surface saying nothing extra. Each row carries the **absolute path** that
 * detection actually found, for the same reason `AgentPicker` shows the
 * `--version` it read back — a list that named a shell we hadn't verified
 * would repeat, one level down, the bug that whole area exists to fix.
 */
export function ShellPicker({
  view,
  onSelect,
  onRefresh,
  refreshing
}: ShellPickerProps): React.JSX.Element {
  const { shells, selectedValue, resolved, active } = readView(view)

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
          <ShellRow
            value={AUTO_VALUE}
            name={t('shell.autoLabel')}
            detail={
              resolved
                ? t('shell.autoDescription', shellName(resolved.id))
                : t('shell.autoDescriptionEmpty')
            }
            path={false}
            badge={null}
            selected={selectedValue === AUTO_VALUE}
          />
          {shells.map((shell) => (
            <ShellRow
              key={shell.id}
              value={shell.id}
              name={shellName(shell.id)}
              detail={shell.path}
              path
              badge={shell.systemDefault ? t('shell.systemDefaultBadge') : null}
              selected={selectedValue === shell.id}
            />
          ))}
        </RadioGroup>
      )}

      {active && active.agents.length > 0 && <ShellSupportList agents={active.agents} />}
    </div>
  )
}
