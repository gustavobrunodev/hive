/**
 * The composer's `/command` vocabulary: what a leading slash can name, where
 * the token is, how picking one completes it, and what a sent line means.
 *
 * ## Why picking a command no longer sends it
 *
 * The menu used to *launch*: highlight `/bmad-prd`, press Enter, and the turn
 * was already gone. That made the one thing users actually want to do —
 * `/bmad-prd Eu quero criar uma PRD` — unreachable through the menu, because
 * the menu never gave the line back. Selecting now **completes** the token and
 * leaves the caret after it, which is what every editor's completion does and
 * what `@` mentions in this same composer already did. Enter still sends; it
 * is simply a second, deliberate press.
 *
 * ## Two kinds of command, one grammar
 *
 * A workspace **skill** (`/bmad-prd`) is BMAD's; a **built-in** (`/compact`) is
 * the app's own — it drives the agent's context compaction rather than starting
 * a workflow. They share the token, the menu and the completion, and they are
 * separated at exactly one point: what a send does with them
 * (`resolveComposerCommand`). Keeping the grammar common is what makes the
 * distinction invisible where it should be and sharp where it matters.
 *
 * Pure and DOM-free: `Chat` owns the wiring, `SlashMenu` owns the rendering.
 */

import { t } from '../i18n'
import { COMPACT_COMMAND } from './compaction'
import type { SkillOracle } from './commandMentions'

/**
 * Structural mirror of `main/workflowCatalog.ts`'s `SkillEntry` — the shape
 * `window.hive.skills.list` answers with, and the raw material of the menu's
 * skill half.
 */
export interface SlashSkill {
  key: string
  label: string
  description: string
}

/** Where a command came from — the menu's two sections, and the styling split. */
export type SlashKind = 'builtin' | 'skill'

/** One row of the slash menu, whatever it came from. */
export interface SlashCommand {
  /** The name after the slash — what is completed, and what a send resolves. */
  key: string
  kind: SlashKind
  /** Human name. A skill's display name; a built-in's curated copy. */
  label: string
  /** One line, shown muted under the command and matched by the query. */
  description: string
  /**
   * What may follow the command on its own line, when anything may. Rendered
   * as ghost text on the row so an argument that changes the result is
   * discoverable — `/compact` alone is a very different act from `/compact
   * foque nas decisões de arquitetura`, and nothing on screen said so.
   */
  argHint?: string
}

/**
 * The commands Hive provides itself.
 *
 * `compact` is deliberately the same name Claude Code and Devin already
 * answer to. Users arrive with the muscle memory; inventing `/compactar` would
 * have cost them that for nothing, and the string is also what gets sent to
 * the CLI, which only knows the English one.
 */
export const BUILT_IN_COMMANDS: readonly SlashCommand[] = [
  {
    key: COMPACT_COMMAND,
    kind: 'builtin',
    label: t('compaction.commandLabel'),
    description: t('compaction.commandDescription'),
    argHint: t('compaction.commandArgHint')
  }
]

/**
 * Every command the composer offers, built-ins first.
 *
 * Built-ins lead because there are one or two of them against thirty-odd
 * skills: put them after and they are below the fold of a menu that opens on a
 * bare `/`, which is the only moment they can be discovered.
 */
export function slashCatalog(
  skills: readonly SlashSkill[],
  opts?: { compaction?: boolean }
): SlashCommand[] {
  const builtins = opts?.compaction === false ? [] : BUILT_IN_COMMANDS
  return [
    ...builtins,
    ...skills.map((skill): SlashCommand => ({
      key: skill.key,
      kind: 'skill',
      label: skill.label,
      description: skill.description
    }))
  ]
}

/**
 * The open slash query — a leading `/` with no space after it yet — or `null`.
 *
 * Anchored to the whole value on purpose: a `/` in the middle of a sentence is
 * a date, a path or a fraction, not an invocation, and opening a command
 * palette over someone's prose is the failure mode this narrowness avoids.
 */
export function slashQueryOf(value: string): string | null {
  const match = /^\/(\S*)$/.exec(value)
  return match ? match[1] : null
}

/**
 * Ranks the catalog against what has been typed after the slash.
 *
 * Prefix beats substring beats the description, and built-ins keep their lead
 * only within a tier — a query that prefixes a skill's name must not be
 * outranked by a built-in it merely appears inside. Order within a tier is the
 * catalog's own, so the list never reshuffles under the cursor for reasons the
 * user cannot see.
 */
