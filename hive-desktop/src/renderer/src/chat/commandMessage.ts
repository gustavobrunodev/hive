/**
 * Splitting a sent user message into "what was invoked" and "what was said".
 *
 * A turn launched from a surface like the ingestion sheet is both at once: the
 * slash command that resolves to a skill, and the material the user actually
 * wrote or dictated. Rendering the whole thing as one run of text hides which
 * half is which — the reason this module exists is so the transcript can give
 * the two different visual weight (`.wb-command-token` vs the prose bubble)
 * while still showing, verbatim, everything that was sent.
 *
 * Pure and component-free: a `.tsx` file exporting a non-component trips
 * `react-refresh/only-export-components` (the `gitStatus.ts` precedent).
 */

/** A user message whose first line is a slash command. */
export interface CommandMessage {
  /** Command name without the leading slash (`second-brain-ingest`). */
  command: string
  /** The remainder of the command's own line — a path, a question — or `''`. */
  args: string
  /** Prose that followed on later lines, or `''` for a bare invocation. */
  body: string
}

/**
 * The command line itself: a leading `/name`, optionally followed by arguments.
 * Anchored to one line so a message that merely *mentions* a slash somewhere in
 * its prose is never mistaken for an invocation.
 */
const COMMAND_LINE = /^\/([A-Za-z0-9][\w:-]*)(?:[ \t]+(\S[^\n]*))?$/

/**
 * Splits `text` into command / args / body, or returns `null` when the message
 * is ordinary prose. `null` is the signal to render a plain user bubble.
 */
export function splitCommandMessage(text: string): CommandMessage | null {
  const newline = text.indexOf('\n')
  const firstLine = newline === -1 ? text : text.slice(0, newline)
  const match = COMMAND_LINE.exec(firstLine.trimEnd())
  if (!match) return null
  return {
    command: match[1],
    args: match[2]?.trim() ?? '',
    body: newline === -1 ? '' : text.slice(newline + 1).trim()
  }
}

/**
 * Bodies longer than this collapse behind a "show everything" toggle. A pasted
 * article or a ten-minute transcript is legitimately thousands of characters;
 * left unclamped it buries the conversation it started. The cut is on
 * characters rather than lines because one unwrapped paragraph is just as tall
 * as many short ones.
 */
export const LONG_BODY_CHARS = 600

/** Whether a body is long enough to be worth collapsing. */
export function isLongBody(body: string): boolean {
  return body.length > LONG_BODY_CHARS
}
