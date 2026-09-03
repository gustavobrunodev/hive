import { join } from 'path'
import type { AgentCapabilities, AgentOption, CapabilityNote, ModelTrait } from './agentAdapter'
import type { ProcessRunner } from './processRunner'
import {
  CLI_DEFAULT_ID,
  asRecord,
  asText,
  parseJsonLoose,
  readJsonFile,
  runCapture,
  strongestSource
} from './modelCatalog'

/**
 * Devin's models — and, in the same breath, its **reasoning ladder**, which is
 * the half of the bug report that no amount of listing more rows would fix.
 *
 * ## What `devin models list --format json` actually answers
 *
 * Measured against the installed `devin 3000.6.14`, not inferred from prose.
 * The output is **not** a flat array, and it is not under `models`/`data`/
 * `items`/`results` either — every key this module used to look for. It is:
 *
 * ```json
 * { "families": [
 *     { "family_label": "Claude Opus 5",
 *       "family_uid":   "claude-opus-5",
 *       "slug":         "claude-opus-5",
 *       "aliases":      ["opus"],
 *       "variants": [
 *         { "model_uid": "claude-opus-5-medium", "label": "Claude Opus 5 Medium",
 *           "max_context_tokens": 1000000, "max_output_tokens": 128000,
 *           "cost_tier": "High cost", "cost_summary": "$5 / 1M Input · …",
 *           "is_new": false, "is_beta": false },
 *         …low, high, xhigh, max, and their `-fast` twins…
 *       ] } ] }
 * ```
 *
 * So the parser answered `null` for the real shape, and the picker fell back to
 * a seven-row hand-written list from months ago — the reported "modelos não são
 * todos listados". The machine offers **43 families**.
 *
 * ## Why a family is a model and a variant is an effort
 *
 * The variants of a family are not different models. `claude-opus-5-low` and
 * `claude-opus-5-max` are the same model at two thinking budgets — the CLI's
 * own docs call them "reasoning / thinking levels" and bind them to `Alt+T`
 * during a session. Devin just has no second flag for it: `--model` takes
 * either a family slug or a variant id, and both are accepted (verified live:
 * `--model claude-sonnet-5` and `--model claude-sonnet-5-high` both run).
 *
 * That is exactly the two-axis control Hive already draws — a model list plus
 * an effort ramp — so this module splits the axis back apart:
 *
 *   - **model row** = the family, addressed by its `slug` (the ids the CLI
 *     lists back when it rejects an unknown one),
 *   - **effort rungs** = the family's variants, carried on that row as
 *     `AgentOption.efforts`, each rung's id being the full `model_uid`.
 *
 * The Devin adapter then sends `--model <rung ?? family>`, which is the one
 * flag the CLI has. A family with a single variant grows no ladder — a
 * one-rung ramp is a control that cannot be moved.
 *
 * Everything is read defensively: the schema is undocumented, so a family that
 * carries no usable id is skipped rather than crashing the picker, and a
 * failure at any point falls back to `DEVIN_CATALOG` with a `probe-failed`
 * note.
 */

/** Devin's own default when its config says nothing, per the CLI's config docs. */
const DEVIN_STOCK_DEFAULT = 'adaptive'

/**
 * The fallback list, for the machine where `devin` isn't installed yet — the
 * picker still has to render something for an agent the user is considering.
 *
 * Short names only: Devin documents that `opus`, `sonnet`, `swe`, `codex` and
 * `gemini` "always resolve to the latest version in that model family", which
 * is the right thing to pin in a list that can go stale. Unlike a dated id, a
 * family name keeps meaning the same thing.
 */