export function filterSlashCommands(
  catalog: readonly SlashCommand[],
  query: string | null
): SlashCommand[] {
  if (query === null) return []
  const needle = query.toLowerCase()
  if (needle === '') return [...catalog]
  const scored: Array<{ command: SlashCommand; score: number; index: number }> = []
  catalog.forEach((command, index) => {
    const key = command.key.toLowerCase()
    const score = key.startsWith(needle)
      ? 3
      : key.includes(needle)
        ? 2
        : command.label.toLowerCase().includes(needle) ||
            command.description.toLowerCase().includes(needle)
          ? 1
          : 0
    if (score > 0) scored.push({ command, score, index })
  })
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored.map((entry) => entry.command)
}

/**
 * The command token a value opens with: `/name`, plus whatever rode on the
 * rest of that first line. `null` for ordinary prose.
 *
 * Deliberately the same shape `splitCommandMessage` recognises in a *sent*
 * message, so the pill under the caret and the token in the transcript can
 * never disagree about what counts as an invocation.
 */
export interface CommandToken {
  /** The name without its slash. */
  name: string
  /** `[start, end)` of `/name` in the value — the run the backdrop paints. */
  start: number
  end: number
  /** The rest of the command's own line, trimmed, or `''`. */
  args: string
}

/** Matches a leading `/name`, then optional arguments, on the first line only. */
const LEADING_COMMAND = /^\/([A-Za-z0-9][\w:-]*)(?=$|[\s])/

export function commandTokenAt(value: string): CommandToken | null {
  const newline = value.indexOf('\n')
  const firstLine = newline === -1 ? value : value.slice(0, newline)
  const match = LEADING_COMMAND.exec(firstLine)
  if (!match) return null
  return {
    name: match[1],
    start: 0,
    end: match[0].length,
    args: firstLine.slice(match[0].length).trim()
  }
}

/**
 * Completes the open slash query with `key`, leaving one trailing space and
 * the caret after it.
 *
 * The space is the point: the completion's job is to hand the line back ready
 * for the sentence that follows it. Anything already typed past the token —
 * text pasted before the command was completed — is kept.
 */
export function completeCommand(value: string, key: string): { value: string; caret: number } {
  const newline = value.indexOf('\n')
  const firstLine = newline === -1 ? value : value.slice(0, newline)
  const rest = newline === -1 ? '' : value.slice(newline)
  const match = /^\/\S*/.exec(firstLine)
  const tail = match ? firstLine.slice(match[0].length) : firstLine
  const inserted = `/${key} `
  // A tail that already starts with a space would leave two after the
  // completion — the token has one of its own now.
  const next = `${inserted}${tail.replace(/^\s+/, '')}${rest}`
  return { value: next, caret: inserted.length }
}

/** What a sent composer line turns out to be. */
export type ComposerIntent =
  /** A workspace skill: runs as a workflow, args and all. */
  | { kind: 'skill'; key: string; text: string }
  /** A built-in: handled by the app, never forwarded as prose. */
  | { kind: 'builtin'; key: string; args: string; text: string }
  /** Ordinary prose (including a `/name` that names nothing installed). */
  | { kind: 'message' }

/**
 * Reads a sent line as what it is.
 *
 * The oracle decides, never the shape of the text — same discipline as `@`
 * mentions and as `commandMentions.ts`. A `/typo` that resolves to nothing is
 * a message: it goes to the agent verbatim, which is both the honest reading
 * and the one that lets someone talk *about* a command.
 */
export function resolveComposerIntent(
  text: string,
  oracle: SkillOracle,
  opts?: { compaction?: boolean }
): ComposerIntent {
  const token = commandTokenAt(text)
  if (token === null) return { kind: 'message' }
  if (token.name === COMPACT_COMMAND && opts?.compaction !== false) {
    return { kind: 'builtin', key: token.name, args: token.args, text }
  }
  const key = oracle.has(token.name)
  return key === null ? { kind: 'message' } : { kind: 'skill', key, text }
}

/**
 * Does this composer value open with a command that really exists? The
 * backdrop's pill hangs off this, so a `/typo` never dresses itself up as an
 * installed skill.
 */
export function knownCommandToken(
  value: string,
  oracle: SkillOracle,
  opts?: { compaction?: boolean }
): CommandToken | null {
  const token = commandTokenAt(value)
  if (token === null) return null
  if (token.name === COMPACT_COMMAND && opts?.compaction !== false) return token
  return oracle.has(token.name) === null ? null : token
}
