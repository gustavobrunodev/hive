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
