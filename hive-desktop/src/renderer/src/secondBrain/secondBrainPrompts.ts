import type { RoleAction } from '../ui/ActionRail'

/**
 * The Second Brain slash commands the panel/FAB launch through the normal
 * chat-turn path (`ChatHandle.launchAction`, the same mechanism the Skill
 * Studio uses — D-SB-5). Each is a `RoleAction` whose `command.prompt` is the
 * leading-slash invocation Claude Code resolves to the installed skill; the
 * transcript then shows exactly what ran (`/second-brain-ingest`), like typing
 * it in the composer. Labels/buttons around these live in `i18n/pt-BR.ts`.
 */
function secondBrainCommand(key: string): RoleAction {
  return { key, kind: 'workflow', command: { key, prompt: `/${key}` } }
}

/** SB-R2.2 / SB-R3.3: launch the `/second-brain` setup wizard (scaffolds the vault). */
export const SECOND_BRAIN_SETUP = secondBrainCommand('second-brain')
/** SB-R2.4: file staged raw material into the wiki. */
export const SECOND_BRAIN_INGEST = secondBrainCommand('second-brain-ingest')
/** SB-R2.4: answer a question against the knowledge base. */
export const SECOND_BRAIN_QUERY = secondBrainCommand('second-brain-query')
/** SB-R2.4: health-check / organize the wiki. */
export const SECOND_BRAIN_LINT = secondBrainCommand('second-brain-lint')

/**
 * SB-R9.2: `/second-brain-query <pergunta>` — the ask surface's launch. The
 * question rides **in the slash command itself**, exactly as if it had been
 * typed in the composer, so the transcript reads as the question that was
 * asked rather than a bare command.
 *
 * Whitespace is collapsed to keep the invocation on one line (a pasted
 * multi-line question would otherwise split the command from its argument);
 * an empty question falls back to the bare command, which makes the skill ask
 * what the user wants to know.
 */
export function secondBrainQuery(question: string): RoleAction {
  const normalized = question.replace(/\s+/g, ' ').trim()
  const key = 'second-brain-query'
  return {
    key,
    kind: 'workflow',
    command: { key, prompt: normalized === '' ? `/${key}` : `/${key} ${normalized}` }
  }
}

/**
 * `/second-brain-ingest <arquivo>` **plus the staged text itself** — the
 * ingestion sheet's launch.
 *
 * The material used to be invisible: the sheet wrote it to `raw/` and then
 * launched a *bare* `/second-brain-ingest`, so the transcript showed a command
 * with no trace of what the user had just typed or dictated. Sending the text
 * along is the same choice `secondBrainQuery` makes — what you sent is what
 * the transcript shows — and it is what the `@file` composer does too.
 *
 * The staged path rides on the command line because the skill documents
 * exactly that argument ("if the user specifies a file, use those"), which
 * pins the run to *this* file instead of leaving the skill to rediscover which
 * of `raw/`'s files are unprocessed. Content follows after a blank line, so
 * the invocation itself stays on one line and the renderer can split the two
 * apart (`splitCommandMessage`).
 */
export function secondBrainIngest(relPath: string, content: string): RoleAction {
  const key = 'second-brain-ingest'
  const body = content.trim()
  const invocation = `/${key} ${relPath}`
  return {
    key,
    kind: 'workflow',
    command: { key, prompt: body === '' ? invocation : `${invocation}\n\n${body}` }
  }
}
