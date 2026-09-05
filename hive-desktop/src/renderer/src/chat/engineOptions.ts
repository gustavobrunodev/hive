import { t } from '../i18n'
import { modelDescription, modelGroupLabel, providerLabel } from '../i18n/pt-BR'

/**
 * The engine control's data layer: the capability shape as it crosses IPC, and
 * the pure functions that turn it into what the picker shows.
 *
 * Split out of `EnginePicker.tsx` so the component file exports a component and
 * nothing else (React Fast Refresh only works that way), and because these are
 * the parts worth testing without a DOM: which group a row lands in, which copy
 * channel wins, what the provenance line claims.
 */

/** Structural mirror of `main/agentAdapter.ts`'s `AgentOption`. */
export interface EngineOption {
  /** `''` is meaningful: the "let the CLI decide" row, sent as no flag at all. */
  id: string
  label: string
  contextWindow?: number
  /** A description **the machine wrote** — passed through verbatim. */
  description?: string
  /** An i18n key for curated copy, preferred over `description` when present. */
  descriptionKey?: string
  vendor?: string
  source?: 'detected' | 'configured' | 'catalog'
  traits?: string[]
  group?: string
  /** What an alias really resolves to, when that is knowable. */
  resolvedId?: string
  /** Other names this same row answers to — matched by the search field, never shown. */
  aliases?: string[]
  /** The id of this same rung at priority capacity (same thinking, ~2× price). */
  fastId?: string
  /** This model's own effort ladder, when the agent's efforts are per model (Devin). */
  efforts?: EngineOption[]
}

/** Structural mirror of `main/agentAdapter.ts`'s `AgentCapabilities`. */
export interface EngineCapabilities {
  models: EngineOption[]
  efforts: EngineOption[]
  supportsAttachments: boolean
  provider?: { id: string; detail?: string | null }
  modelSource?: 'detected' | 'configured' | 'catalog'
  defaults?: { model: string | null; effort: string | null }
  note?: 'cli-missing' | 'probe-failed' | 'no-listing'
  cliVersion?: string | null
  /**
   * context-compaction: what this agent does about a filling context window,
   * as its adapter *measured* on the transport Hive drives. Optional because a
   * capability payload written before this field simply doesn't say — and the
   * safe reading of silence is `NO_COMPACTION` (see `chat/compaction.ts`).
   */
  compaction?: { command: boolean; automatic: boolean }
}

/**
 * Which option a freshly-loaded (or re-detected) list should start on.
 *
 * Order of preference, and each step is a decision:
 *  1. what the user picked for this agent before, **if it still exists** — a
 *     model can vanish between two detections (a provider switch, an account
 *     change), and silently keeping a dead id would fail on the next turn;
 *  2. the "let the CLI decide" row, so Hive stops overriding the model the
 *     user configured in their own CLI — the old behaviour picked whatever was
 *     first in the list and sent it as `--model` forever after;
 *  3. the first row, for an adapter that offers no default row;
 *  4. `null`, for an empty list (no control is rendered).
 */
export function pickInitial(options: EngineOption[], remembered?: string): string | null {
  if (remembered !== undefined && options.some((option) => option.id === remembered)) {
    return remembered
  }
  if (options.some((option) => option.id === '')) return ''
  return options[0]?.id ?? null
}

/**
 * The effort ladder in force right now.
 *
 * Two agents, two shapes, one control. Claude's `--effort` is agent-wide, so
 * its ladder lives on the capabilities. Devin has no effort flag at all: its
 * reasoning levels are *variants of a model*, so each row carries its own
 * ladder and the one that counts is the selected row's.
 *
 * A model with no ladder of its own falls back to the agent's, which is what
 * keeps Claude (and Copilot, whose ladder is empty) working unchanged.
 */
export function effortsFor(capabilities: EngineCapabilities, model: string | null): EngineOption[] {
  const selected = capabilities.models.find((option) => option.id === model)
  return selected?.efforts ?? capabilities.efforts
}

/**
 * The rung to land on after switching models, when the two models have
 * different ladders.
 *
 * Someone reading at "Máximo" who switches from Opus to Sonnet meant to change
 * the model, not to quietly drop back to the default thinking budget — so the
 * *position on the ladder* is carried across by name, and only falls back to
 * the delegated rung when the new model has nothing by that name. Ids can't be
 * carried: `claude-opus-5-max` is not a thing Sonnet accepts.
 */
