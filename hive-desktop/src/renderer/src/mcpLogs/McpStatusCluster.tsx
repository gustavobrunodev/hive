import { t } from '../i18n'
import { PlugIcon } from '../ui/icons'
import { stateLabel, summarizeRoster, summaryLabel, type McpRosterEntry } from './mcpRoster'

/**
 * The MCP readout in the status bar: how many servers this workspace has, how
 * they are, and a way into the console.
 *
 * ## What it used to say, and why that wasn't enough
 *
 * It reported the name of whichever server spoke last — which is a fact about
 * the log tail, not about MCP. On a workspace whose logs the app couldn't find,
 * or before the first turn, it read "Sem atividade MCP", and a user who had
 * just watched the agent drive Playwright reasonably concluded the app had no
 * idea MCP existed. The number that answers "o que eu tenho" was nowhere on
 * screen, and neither was "conectou?".
 *
 * ## The three channels
 *
 * **Count** — the standing answer, always present: how many servers the
 * workspace has. **Tone** — quiet by default, loud only when something is
 * failing or waiting on auth, because a badge that is always on is furniture.
 * **Pulse** — live traffic, and only while it is live; motion here means "right
 * now", never "recently".
 *
 * The roster itself hangs off the hover/focus card rather than the bar: a
 * status item has room for one number, and the list of names, states and tool
 * counts is what you go looking for once the number surprises you. It is a
 * plain CSS-driven popover so it survives inside the bar's stacking context and
 * needs no portal, and it is reachable by keyboard focus, not just pointer.
 */
export interface McpStatusClusterProps {
  /** Every server the workspace knows about, most-alarming first. */
  roster: McpRosterEntry[]
  /** Whether events have arrived recently enough to count as live. */
  live: boolean
  /** Whether the dock is currently open — drives the pressed state. */
  open: boolean
  onToggle: () => void
}

export function McpStatusCluster({
  roster,
  live,
  open,
  onToggle
}: McpStatusClusterProps): React.JSX.Element {
  const summary = summarizeRoster(roster)
  const label = summaryLabel(summary)
  return (
    <div className="wb-status-mcp-wrap">
      <button
        type="button"
        className="wb-status-item wb-status-mcp"
        data-live={live || undefined}
        data-troubled={summary.troubled > 0 || undefined}
        aria-pressed={open}
        aria-label={t('mcpLogs.openAria')}
        onClick={onToggle}
      >
        <span className="wb-status-mcp-mark" aria-hidden="true">
          <PlugIcon size={13} />
          {live && <span className="wb-status-mcp-pulse" />}
        </span>
        <span className="wb-status-mcp-label">{label}</span>
        {summary.troubled > 0 && <span className="wb-status-mcp-errors">{summary.troubled}</span>}
      </button>
      <div className="wb-status-mcp-card" role="tooltip">
        <p className="wb-status-mcp-card-head">{t('mcpLogs.rosterHeading')}</p>
        {roster.length === 0 ? (
          <p className="wb-status-mcp-card-empty">{t('mcpLogs.rosterEmpty')}</p>
        ) : (
          <ul className="wb-status-mcp-card-list">
            {roster.map((entry) => (
              <li key={entry.key} className="wb-status-mcp-card-row" data-state={entry.state}>
                <span className="wb-status-mcp-card-dot" aria-hidden="true" />
                <span className="wb-status-mcp-card-name">{entry.name}</span>
                <span className="wb-status-mcp-card-state">{stateLabel(entry.state)}</span>
                {entry.tools !== null && entry.tools.length > 0 && (
                  <span className="wb-status-mcp-card-tools">
                    {t('mcpLogs.rosterTools', entry.tools.length)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="wb-status-mcp-card-foot">{t('mcpLogs.rosterFoot')}</p>
      </div>
    </div>
  )
}
