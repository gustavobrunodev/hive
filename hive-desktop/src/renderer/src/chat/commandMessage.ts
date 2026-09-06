import { composerBackdrop } from './composerBackdrop'
import { knownCommandToken } from './slashCommands'
import type { SkillOracle } from './commandMentions'

/**
 * Marking, inside a *sent* user message, the runs that name something real.
 *
 * ## What this replaced, and why
 *
 * A message that opened with a slash command used to stop being a message: it
 * lost the bubble entirely and became a two-part "invocation" object — an
 * outlined token above a detached body. Three things were wrong with it.
 * Nobody could tell at a glance which half they had written, because the halves
 * no longer shared a container; the transcript's rhythm broke every time a
 * shortcut was used, since one row in it was shaped unlike every other; and the
 * command name — the one run that has to survive — was the part that got
 * ellipsised, because it shared a single line with arguments that were free to
 * grow. `/bmad-prd revisar o escopo…` rendered as `/bmad-…` followed by the
 * whole sentence.
 *
 * A sent message is now always a message. What changes inside it is only the
 * *marking*: the command that launched the turn, and every `@path` that names
 * a file which really exists, are drawn as tokens in place.
 *
 * ## The segmentation is the composer's own
 *
 * Deliberately built on `composerBackdrop`, the same pure function that paints
 * the pills under the caret while the message is still being typed. Sending is
 * then a purely visual promotion — the bubble marks exactly what the composer
 * marked, token for token — and the two can never drift into disagreeing about
 * what counted as a command or a file. Both are gated on oracles, so a
 * `/bmda-prd` typo and an `@arquivo` that doesn't exist stay plain prose in
 * both places.
 *
 * Pure and component-free: a `.tsx` file exporting a non-component trips
 * `react-refresh/only-export-components` (the `gitStatus.ts` precedent).
 */

/** What a run of a sent message turns out to be. */
export type UserSegmentKind =
  /** Ordinary prose. */
  | 'text'
  /** The leading `/name` that launched this turn. */
  | 'command'
  /** An `@path` that resolves to a real workspace file. */
  | 'file'

/** One run of a sent message, with the claim it makes. */
export interface UserSegment {
  kind: UserSegmentKind
  text: string
}

/**
 * Splits a sent message into prose, its leading command and its file
 * references.
 *
 * The runs concatenate back to `text` character for character — the same
 * contract `composerBackdrop` is tested against, and the reason this delegates
 * to it instead of re-deriving the split. A message with nothing to mark comes
 * back as a single `text` run, which is the common case and costs one node.
 *
 * Only the *leading* command is marked. A skill named mid-sentence is
 * something the user wrote *about*; the one at the head is the one that ran,
 * and giving both the same token would claim two different things with one
 * mark.
 */
export function userMessageSegments(
  text: string,
  knownFiles: ReadonlySet<string>,
  oracle: SkillOracle
): UserSegment[] {
  const token = knownCommandToken(text, oracle)
  const range = token === null ? null : ([token.start, token.end] as const)
  return composerBackdrop(text, knownFiles, null, null, range).map((segment) => ({
    kind: segment.command ? 'command' : segment.mention ? 'file' : 'text',
    text: segment.text
  }))
}

/**
 * Messages longer than this collapse behind a "show everything" toggle. A
 * pasted article or a ten-minute transcript is legitimately thousands of
 * characters; left unclamped it buries the conversation it started. The cut is
 * on characters rather than lines because one unwrapped paragraph is just as
 * tall as many short ones.
 */
export const LONG_MESSAGE_CHARS = 600

/** Whether a sent message is long enough to be worth collapsing. */
export function isLongMessage(text: string): boolean {
  return text.length > LONG_MESSAGE_CHARS
}