export function carryEffort(
  previous: EngineOption[],
  effort: string | null,
  next: EngineOption[]
): string | null {
  if (previous === next) return pickInitial(next, effort ?? undefined)
  const label = previous.find((option) => option.id === effort)?.label
  const matched = label ? next.find((option) => option.label === label) : undefined
  return matched?.id ?? pickInitial(next)
}

/**
 * The priority-capacity axis, read off a ladder.
 *
 * Devin ships each reasoning level twice — `claude-opus-5-max` and
 * `claude-opus-5-max-fast` — the second being the same budget served from a
 * reserved pool at about double the price. That is a *second axis*, and the
 * catalog folds each twin onto the rung it twins (`fastId`) rather than
 * doubling the ladder, because thirteen columns in a ~48px-per-column ramp
 * truncated "Máximo" and "Máximo · rápido" into "Máximo" and "Máxi…".
 *
 * `available` is what decides whether the switch is rendered at all; `on` reads
 * the current value, which may be either half of a pair.
 */
export function fastCapacity(
  efforts: EngineOption[],
  effort: string | null
): { available: boolean; on: boolean } {
  const available = efforts.some((rung) => rung.fastId !== undefined)
  return { available, on: available && efforts.some((rung) => rung.fastId === effort) }
}

/**
 * The rung id to send for `rung`, at the capacity currently chosen — and the
 * identity of a rung whichever half of the pair the value happens to be.
 */
export function atCapacity(rung: EngineOption | undefined, fast: boolean): string | null {
  if (!rung) return null
  return fast && rung.fastId !== undefined ? rung.fastId : rung.id
}

/** The base rung a value names, whether it is the rung itself or its fast twin. */
export function baseRung(efforts: EngineOption[], effort: string | null): EngineOption | undefined {
  return efforts.find((rung) => rung.id === effort || rung.fastId === effort)
}

/** Curated copy when the row carries a key; the machine's own words otherwise. */
export function describeOption(option: EngineOption | null): string | null {
  if (!option) return null
  return modelDescription(option.descriptionKey) ?? option.description ?? null
}

/** `200000` → `200k`, `1000000` → `1M`. A denominator, not an exact count. */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.round(tokens / 100_000) / 10}M`.replace('.0', '')
  return `${Math.round(tokens / 1000)}k`
}

/**
 * Vendor grouping is earned, not assumed: it only helps when there is more than
 * one vendor to tell apart (Copilot, Devin). For a single-vendor CLI it would
 * put every row under one redundant header and bury the tier ordering that
 * actually helps the choice.
 */
export function distinctVendors(models: EngineOption[]): string[] {
  return [...new Set(models.map((option) => option.vendor).filter(Boolean))] as string[]
}

/** The group order and headers for a model list, keyed on how it is grouped. */
export function groupsFor(models: EngineOption[]): { id: string; label?: string }[] {
  const vendors = distinctVendors(models)
  if (vendors.length > 1) {
    return [{ id: 'default' }, ...vendors.map((vendor) => ({ id: vendor, label: vendor }))]
  }
  return ['default', 'recommended', 'more', 'legacy'].map((id) => {
    const label = modelGroupLabel(id)
    return label ? { id, label } : { id }
  })
}

/** Which bucket one row lands in under the grouping `groupsFor` chose. */
export function groupOf(option: EngineOption, byVendor: boolean): string {
  if (!byVendor) return option.group ?? 'more'
  return option.group === 'default' ? 'default' : (option.vendor ?? '')
}

/**
 * "Where this list came from", plus the backend it applies to — the line that
 * makes the picker checkable instead of a claim to be taken on faith.
 */
export function sourceLine(capabilities: EngineCapabilities): string {
  const source =
    capabilities.modelSource === 'detected'
      ? t('chat.engine.sourceDetected')
      : capabilities.modelSource === 'configured'
        ? t('chat.engine.sourceConfigured')
        : t('chat.engine.sourceCatalog')
  const provider = capabilities.provider
  if (!provider) return source
  const detail = provider.detail ? ` (${provider.detail})` : ''
  return `${source} · ${providerLabel(provider.id)}${detail}`
}

/** Why detection fell short, said in the product's own words. */
export function noteLine(note: NonNullable<EngineCapabilities['note']>): string {
  if (note === 'cli-missing') return t('chat.engine.noteCliMissing')
  if (note === 'probe-failed') return t('chat.engine.noteProbeFailed')
  return t('chat.engine.noteNoListing')
}
