import { t } from '../i18n'
import { ActivityIcon } from '../ui/icons'
import type { McpLogEntry } from './logConsole'

/**
 * The MCP console's ambient signal, docked in the status bar.
 *
 * This is what makes the console worth docking rather than hiding in a dialog:
 * without opening anything, the bar says whether MCP servers are working right
 * now, which one spoke last, and whether anything has gone wrong. Clicking it
 * opens the dock — the VS Code status-item → panel contract users already have.
 *
 * It stays quiet when there is nothing to report: no logs at all renders a
 * plain label, not a zero.
 */
export interface McpStatusClusterProps {
  /** The most recent entry, or null when nothing has arrived. */
  last: McpLogEntry | null
  /** How many error-level entries the loaded window holds. */
  errors: number
  /** Whether events have arrived recently enough to count as live. */
  live: boolean
  /** Whether the dock is currently open — drives the pressed state. */
  open: boolean
  onToggle: () => void
}

export function McpStatusCluster({
  last,
  errors,
  live,
  open,
  onToggle
}: McpStatusClusterProps): React.JSX.Element {
  const label = last === null ? t('mcpLogs.idleStrip') : last.server
  return (
    <button
      type="button"
      className="wb-status-item wb-status-mcp"
      data-live={live || undefined}
      aria-pressed={open}
      aria-label={t('mcpLogs.openAria')}
      title={t('mcpLogs.openLabel')}
      onClick={onToggle}
    >
      <span className="wb-status-mcp-mark" aria-hidden="true">
        <ActivityIcon size={13} />
        {live && <span className="wb-status-mcp-pulse" />}
      </span>
      <span className="wb-status-mcp-label">{label}</span>
      {errors > 0 && <span className="wb-status-mcp-errors">{errors}</span>}
    </button>
  )
}
