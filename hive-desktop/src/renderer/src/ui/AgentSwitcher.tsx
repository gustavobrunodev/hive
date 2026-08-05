import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@hive/design-system'
import { t } from '../i18n'
import { agentVisual } from './agentVisuals'
import { ChevronDownIcon, GearIcon, LockIcon } from './icons'

export interface SwitchableAgent {
  id: string
  displayName: string
}

interface AgentSwitcherProps {
  /** Enabled agents (the pool), in display order. */
  agents: SwitchableAgent[]
  /** The current conversation's agent id. */
  value: string | null
  /**
   * Locked once the conversation has started: its CLI `--resume` handle is
   * agent-specific, so switching agent mid-conversation would silently break
   * memory. A started conversation shows the agent as a quiet, non-interactive
   * badge; a fresh one lets the user pick.
   */
  locked: boolean
  onChange: (id: string) => void
  /** Opens the profile sheet's agent section ("Gerenciar agentes…"). */
  onManage: () => void
}

/**
 * The composer's per-conversation agent control (multi-agent). On a fresh
 * conversation it's a dropdown to pick which enabled agent drives it; once the
 * conversation has started it locks to that agent (a labeled badge). Using
 * different agents "at the same time" falls out naturally: each conversation
 * keeps its own agent, and they run concurrently through the session pool.
 */
export function AgentSwitcher({
  agents,
  value,
  locked,
  onChange,
  onManage
}: AgentSwitcherProps): React.JSX.Element | null {
  const active = agents.find((a) => a.id === value) ?? agents[0] ?? null
  if (!active) return null
  const visual = agentVisual(active.id)
  const accentStyle = { ['--agent-accent' as string]: `var(${visual.accentVar})` }

  if (locked) {
    return (
      <span
        className="wb-agent-pill wb-agent-pill-locked"
        style={accentStyle}
        aria-label={t('chat.agentLockedAria', active.displayName)}
        title={t('chat.agentLockedHint')}
      >
        <span className="wb-agent-pill-mark" aria-hidden="true">
          <visual.icon size={15} />
        </span>
        <span className="wb-agent-pill-name">{active.displayName}</span>
        <LockIcon size={12} />
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="wb-agent-pill wb-agent-pill-btn"
          style={accentStyle}
          aria-label={t('chat.agentSwitcherAria', active.displayName)}
        >
          <span className="wb-agent-pill-mark" aria-hidden="true">
            <visual.icon size={15} />
          </span>
          <span className="wb-agent-pill-name">{active.displayName}</span>
          <ChevronDownIcon size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="wb-agent-menu">
        <DropdownMenuRadioGroup value={active.id} onValueChange={onChange}>
          {agents.map((agent) => {
            const itemVisual = agentVisual(agent.id)
            return (
              <DropdownMenuRadioItem
                key={agent.id}
                value={agent.id}
                className="wb-agent-menu-item"
                style={{ ['--agent-accent' as string]: `var(${itemVisual.accentVar})` }}
                aria-label={t('chat.agentPickAria', agent.displayName)}
              >
                <span className="wb-agent-menu-inner">
                  <span className="wb-agent-menu-mark" aria-hidden="true">
                    <itemVisual.icon size={16} />
                  </span>
                  {agent.displayName}
                </span>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {/* The DS `DropdownMenuItem` wraps its children in one nowrap/ellipsis
            label span, so icon + text handed to it as siblings collapse against
            each other. Both go inside the same `wb-agent-menu-inner` row the
            radio items use — one icon column, one gap rule, one alignment. */}
        <DropdownMenuItem className="wb-agent-menu-manage" onSelect={onManage}>
          <span className="wb-agent-menu-inner">
            <span className="wb-agent-menu-mark" aria-hidden="true">
              <GearIcon size={15} />
            </span>
            {t('chat.agentManageCta')}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
