import { useState } from 'react'
import { changedComponentIds, nextGroupId, type CapabilityViolation } from './documentModel'
import { findNode } from './screenTree'
import type { SkillPhase } from './skillRun'
import { useSkillRun } from './useSkillRun'
import type { StudioOperationError } from './screens'
import type { useDesignStudio } from './useDesignStudio'
import { documentKey, type ScreenDocumentState } from './useScreenDocument'

/**
 * Design Studio (M18) — T6.5. Everything the tab does with the Skill, in one
 * place: the two ways to start a turn, what happens to what it produced, and
 * the context the chat shows.
 *
 * Extracted from `DesignStudioViewer` rather than inlined, because the shell's
 * job is already the Bancada's layout and this is a second job with its own
 * five pieces of state. The component composes it; it does not own it.
 */

/** Either of the two failure shapes DS-R17 allows — and never a third. */
export type SkillFailure = CapabilityViolation | StudioOperationError | null

export interface StudioSkillState {
  /** Non-null exactly while a turn is in flight. */
  phase: SkillPhase | null
  /** The phase, but only while the **stage** owns the wait (a generation). */
  stagePhase: SkillPhase | null
  /** The phase, but only while the **chat** owns the wait (an iteration). */
  chatPhase: SkillPhase | null
  /** What the stage should render instead of the Preview, if anything. */
  stageFailure: SkillFailure
  /**
   * T6.7 / DS-R10 AC-6: the same two failure shapes, but for a turn the *chat*
   * asked for — shown in the chat, where the request was made, rather than
   * over the Preview the user is still looking at.
   */
  chatFailure: SkillFailure
  retry: () => void
  /** DS-R2: runs the Skill over the Spec for the active Tela. */
  generate: () => void
  /** DS-R10: sends one iteration request, scoped by the context below. */
  send: (message: string) => void
  expanded: boolean
  setExpanded: (expanded: boolean) => void
  /** The selected Component's tag while it is still the request's context. */
  contextTag: string | null
  /** Drops the context for the next turns — without dropping the selection. */
  releaseContext: () => void
  /**
   * T6.6 / §3.9: the nodes the last landed turn changed. A fresh array identity
   * per turn is what makes the Preview outline them once and only once.
   */
  pulse: readonly string[]
}

export function useStudioSkill(
  workspace: string,
  specPath: string,
  activeTitle: string,
  studio: ReturnType<typeof useDesignStudio>,
  doc: ScreenDocumentState
): StudioSkillState {
  // A batch the catalog refused (DS-R11 AC-3). Kept apart from the run's own
  // `error` because it is the *other* failure shape and reads differently.
  const [refused, setRefused] = useState<CapabilityViolation | null>(null)
  const [expanded, setExpanded] = useState(false)
  // DS-R10: the selection is the request's context *by default* — so the ✕
  // records which Component the user let go of rather than clearing the
  // selection itself. The Inspetor is still looking at it; the chat simply
  // stopped assuming the request is about it.
  const [released, setReleased] = useState<string | null>(null)
  const [pulse, setPulse] = useState<readonly string[]>([])

  const selected = studio.selectedComponentId
  const contextId = selected !== null && selected !== released ? selected : null
  const contextTag = findNode(doc.document.root, contextId)?.tag ?? null

  /**
   * T6.2 / T6.3: what the Skill produced becomes **one** grouped step, and only
   * if the whole batch is valid — `dispatch` validates every Command before it
   * pushes any, so a refusal leaves the Tela exactly as it was.
   *
   * An empty batch is a turn with no effect: nothing is dispatched and no undo
   * step is stacked (spec.md, Edge Cases) — but the Skill's explanation is
   * still said, because that explanation *is* the answer (DS-R11 AC-5).
   */
  const skill = useSkillRun((batch) => {
    setRefused(null)
    const groupId = nextGroupId()
    const say = (text: string, changes: number): void => {
      if (text.length === 0 && changes === 0) return
      studio.appendMessage({
        id: `m-${groupId}`,
        role: 'agent',
        text,
        // Only a turn that landed Commands can be undone as a turn — an
        // explanation (DS-R11 AC-5) has nothing behind it to revert.
        ...(changes > 0 ? { groupId, changes } : {})
      })
    }
    if (batch.commands.length === 0) {
      say(batch.message, 0)
      return
    }
    void doc.dispatch(batch.commands, groupId).then((violation) => {
      if (violation !== null) {
        setRefused(violation)
        return
      }
      studio.recordStep(groupId)
      say(batch.message, batch.commands.length)
      setPulse(changedComponentIds(batch.commands))
    })
  })

  const generate = (): void => {
    setRefused(null)
    skill.start({ kind: 'generate', workspace, specPath, screenTitle: activeTitle })
  }

  /**
   * The user's own words go into the transcript first: the turn takes seconds,
   * and a chat that shows nothing until the agent answers reads as a message
   * that was lost.
   */
  const send = (message: string): void => {
    const screenId = studio.activeScreenId
    if (screenId === null) return
    setRefused(null)
    studio.appendMessage({ id: nextGroupId(), role: 'user', text: message })
    skill.start({
      kind: 'iterate',
      key: documentKey(workspace, specPath, screenId),
      screenId,
      title: activeTitle,
      message,
      selectedComponentId: contextId
    })
  }

  // One turn, one live region. The stage covers a generation and the chat
  // covers an iteration — announcing the same turn in both would be a
  // duplicate announcement for a screen-reader user, not extra reassurance.
  const generating = skill.kind === 'generate'

  // A failure belongs to the surface that asked for the turn: an iteration that
  // failed must not paint over the Preview the user is still reading.
  const failure = skill.error ?? refused
  const iterating = skill.kind === 'iterate'

  return {
    phase: skill.phase,
    stagePhase: generating ? skill.phase : null,
    chatPhase: generating ? null : skill.phase,
    stageFailure: iterating ? null : failure,
    chatFailure: iterating ? failure : null,
    retry: skill.retry,
    generate,
    send,
    expanded,
    setExpanded,
    contextTag,
    releaseContext: () => setReleased(selected),
    pulse
  }
}