export const DEVIN_CATALOG: AgentOption[] = [
  {
    id: 'adaptive',
    label: 'Adaptive',
    descriptionKey: 'devin.adaptive',
    vendor: 'Cognition',
    traits: ['router'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'swe',
    label: 'SWE',
    descriptionKey: 'devin.swe',
    vendor: 'Cognition',
    traits: ['balanced'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'opus',
    label: 'Opus',
    descriptionKey: 'devin.opus',
    vendor: 'Anthropic',
    traits: ['flagship', 'thinking'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'sonnet',
    label: 'Sonnet',
    descriptionKey: 'devin.sonnet',
    vendor: 'Anthropic',
    traits: ['balanced', 'thinking'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'gpt',
    label: 'GPT',
    descriptionKey: 'devin.gpt',
    vendor: 'OpenAI',
    traits: ['flagship'],
    group: 'more',
    source: 'catalog'
  },
  {
    id: 'codex',
    label: 'Codex',
    descriptionKey: 'devin.codex',
    vendor: 'OpenAI',
    traits: ['balanced'],
    group: 'more',
    source: 'catalog'
  },
  {
    id: 'gemini',
    label: 'Gemini',
    descriptionKey: 'devin.gemini',
    vendor: 'Google',
    traits: ['balanced'],
    group: 'more',
    source: 'catalog'
  }
]

export interface DevinCatalogDeps {
  processRunner: ProcessRunner
  env: NodeJS.ProcessEnv
  home: string
  platform: NodeJS.Platform
  workspace?: string
  readJson?: <T>(path: string) => T | null
}

/**
 * Asks the installed `devin` for its model list, falling back to the catalog.
 * Never rejects: an agent whose CLI is missing still renders a picker, marked
 * `cli-missing`, because the user is allowed to look before they install.
 */
export async function detectDevinCapabilities(deps: DevinCatalogDeps): Promise<AgentCapabilities> {
  const readJson = deps.readJson ?? readJsonFile
  const configured = configuredDefault(deps, readJson)
  const listed = await listModels(deps)

  const models = listed === null ? [...DEVIN_CATALOG] : listed
  const note: CapabilityNote | undefined = listed === null ? 'probe-failed' : undefined

  const withDefault = [defaultRow(configured), ...models]
  return {
    models: withDefault,
    // Devin's effort ladder is a property of the *model*, not of the agent:
    // each family carries its own rungs on `AgentOption.efforts`. So there is
    // no agent-wide ladder to declare, and the picker reads the selected row.
    efforts: [],
    supportsAttachments: true,
    provider: { id: 'cognition', detail: null },
    modelSource: strongestSource(withDefault),
    defaults: { model: configured ?? DEVIN_STOCK_DEFAULT, effort: null },
    ...(note ? { note } : {})
  }
}

function defaultRow(configured: string | null): AgentOption {
  return {
    id: CLI_DEFAULT_ID,
    label: 'Automático',
    descriptionKey: 'cliDefault',
    traits: ['cli-default'],
    group: 'default',
    source: configured ? 'configured' : 'catalog',
    resolvedId: configured ?? DEVIN_STOCK_DEFAULT
  }
}

/**
 * `devin models list --format json`. Returns `null` — meaning "no answer" —
 * for every failure, which is what makes the caller's fallback unambiguous:
 * an empty array would be a CLI that genuinely has no models, and that is a
 * different (and so far hypothetical) story.
 */
async function listModels(deps: DevinCatalogDeps): Promise<AgentOption[] | null> {
  const output = await runCapture(
    deps.processRunner,
    'devin',
    ['models', 'list', '--format', 'json'],
    deps.workspace ? { cwd: deps.workspace } : {}
  )
  const families = toFamilies(parseJsonLoose(output))
  if (families === null) return null
  const rows = families.map(toFamilyOption).filter((row): row is AgentOption => row !== null)
  return rows.length > 0 ? rows : null
}

/**
 * The family list, from the real `{ families: [...] }` envelope or from any of
 * the flatter shapes an older/newer CLI might answer with. A bare array is
 * accepted too — the schema is undocumented, and a parser that only knows one
 * spelling is how this module got the bug it is fixing.
 */
function toFamilies(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed
  const record = asRecord(parsed)
  if (!record) return null
  for (const key of ['families', 'models', 'data', 'items', 'results']) {
    if (Array.isArray(record[key])) return record[key] as unknown[]
  }
  return null
}

/** One family → one picker row, with its variants folded in as the effort ladder. */
function toFamilyOption(entry: unknown): AgentOption | null {
  if (typeof entry === 'string') {
    const id = asText(entry)
    return id ? { id, label: id, group: 'recommended', source: 'detected' } : null
  }
  const record = asRecord(entry)
  if (!record) return null
  // `slug` first: it is what the CLI lists back when it rejects an unknown
  // model, so it is the spelling it is guaranteed to accept. `family_uid`
  // differs for a few families (`gemini-3.0-flash` vs the `gemini-3-flash`
  // slug) and would be a model id that does not resolve.
  const id = firstText(record, ['slug', 'family_uid', 'id', 'model', 'value', 'name'])
  if (!id) return null

  const variants = Array.isArray(record.variants) ? record.variants : []
  const familyLabel =
    firstText(record, ['family_label', 'display_name', 'displayName', 'label', 'name']) ?? id
  const rungs = effortRungs(variants, familyLabel)
  const contextWindow =
    firstNumber(record, ['max_context_tokens', 'context_window', 'contextWindow']) ??
    maxVariantContext(variants)
  const aliases = textList(record.aliases)

  return {
    id,
    label: familyLabel,
    ...(firstText(record, ['description', 'summary'])
      ? { description: firstText(record, ['description', 'summary']) as string }
      : {}),
    // A vendor the listing states outranks the one read off the id: the
    // heuristic exists because today's schema has no such field, not because
    // guessing is preferred to being told.
    vendor: firstText(record, ['provider', 'vendor', 'family']) ?? vendorOf(id, familyLabel),
    ...(contextWindow ? { contextWindow } : {}),
    traits: familyTraits(id, variants, contextWindow),
    // Every detected family sits in one bucket; the picker groups by vendor
    // whenever there is more than one, which for Devin there always is.
    group: 'recommended',
    source: 'detected',
    // The short names the user may already type in their own CLI (`opus`,
    // `swe`, `codex`). Not a `resolvedId` — that reads the other way round —
    // but the search field has to match them, or someone who knows Devin by
    // its aliases types the only name they know and finds nothing.
    ...(aliases.length > 0 ? { aliases } : {}),
    // A one-rung ladder is a control that cannot be moved: no `efforts`, and
    // the picker renders no effort section for that model at all. The leading
    // "Automático" row is what sends the family slug alone and lets Devin's
    // own default decide — the same delegated rung Claude's ladder carries.
    ...(rungs.length > 1 ? { efforts: [autoRung(), ...rungs] } : {})
  }
}

/** The delegated rung: no variant, so `--model` carries the family slug alone. */
function autoRung(): AgentOption {
  return {
    id: CLI_DEFAULT_ID,
    label: 'Automático',
    descriptionKey: 'effort.cliDefault',
    traits: ['cli-default'],
    group: 'default',
    source: 'catalog'
  }
}

/**
 * The variants of one family, as an effort ladder ordered from least to most
 * thinking.
 *
 * The order is the point. The CLI lists variants in whatever order its API
 * returns them — Claude Opus 5 arrives `medium, low, high, xhigh, max`, which
 * as a ramp would draw a mountain instead of a climb. `RUNG_ORDER` puts them
 * back in the order the words mean, and anything unrecognised keeps its
 * listing position after the known rungs rather than being dropped.
 *
 * The "fast" twins (`-fast`, `-priority`) are **not rungs**. They are the same
 * thinking budget at priority capacity, and putting them on the same ramp made
 * `gpt-5.6-terra` a thirteen-column control in a panel that gives each column
 * about 48px: "Máximo" and "Máximo · rápido" truncated to "Máximo" and
 * "Máxi…", two adjacent steps that look like the same thing with one of them
 * looking broken. So each twin is folded onto its base rung as `fastId`, and
 * the UI renders the second axis as its own switch. The `1M` long-context
 * twins stay rungs — those really are different windows, and they are few.
 */
function effortRungs(variants: unknown[], familyLabel: string): AgentOption[] {
  const rows: RankedRung[] = []
  variants
    .map((variant, index): RankedRung | null => {
      const record = asRecord(variant)
      if (!record) return null
      const id = firstText(record, ['model_uid', 'id', 'slug', 'value'])
      if (!id) return null
      const label = firstText(record, ['label', 'display_name', 'displayName', 'name']) ?? id
      const rung = rungOf(id, label, familyLabel)
      const contextWindow = firstNumber(record, ['max_context_tokens', 'context_window'])
      return {
        index,
        rank: rung.rank,
        fast: rung.fast,
        option: {
          id,
          // The family name is already the row above; repeating it on every
          // rung ("Claude Opus 5 Max") would make a ~48px ramp column
          // unreadable. The rung keeps only what distinguishes it.
          label: rung.label,
          ...(variantDescription(record)
            ? { description: variantDescription(record) as string }
            : {}),
          ...(contextWindow ? { contextWindow } : {}),
          group: 'recommended' as const,
          source: 'detected' as const
        } satisfies AgentOption
      }
    })
    .forEach((row) => {
      if (row !== null) rows.push(row)
    })

  rows.sort((a, b) => a.rank - b.rank || a.index - b.index)
  return foldFastTwins(rows).map((row) => row.option)
}

/**
 * Folds each `-fast`/`-priority` variant onto the rung it twins, as `fastId`.
 *
 * Matched by rank, which is the whole reason `rungOf` gives a twin its base
 * rung's rank plus a half: a twin and its base are the only two entries that
 * can share an integer rank, so the pairing needs no second pass over the ids.
 * A twin with no base (a family that ships only priority variants — none does
 * today, but the schema allows it) stays a rung of its own rather than
 * vanishing.
 */
function foldFastTwins(rows: RankedRung[]): RankedRung[] {
  const kept: RankedRung[] = []
  for (const row of rows) {
    if (!row.fast) {
      kept.push(row)
      continue
    }
    const base = kept.find((candidate) => !candidate.fast && candidate.rank === row.rank - 0.5)
    if (base) base.option = { ...base.option, fastId: row.option.id }
    else kept.push(row)
  }
  return kept
}

interface RankedRung {
  index: number
  rank: number
  /** A `-fast`/`-priority` variant: folded onto its base rung rather than kept as one. */
  fast: boolean
  option: AgentOption
}

/**
 * Where one variant sits on the ladder, and what to call it there.
 *
 * Two sources of evidence, in order of how reliable each turned out to be
 * against the real listing:
 *
 *  1. **The id's suffix.** A closed, machine-written vocabulary (`-none`,
 *     `-minimal`, `-low`, `-medium`, `-high`, `-xhigh`, `-max`) that covers
 *     most of the catalog.
 *  2. **The label, with the family name stripped off the front.** The older
 *     families have opaque ids — `MODEL_PRIVATE_12`, `MODEL_GPT_5_2_LOW`,
 *     the bare `swe-1-7` whose label is "SWE-1.7 Max" — and the only place the
 *     rung is stated is the prose. Stripping the family name is what turns
 *     "Claude Opus 4.6 Thinking" into "Thinking" instead of a ramp column
 *     repeating the model name five times.
 *
 * A variant that matches neither keeps whatever the label had left after the
 * strip (or "Padrão", when the strip left nothing — that IS the base variant)
 * and sorts after every named rung, in listing order.
 */
const RUNG_ORDER: Array<{ suffix: string; label: string; rank: number }> = [
  { suffix: 'none', label: 'Sem raciocínio', rank: 0 },
  { suffix: 'minimal', label: 'Mínimo', rank: 1 },
  { suffix: 'low', label: 'Baixo', rank: 2 },
  { suffix: 'medium', label: 'Médio', rank: 3 },
  { suffix: 'high', label: 'Alto', rank: 4 },
  { suffix: 'xhigh', label: 'Extra', rank: 5 },
  { suffix: 'max', label: 'Máximo', rank: 6 }
]

/** How the same rungs are spelled in the CLI's English labels. Longest first — "x-high" before "high". */
const RUNG_WORDS: Array<{ match: RegExp; suffix: string }> = [
  { match: /\bno thinking\b/, suffix: 'none' },
  { match: /\bminimal\b/, suffix: 'minimal' },
  { match: /\bx-?high\b/, suffix: 'xhigh' },
  { match: /\bmax\b/, suffix: 'max' },
  { match: /\bhigh\b/, suffix: 'high' },
  { match: /\bmedium\b/, suffix: 'medium' },
  { match: /\blow\b/, suffix: 'low' }
]

/** The two "same thinking, priority capacity" markers Devin appends, and what they cost. */
const FAST_SUFFIXES = ['fast', 'priority']

function rungOf(
  id: string,
  label: string,
  familyLabel: string
): { label: string; rank: number; fast: boolean } {
  const rest = stripFamilyPrefix(label, familyLabel)
  const parts = id.toLowerCase().split(/[-_]/)
  const fast =
    FAST_SUFFIXES.includes(parts[parts.length - 1] ?? '') || /\b(fast|priority)\b/i.test(rest)
  const core = fast ? parts.slice(0, -1) : parts
  const suffix = core[core.length - 1] ?? ''
  const rung =
    RUNG_ORDER.find((candidate) => candidate.suffix === suffix) ??
    RUNG_ORDER.find(
      (candidate) =>
        candidate.suffix === RUNG_WORDS.find((word) => word.match.test(rest.toLowerCase()))?.suffix
    )
  // A long-context twin of the same rung: kept as a marker rather than as its
  // own rung, because it is a different axis (window, not thinking budget).
  const wide = /\b1m\b/i.test(rest)

  if (!rung) {
    // The base variant of a family whose label is just the family name.
    return { label: rest === '' ? 'Padrão' : rest, rank: RUNG_ORDER.length, fast }
  }
  return {
    // No speed marker: a twin is folded onto its base rung, so its own label
    // is never rendered. The `1M` marker stays, because that IS a rung.
    label: wide ? `${rung.label} · 1M` : rung.label,
    // Fractions, so a `1M` twin lands just after the rung it widens, and a
    // fast twin lands exactly half a step after the rung it will fold onto —
    // which is how `foldFastTwins` pairs them.
    rank: rung.rank + (wide ? 0.25 : 0) + (fast ? 0.5 : 0),
    fast
  }
}

/**
 * "Claude Opus 4.6 Thinking 1M" minus "Claude Opus 4.6" → "Thinking 1M".
 * Case- and separator-insensitive, because a family's `family_label` and its
 * variants' labels are written by different parts of the API and do not always
 * agree on punctuation. A label that doesn't start with the family name is
 * returned untouched.
 */
function stripFamilyPrefix(label: string, familyLabel: string): string {
  const normalize = (text: string): string => text.toLowerCase().replace(/[\s._-]+/g, '')
  const family = normalize(familyLabel)
  if (family === '') return label.trim()
  // Walked a character at a time rather than compared by length: the two
  // strings punctuate differently ("GLM-5.2" vs "GLM 5.2"), so the *raw*
  // offset where the family name ends is not something either length knows.
  let seen = ''
  for (let index = 0; index < label.length; index += 1) {
    seen += label[index]
    const next = normalize(seen)
    if (next.length > family.length || !family.startsWith(next)) return label.trim()
    // A word boundary is required, or "Odd" would eat the front of "Oddly
    // Specific" and leave a rung labelled "ly Specific".
    if (next === family && !/[A-Za-z0-9]/.test(label[index + 1] ?? '')) {
      return label.slice(index + 1).trim()
    }
  }
  return ''
}

/** The rung's fine print: what it costs, as the CLI itself phrased it. */
function variantDescription(record: Record<string, unknown>): string | undefined {
  const summary = firstText(record, ['cost_summary'])
  const tier = firstText(record, ['cost_tier'])
  return summary ?? tier ?? firstText(record, ['description'])
}

/**
 * Who makes the model. Devin's listing carries no vendor field, so it is read
 * off the family id — the one place the information reliably is, and the
 * grouping the picker needs to turn 43 rows into something scannable.
 */
const VENDOR_PREFIXES: Array<{ match: RegExp; vendor: string }> = [
  { match: /^claude|^anthropic/, vendor: 'Anthropic' },
  { match: /^gpt|^o[134]|^codex/, vendor: 'OpenAI' },
  { match: /^gemini/, vendor: 'Google' },
  { match: /^grok/, vendor: 'xAI' },
  { match: /^swe|^adaptive|^inkling/, vendor: 'Cognition' },
  { match: /^glm/, vendor: 'Z.ai' },
  { match: /^kimi/, vendor: 'Moonshot' },
  { match: /^deepseek/, vendor: 'DeepSeek' },
  { match: /^nemotron/, vendor: 'NVIDIA' }
]

function vendorOf(id: string, label: string): string {
  const key = id.toLowerCase()
  const hit = VENDOR_PREFIXES.find((candidate) => candidate.match.test(key))
  if (hit) return hit.vendor
  // Better an honest first word than a wrong vendor: "Outros" would put nine
  // unrelated families under one meaningless header.
  return label.split(/[\s-]/)[0] ?? 'Devin'
}

/**
 * What kind of row this is, for the picker's tier glyph. Derived, never
 * guessed at random: the router says so in its own name, "thinking" is true
 * exactly when the family has more than one reasoning rung, and the cost tier
 * the CLI publishes is the only signal it gives about weight.
 */
function familyTraits(id: string, variants: unknown[], contextWindow?: number): ModelTrait[] {
  const traits: ModelTrait[] = []
  if (/adaptive|router/i.test(id)) traits.push('router')
  const tiers = variants
    .map((variant) => asText(asRecord(variant)?.cost_tier))
    .filter((tier): tier is string => tier !== null)
  const high = tiers.some((tier) => /high/i.test(tier))
  const free = tiers.every((tier) => /free|low/i.test(tier)) && tiers.length > 0
  if (traits.length === 0) traits.push(high ? 'flagship' : free ? 'fast' : 'balanced')
  if (variants.length > 1) traits.push('thinking')
  if (contextWindow !== undefined && contextWindow >= 1_000_000) traits.push('long-context')
  return traits
}

/** The largest window any of a family's variants offers — the family's real ceiling. */
function maxVariantContext(variants: unknown[]): number | undefined {
  const windows = variants
    .map((variant) =>
      firstNumber(asRecord(variant) ?? {}, ['max_context_tokens', 'context_window'])
    )
    .filter((value): value is number => value !== undefined)
  return windows.length > 0 ? Math.max(...windows) : undefined
}

/** A list of non-empty strings out of an unknown value (the `aliases` array). */
function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asText).filter((entry): entry is string => entry !== null)
}

/**
 * The first of `keys` that holds usable text. Devin's `models list` schema
 * isn't published, so every plausible spelling is tried rather than betting
 * the whole feature on one guess.
 */
function firstText(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const text = asText(record[key])
    if (text !== null) return text
  }
  return undefined
}

/** Same idea for the context window, which no two APIs spell the same way. */
function firstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = numberOf(record[key])
    if (value !== null) return value
  }
  return undefined
}

function numberOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * The default in the user's own Devin config (`agent.model`). Read from the
 * user scope only — the CLI's config reference states this field is
 * user-config-only and cannot be overridden per project, so reading a project
 * file for it would report a default that isn't in force.
 */
function configuredDefault(
  deps: DevinCatalogDeps,
  readJson: <T>(path: string) => T | null
): string | null {
  const appData = asText(deps.env.APPDATA)
  const path =
    deps.platform === 'win32' && appData
      ? join(appData, 'devin', 'config.json')
      : join(asText(deps.env.XDG_CONFIG_HOME) ?? join(deps.home, '.config'), 'devin', 'config.json')
  const config = readJson<Record<string, unknown>>(path)
  return asText(asRecord(config?.agent)?.model)
}
