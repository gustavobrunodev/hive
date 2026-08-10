/**
 * Design Studio (M18) — T4.4/T4.7. What each Tela keeps while the tab is open.
 *
 * **This is not a second reducer.** `main/designStudio/screenDocument.ts` owns
 * the document and the command log (AD-2/AD-8); what lives here is the
 * *position* in that log per Tela — how many grouped steps exist and how many
 * are applied — which is the only thing the toolbar needs to answer "is Undo
 * available?" and the only thing switching Telas has to carry across (DS-R4
 * AC-2). Keeping a copy of the commands here would be the duplicate the
 * architecture spends its whole budget avoiding; keeping a cursor is not.
 *
 * A *step* is one grouped entry: a manual edit is one step, and a chat turn
 * that emitted N Commands is also one step (DS-R9 AC-5).
 */

/** One message in a Tela's chat transcript (DS-R10 AC-7). */
export interface StudioChatMessage {
  id: string
  role: 'user' | 'agent'
  text: string
  /**
   * T6.6 / DS-R9 AC-5: the grouped step this turn produced — what `↩ desfazer
   * este turno` reverts. Absent on a user message and on an agent turn that
   * emitted no Commands (there is nothing to undo).
   */
  groupId?: string
  /** How many Commands the turn applied, so the turn can say what it did. */
  changes?: number
}

/**
 * T6.6: the step a single undo would revert — the top of the applied stack.
 *
 * The log is linear (DS-R9), so exactly one turn is undoable at a time: the
 * newest applied one. Offering "desfazer este turno" on an older turn would
 * either be a lie or would silently take the newer edits with it.
 */
export function undoableGroupId(session: ScreenSession): string | null {
  return canUndo(session) ? session.steps[session.cursor - 1] : null
}

export interface ScreenSession {
  /** Group ids, oldest first — one per undoable step. */
  steps: string[]
  /** How many steps are applied. `0` = the Tela as generated. */
  cursor: number
  transcript: StudioChatMessage[]
}

export type ScreenSessions = Readonly<Record<string, ScreenSession>>

export const EMPTY_SESSION: ScreenSession = { steps: [], cursor: 0, transcript: [] }

export function sessionFor(sessions: ScreenSessions, screenId: string | null): ScreenSession {
  return (screenId !== null && sessions[screenId]) || EMPTY_SESSION
}

export function canUndo(session: ScreenSession): boolean {
  return session.cursor > 0
}

export function canRedo(session: ScreenSession): boolean {
  return session.cursor < session.steps.length
}

/**
 * A Tela the user has touched in this session (DS-R4 AC-3). Measured on the
 * log's *length*, not on the cursor: undoing back to the origin does not make
 * the Tela auto-generated again — the user was here.
 */
export function isEdited(session: ScreenSession): boolean {
  return session.steps.length > 0
}

/** Records one step. A new step with the cursor mid-log truncates redo (DS-R9 AC-8). */
export function pushStep(session: ScreenSession, groupId: string): ScreenSession {
  return {
    ...session,
    steps: [...session.steps.slice(0, session.cursor), groupId],
    cursor: session.cursor + 1
  }
}

export function undoStep(session: ScreenSession): ScreenSession {
  return canUndo(session) ? { ...session, cursor: session.cursor - 1 } : session
}

export function redoStep(session: ScreenSession): ScreenSession {
  return canRedo(session) ? { ...session, cursor: session.cursor + 1 } : session
}

/** Immutable update of one Tela's session, leaving every other Tela alone. */
export function withSession(
  sessions: ScreenSessions,
  screenId: string,
  update: (session: ScreenSession) => ScreenSession
): ScreenSessions {
  return { ...sessions, [screenId]: update(sessionFor(sessions, screenId)) }
}
