/**
 * Turning the skills an agent *mentions* into buttons that run them.
 *
 * ## The gap this closes
 *
 * A reply routinely points at what else is possible — "invoque
 * /bmad-party-mode se quiser múltiplas perspectivas, ou
 * /bmad-advanced-elicitation para explorar mais" — and until now that name
 * was dead text: the same skill is one click away in the slash menu, but
 * reaching it from the sentence that just suggested it meant remembering the
 * exact spelling and retyping it into the composer.
 *
 * ## The rule: a mention is a button only when it names a real skill
 *
 * Same discipline as `filePaths.ts` — an **oracle** built from the
 * workspace's actual skill catalog decides, never the shape of the text.
 * `/bin/bash`, `and/or`, a date written `03/09`, a fraction — none of these
 * survive `Set.has` against real skill keys, so none of them become a
 * button. The candidate pattern itself does most of the rejecting for free:
 * a skill key is letters, digits and hyphens only, so it never matches
 * mid-word (`caminho/arquivo`) or swallows the sentence punctuation that
 * follows it (`/bmad-prd.` stops at the period, no trimming pass needed).
 *
 * Pure and DOM-free: `Markdown` renders what this decides (see
 * `ui/markdown.tsx`), fed by the same catalog that backs the slash menu
 * (`Chat.tsx`'s `skills` state, sourced from `window.hive.skills.list`).
 */

/** Decides whether a candidate (without its leading `/`) names a real workspace skill. */
export interface SkillOracle {
  /** The skill's own key when `candidate` names one, else `null`. */
  has(candidate: string): string | null
}

/** One piece of a text run: prose, or a skill the user can run. */
export type CommandSegment =
  | { kind: 'text'; text: string }
  | {
      kind: 'command'
      /** Exactly what the agent wrote, `/` included — also the label. */
      text: string
      /** The skill's key, as `agent.runWorkflow` expects it. */
      key: string
    }

/**
 * A candidate mention: a `/` not glued to a preceding word or another slash
 * (so `and/or` and `https://…` never start a match here), followed by a
 * skill-shaped name. The character class excludes every punctuation mark a
 * sentence puts right after a name, so nothing needs trimming afterward.
 */
const CANDIDATE = /(?<![\w/])\/([A-Za-z0-9][\w-]*)/g

/**
 * Splits one text run into prose and runnable skill mentions.
 *
 * Returns a single text segment when nothing resolved, so a caller can skip
 * rebuilding a node that did not change — which is most of them.
 */
export function splitCommandMentions(text: string, oracle: SkillOracle): CommandSegment[] {
  const segments: CommandSegment[] = []
  let cursor = 0
  for (const match of text.matchAll(CANDIDATE)) {
    const key = oracle.has(match[1])
    if (key === null) continue
    const start = match.index
    if (start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, start) })
    segments.push({ kind: 'command', text: match[0], key })
    cursor = start + match[0].length
  }
  if (segments.length === 0) return [{ kind: 'text', text }]
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) })
  return segments
}

/** One candidate (with or without its leading `/`) → the skill key it names, or `null`. */
export function resolveCommand(candidate: string, oracle: SkillOracle): string | null {
  const bare = candidate.startsWith('/') ? candidate.slice(1) : candidate
  return oracle.has(bare)
}

/** Builds the oracle over a workspace's loaded skill catalog (`SlashSkill[]` from `SlashMenu.tsx`). */
export function createSkillOracle(skills: readonly { key: string }[]): SkillOracle {
  const keys = new Set(skills.map((skill) => skill.key))
  return {
    has(candidate: string): string | null {
      return keys.has(candidate) ? candidate : null
    }
  }
}
