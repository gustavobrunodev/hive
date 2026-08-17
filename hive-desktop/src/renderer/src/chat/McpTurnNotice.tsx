import { t } from '../i18n'
import { PlugIcon } from '../ui/icons'
import type { McpServerReport } from './turnTimeline'

/**
 * The turn's MCP handshake, told in the transcript at the moment it happened.
 *
 * ## The gap this closes
 *
 * The CLI dials every MCP server before the agent may call anything, and
 * reports the outcome on its first line. The app read that line for nothing, so
 * a turn that spent two seconds starting Playwright and then drove a browser
 * looked, from the transcript, exactly like a turn that had no MCP at all — the
 * agent narrated its tool calls and never once said where the tools came from,
 * or whether the server behind them had actually come up.
 *
 * ## Why it is one line, and why it isn't on every turn
 *
 * A roster that has not changed is not news, and `Chat.tsx` only opens this
 * block when the signature moves (see `rosterSignature`) — first turn of the
 * pane, a server appearing, or a status changing. The standing answer lives in
 * the status bar, where it costs no transcript. So this row means something
 * every time it appears: *this is what you got, and this is what changed*.
 *
 * A failure is the one thing that gets extra weight — a server that didn't
 * connect explains every strange thing the rest of the turn is about to do.
 */
export interface McpTurnNoticeProps {
  servers: McpServerReport[]
  /** Opens the MCP console. The row is a way in, not a dead end. */
  onOpenConsole?: () => void
}

/** The row's sentence: the ordinary case counts, the exceptional case names. */
function headline(servers: McpServerReport[]): { text: string; trouble: boolean } {
  const troubled = servers.filter(
    (server) => server.status === 'failed' || server.status === 'needs-auth'
  )
  if (troubled.length === 0) return { text: t('mcp.turnReady', servers.length), trouble: false }
  if (troubled.length === 1)
    return { text: t('mcp.turnOneFailed', troubled[0].name), trouble: true }
  return { text: t('mcp.turnManyFailed', troubled.length), trouble: true }
}

export function McpTurnNotice({ servers, onOpenConsole }: McpTurnNoticeProps): React.JSX.Element {
  const { text, trouble } = headline(servers)
  const body = (
    <>
      <span className="wb-mcpturn-mark" aria-hidden="true">
        <PlugIcon size={12} />
      </span>
      <span className="wb-mcpturn-head">{text}</span>
      <span className="wb-mcpturn-chips">
        {servers.map((server) => (
          <span key={server.name} className="wb-mcpturn-chip" data-status={server.status}>
            <span className="wb-mcpturn-dot" aria-hidden="true" />
            <span className="wb-mcpturn-name">{server.name}</span>
            {server.tools.length > 0 && (
              <span className="wb-mcpturn-count">{server.tools.length}</span>
            )}
          </span>
        ))}
      </span>
    </>
  )
  const aria = [
    text,
    ...servers.map((server) => t('mcp.turnServerAria', server.name, server.tools.length))
  ].join('. ')

  if (!onOpenConsole) {
    return (
      <div className="wb-mcpturn" data-trouble={trouble || undefined} aria-label={aria} role="note">
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      className="wb-mcpturn wb-mcpturn-button"
      data-trouble={trouble || undefined}
      aria-label={t('mcp.turnOpenAria', aria)}
      onClick={onOpenConsole}
    >
      {body}
    </button>
  )
}
