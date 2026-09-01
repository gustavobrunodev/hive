import { readFileSync } from 'fs'
import type { ProcessRunner } from './processRunner'
import type { AgentOption, OptionSource } from './agentAdapter'

/**
 * Shared machinery for **detecting** what an agent CLI can actually run here,
 * rather than asserting it from a list compiled when the adapter was written
 * (the original C5 decision, now narrowed to a *fallback*).
 *
 * The three adapters each answer the question from a different place, and this
 * module holds only what all three need: read a JSON file without exploding,
 * run a CLI subcommand and parse its JSON, and merge rows from several sources
 * without letting a weaker claim overwrite a stronger one.
 *
 * ## Why detection, and why it degrades instead of failing
 *
 * A curated list is right until the CLI is pointed somewhere else. The bug
 * report was exactly that: Claude's models "parecem estar fixos" — they were,
 * and on Bedrock the four aliases we printed were not the four ids that would
 * run. So every catalog here is layered:
 *
 *   detected (the machine said so) > configured (the user's settings said so)
 *   > catalog (we are guessing, and the picker says we are guessing)
 *
 * and no layer is allowed to leave the picker empty. A probe that times out,
 * exits non-zero or answers with garbage falls back one layer and records a
 * `note`, because a user who can still pick a model and read "não consegui
 * ler do CLI" is better served than one staring at an empty menu.
 */

/** How long a `models list`-style probe may run before we give up on it. */
export const MODEL_PROBE_TIMEOUT_MS = 6000

/** Ranking used to decide which source's copy survives a merge. */
const SOURCE_RANK: Record<OptionSource, number> = { catalog: 0, configured: 1, detected: 2 }

/**
 * Reads and parses a JSON file, answering `null` for every failure mode —
 * missing, unreadable, malformed, or not an object. Detection runs against
 * files the app doesn't own (the CLIs write them, users hand-edit them), so a
 * broken one has to degrade the answer, never the process.
 */
export function readJsonFile<T = Record<string, unknown>>(path: string): T | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return parsed !== null && typeof parsed === 'object' ? (parsed as T) : null
  } catch {
    return null
  }
}

/** A record-shaped read of an unknown value, for walking parsed JSON safely. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** A trimmed non-empty string, or `null` — the shape every env/JSON read wants. */
export function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Runs `<command> <args>` and resolves with its stdout, or `null` when the
 * process failed to start, exited non-zero, or outlived the timeout (in which
 * case it is killed — a hung `models list` must not pin a probe open while the
 * user waits on a picker).
 *
 * Deliberately mirrors `agentRegistry.probeCommand`'s ENOENT contract: the
 * `ProcessRunner` reports a binary that isn't there as `{ code: null, signal:
 * null }`, which is indistinguishable here from "it never ran" — and both mean
 * the same thing to a caller: no answer, use the fallback.
 */
export async function runCapture(
  processRunner: ProcessRunner,
  command: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {}
): Promise<string | null> {
  const handle = processRunner.run(command, args, opts.cwd ? { cwd: opts.cwd } : undefined)
  let stdout = ''
  const collect = (async () => {
    for await (const chunk of handle.output) {
      if (chunk.stream === 'stdout') stdout += chunk.data
    }
  })()
  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), opts.timeoutMs ?? MODEL_PROBE_TIMEOUT_MS)
  )
  const outcome = await Promise.race([handle.exitCode, timeout])
  if (outcome === 'timeout') {
    handle.kill()
    return null
  }
  await collect
  if (outcome.code !== 0) return null
  return stdout
}

/**
 * Pulls the first JSON value out of text that may be prefixed by a banner,
 * an update notice, or an ANSI-coloured spinner line — which CLIs print to
 * stdout more often than their docs admit. Answers `null` when nothing parses.
 */
export function parseJsonLoose(output: string | null): unknown {
  if (output === null) return null
  const direct = tryParse(output)
  if (direct !== undefined) return direct
  // A `[…]`/`{…}` embedded in chatter: take the widest bracketed span, since a
  // nested object would parse on its own and answer the wrong question.
  for (const [open, close] of [
    ['[', ']'],
    ['{', '}']
  ]) {
    const start = output.indexOf(open)
    const end = output.lastIndexOf(close)
    if (start !== -1 && end > start) {
      const parsed = tryParse(output.slice(start, end + 1))
      if (parsed !== undefined) return parsed
    }
  }
  return null
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/**
 * Folds `incoming` rows into `base`, keyed by option id. A row already present
 * keeps its position (the curated order is a designed reading order) but takes
 * the stronger source's copy field by field, so a detected description
 * replaces a curated one while a curated `contextWindow` survives a detected
 * row that didn't mention one.
 */
export function mergeOptions(base: AgentOption[], incoming: AgentOption[]): AgentOption[] {
  const merged = base.map((option) => ({ ...option }))
  const index = new Map(merged.map((option, position) => [option.id, position]))
  for (const option of incoming) {
    const at = index.get(option.id)
    if (at === undefined) {
      index.set(option.id, merged.length)
      merged.push({ ...option })
      continue
    }
    merged[at] = preferStronger(merged[at], option)
  }
  return merged
}

/** Field-by-field merge of two rows for the same model, stronger source winning. */
function preferStronger(current: AgentOption, incoming: AgentOption): AgentOption {
  const currentRank = SOURCE_RANK[current.source ?? 'catalog']
  const incomingRank = SOURCE_RANK[incoming.source ?? 'catalog']
  const winner = incomingRank >= currentRank ? incoming : current
  const loser = winner === incoming ? current : incoming
  return {
    ...loser,
    ...stripUndefined(winner),
    // Curated copy is a translation key; a detected description is the
    // machine's own words. Keeping both would render twice, so the winner's
    // choice of channel clears the other one.
    ...(winner.description ? { descriptionKey: undefined } : {}),
    ...(winner.descriptionKey ? { description: undefined } : {}),
    contextWindow: winner.contextWindow ?? loser.contextWindow,
    traits: winner.traits ?? loser.traits,
    source: incomingRank >= currentRank ? incoming.source : current.source
  }
}

function stripUndefined(option: AgentOption): AgentOption {
  return Object.fromEntries(
    Object.entries(option).filter(([, value]) => value !== undefined)
  ) as AgentOption
}

/** The strongest provenance present in a list — what the footer is allowed to claim. */
export function strongestSource(options: AgentOption[]): OptionSource {
  return options.reduce<OptionSource>((strongest, option) => {
    const source = option.source ?? 'catalog'
    return SOURCE_RANK[source] > SOURCE_RANK[strongest] ? source : strongest
  }, 'catalog')
}

/**
 * The id of the "let the CLI decide" row. The empty string, not a sentinel
 * word, because that is what it *means* downstream: `buildArgs` omits
 * `--model` for a falsy value, so this row is the one option whose behaviour
 * needs no special case anywhere in the adapters.
 */
export const CLI_DEFAULT_ID = ''
