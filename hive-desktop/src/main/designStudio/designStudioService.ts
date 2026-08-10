/**
 * Design Studio (M18) — T5.1. The facade the tab dispatches through.
 *
 * The document lives here, in main, and not in the renderer, for one reason
 * that is not organisational: `validate()` is the only gate between a surface
 * and the document (AD-2 — the reducer applies without checking), and
 * `validate()` belongs to the active `DesignSystemAdapter`, which reads a
 * catalog off disk and therefore cannot exist in the renderer at all. A
 * renderer-side copy of the document would be a second place edits could land
 * without passing that gate.
 *
 * What is kept per Screen is the **log**, never a snapshot: the document handed
 * back is always `replay(origin, log)` (AD-8, DS-R9 AC-4). Undo is the cursor
 * moving, and two callers asking for the same cursor get byte-identical
 * documents.
 *
 * A batch is **all-or-nothing**: every command is validated against the
 * document as the batch would leave it, and the first violation returns with
 * nothing pushed. One manual edit is a batch of one, so the Inspector's
 * "invalid value leaves the document unchanged" (DS-R6 AC-4) and the Chat's
 * "no Command is dispatched" (DS-R11 AC-3) are the same code path rather than
 * two rules that could drift.
 */

import type {
  CapabilityViolation,
  Command,
  CommandLog,
  ComponentCatalog,
  ScreenDocument
} from './types'
import type { DesignSystemAdapter } from './dsAdapter/types'
import { applyCommand, emptyLog, pushCommands, redo, replay, undo } from './screenDocument'

/** What a surface needs to paint after any operation: the document and the two history affordances. */
export interface ScreenView {
  document: ScreenDocument
  canUndo: boolean
  canRedo: boolean
}

/** The origin a Screen's log replays from, plus the log itself. */
interface ScreenEntry {
  origin: ScreenDocument
  log: CommandLog
}

export interface DesignStudioService {
  /** DS-R13: the one source of truth every surface reads. */
  catalog(): ComponentCatalog
  /** The Screen as it stands, creating an empty one on first ask. */
  view(key: string, screenId: string, title: string): ScreenView
  /** Validates the whole batch, then pushes it as ONE undoable step (AD-8). */
  dispatch(
    key: string,
    screenId: string,
    title: string,
    commands: Command[],
    groupId: string
  ): ScreenView | CapabilityViolation
  undo(key: string, screenId: string, title: string): ScreenView
  redo(key: string, screenId: string, title: string): ScreenView
}

function originFor(screenId: string, title: string): ScreenDocument {
  return { screenId, title, root: null }
}

function viewOf(entry: ScreenEntry): ScreenView {
  return {
    document: replay(entry.origin, entry.log),
    canUndo: entry.log.cursor > 0,
    canRedo: entry.log.cursor < entry.log.entries.length
  }
}

/**
 * Builds the service over a lazily-resolved adapter.
 *
 * The adapter arrives as a thunk because resolving it reads a ~110 KB catalog
 * from `resources/`, and the app boots long before anyone opens the Studio.
 * The registry memoises, so the thunk may be called freely (DS-R12 AC-6).
 */
export function createDesignStudioService(
  getAdapter: () => DesignSystemAdapter
): DesignStudioService {
  const screens = new Map<string, ScreenEntry>()

  function ensure(key: string, screenId: string, title: string): ScreenEntry {
    const existing = screens.get(key)
    if (existing) return existing
    const created: ScreenEntry = { origin: originFor(screenId, title), log: emptyLog() }
    screens.set(key, created)
    return created
  }

  /** Moves one Screen's cursor. A Screen nobody has edited yet simply has nowhere to move. */
  function step(
    key: string,
    screenId: string,
    title: string,
    move: (log: CommandLog) => CommandLog
  ): ScreenView {
    const entry = ensure(key, screenId, title)
    const moved: ScreenEntry = { ...entry, log: move(entry.log) }
    screens.set(key, moved)
    return viewOf(moved)
  }

  return {
    catalog: () => getAdapter().catalog(),

    view: (key, screenId, title) => viewOf(ensure(key, screenId, title)),

    dispatch(key, screenId, title, commands, groupId) {
      const entry = ensure(key, screenId, title)
      const adapter = getAdapter()
      // Validated against the document as each earlier command in the batch
      // would have left it — a batch whose second command depends on its first
      // is valid, and one whose second command is not is rejected whole.
      let projected = replay(entry.origin, entry.log)
      for (const command of commands) {
        const violation = adapter.validate(command, projected)
        if (violation) return violation
        projected = applyCommand(projected, command)
      }
      const next: ScreenEntry = { ...entry, log: pushCommands(entry.log, commands, groupId) }
      screens.set(key, next)
      return viewOf(next)
    },

    undo: (key, screenId, title) => step(key, screenId, title, undo),
    redo: (key, screenId, title) => step(key, screenId, title, redo)
  }
}
