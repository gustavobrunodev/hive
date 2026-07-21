import { AgentClaudeIcon, AgentCopilotIcon, AgentDevinIcon, HiveCellIcon } from './icons'

type IconComponent = (props: { size?: number }) => React.JSX.Element

/**
 * Per-agent visual identity (multi-agent): a distinctive brand mark + an accent
 * hue, so an agent reads the same everywhere it appears — the onboarding
 * picker, the profile sheet, the composer switcher/indicator, and the history
 * badges. The accent is a CSS custom-property name (defined in workbench.css,
 * both themes) rather than a raw color, so theming stays token-driven; callers
 * set `style={{ '--agent-accent': `var(${accentVar})` }}` on the element.
 *
 * Renderer-side mirror of `main/agentRegistry.ts`'s ids — same local-mirror
 * convention `chat/Chat.tsx` uses for `AgentCapabilities`.
 */

interface AgentVisual {
  icon: IconComponent
  /** CSS variable name carrying this agent's accent color (see workbench.css). */
  accentVar: string
}

const AGENT_VISUALS: Record<string, AgentVisual> = {
  'claude-cli': { icon: AgentClaudeIcon, accentVar: '--agent-claude' },
  'github-copilot': { icon: AgentCopilotIcon, accentVar: '--agent-copilot' },
  devin: { icon: AgentDevinIcon, accentVar: '--agent-devin' }
}

/** The mark + accent for an agent id; an unknown id falls back to the neutral hive cell + app accent. */
export function agentVisual(agentId: string | null | undefined): AgentVisual {
  return (agentId && AGENT_VISUALS[agentId]) || { icon: HiveCellIcon, accentVar: '--accent' }
}

/** Convenience: just the brand-mark icon for an agent id. */
export function agentIcon(agentId: string | null | undefined): IconComponent {
  return agentVisual(agentId).icon
}
