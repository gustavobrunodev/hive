import { ApprovalCard, type ApprovalAnswer } from './ApprovalCard'
import { McpTurnNotice } from './McpTurnNotice'
import { ReasoningBlock } from './ReasoningBlock'
import { ToolActivityFeed } from './ToolActivityFeed'
import { TurnMeter } from './TurnMeter'
import { type TurnBlock } from './turnTimeline'
import type { TurnMetrics } from './turnTiming'

interface TurnTimelineProps {
  blocks: TurnBlock[]
  /** `true` while this turn is still running — drives the live row's motion and the meter's tense. */
  live: boolean
  /**
   * The turn's execution record — what the meter at the foot of the turn
   * reports. Absent on a conversation restored from disk (metrics are
   * live-only, like the blocks themselves), which simply renders no meter.
   */
  metrics?: TurnMetrics
  /** The shared clock every live duration in the turn counts against (`useTicker`). */
  now?: number
  /**
   * The smoothed reveal of the trailing text block (agent-activity AA-R4).
   * Only the tail is paced; every earlier text block is settled prose and
   * renders whole. Ignored when the turn is finished.
   */
  revealedText?: string | null
  /** Renders one text block (the app owns markdown rendering). */
  renderText: (text: string) => React.ReactNode
  onApprovalDecide: (requestId: string, decision: ApprovalAnswer) => void
  /** agent-patch: opens an edited file (absolute path) in the editor. */
  onOpenFile?: (path: string) => void
  /** mcp-visibility: opens the MCP console from the turn's handshake row. */
  onOpenMcpConsole?: () => void
}

/**
 * One reasoning block.
 *
 * A thought only counts as live while it is the turn's trailing block *and*
 * the turn is still running — a settled turn's last thought is history,
 * whatever its own flag says.
 */
function renderThinking(
  block: Extract<TurnBlock, { kind: 'thinking' }>,
  trailing: boolean
): React.JSX.Element {
  const live = trailing && block.settled !== true
  return (
    <ReasoningBlock
      key={block.id}
      text={block.text}
      settled={!live}
      {...(block.ms !== undefined ? { ms: block.ms } : {})}
    />
  )
}

/**
 * One assistant turn, rendered in the order it happened.
 *
 * The old layout split a turn into three fixed zones — tools on top, prose in
 * the middle, permission cards pinned below the entire conversation — so the
 * transcript never matched the story: the command ran above the sentence
 * explaining it, and the permission that gated it sat at the bottom of the
 * screen, next to the composer, long after the fact.
 *
 * This is a log, the way every coding agent renders one. Blocks come out of
 * `turnTimeline.ts` in arrival order and are drawn in that order, so a turn
 * reads top to bottom as: *what I'm about to do* → *may I?* → *doing it* →
 * *what came of it* → *what it took* (the `TurnMeter` foot).
 *
 * The meter replaced the bouncing typing dots that used to close a live turn.
 * The dots said one thing ("something is happening") and could only say it
 * when nothing else was; the meter always has something truer to say — which
 * phase the turn is in and how long it has been there — and it settles into
 * the turn's receipt instead of vanishing.
 */
export function TurnTimeline({
  blocks,
  live,
  metrics,
  now = 0,
  revealedText,
  renderText,
  onApprovalDecide,
  onOpenFile,
  onOpenMcpConsole
}: TurnTimelineProps): React.JSX.Element {
  const lastIndex = blocks.length - 1

  return (
    <div className="wb-turn">
      {blocks.map((block, index) => {
        if (block.kind === 'tools') {
          return (
            <ToolActivityFeed
              key={block.id}
              activities={block.activities}
              live={live && index === lastIndex}
              now={now}
              onOpenFile={onOpenFile}
            />
          )
        }
        if (block.kind === 'thinking') {
          return renderThinking(block, live && index === lastIndex)
        }
        if (block.kind === 'approval') {
          return <ApprovalCard key={block.id} request={block.request} onDecide={onApprovalDecide} />
        }
        if (block.kind === 'mcp') {
          return (
            <McpTurnNotice
              key={block.id}
              servers={block.servers}
              onOpenConsole={onOpenMcpConsole}
            />
          )
        }
        // Trailing block of a live turn: the paced reveal. Everything above it
        // is done arriving and must not re-animate.
        const text = live && index === lastIndex && revealedText != null ? revealedText : block.text
        if (text === '') return null
        return <div key={block.id}>{renderText(text)}</div>
      })}
      {metrics && <TurnMeter metrics={metrics} blocks={blocks} live={live} now={now} />}
    </div>
  )
}
