import { t } from '../i18n'
import { Skeleton } from '@hive/design-system'
import { ArrowRightIcon, ToolsIcon } from '../ui/icons'

export interface McpScopeProps {
  /** Configured servers in this workspace; `null` while the count is unknown. */
  count: number | null
  /** Opens the manager. Absent means the host hasn't wired it (the row then only reports). */
  onOpen?: () => void
}

/**
 * The `Servidores MCP` settings detail.
 *
 * It moved here from the workspace toolbar (nav-redesign): MCP is
 * configuration — which external tools the agent may call — and a toolbar icon
 * beside "buscar arquivos" said it was a place you go, which it is not. This
 * detail states what is configured and opens the manager that changes it.
 *
 * The manager itself is untouched. It is a `Dialog` with its own nested
 * add/edit/delete dialogs, so embedding it inside this `Sheet` would stack
 * three modal layers to edit one server's arguments; the row hands off instead,
 * exactly as the shortcuts row hands off to the shortcut picker.
 */
export function McpScope({ count, onOpen }: McpScopeProps): React.JSX.Element {
  return (
    <div className="wb-mcpscope">
      <div className="wb-mcpscope-state">
        <span className="wb-mcpscope-mark" aria-hidden="true">
          <ToolsIcon size={18} />
        </span>
        {count === null ? (
          <Skeleton style={{ width: 120, height: 14 }} />
        ) : (
          <span className="wb-mcpscope-count">{t('profile.mcpSummary', count)}</span>
        )}
      </div>
      <p className="wb-mcpscope-note">{t('mcp.description')}</p>
      {onOpen && (
        <button type="button" className="wb-mcpscope-cta" onClick={onOpen}>
          {t('mcp.openLabel')}
          <ArrowRightIcon size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
