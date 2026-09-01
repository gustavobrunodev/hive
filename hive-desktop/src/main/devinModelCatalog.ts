import { join } from 'path'
import type { AgentCapabilities, AgentOption, CapabilityNote } from './agentAdapter'
import type { ProcessRunner } from './processRunner'
import {
  CLI_DEFAULT_ID,
  asRecord,
  asText,
  mergeOptions,
  parseJsonLoose,
  readJsonFile,
  runCapture,
  strongestSource
} from './modelCatalog'

/**
 * Devin's models — the bug report's first line, "Modelos do Devin não estão
 * aparecendo".
 *
 * They weren't appearing because the adapter declared `models: []` with the
 * comment "Devin picks its own model — no user-facing model choice". That was
 * wrong: the Devin CLI fronts Anthropic, OpenAI, Google and Cognition models,
 * takes `--model <id>` (env `DEVIN_MODEL`), stores a default at
 * `agent.model` in its config, and — the part that makes this feature real —
 * **publishes the list itself**:
 *
 * ```
 * devin models list --format json
 * ```
 *
 * So this module asks the CLI rather than shipping an opinion. The curated
 * catalog below exists only for the machine where `devin` isn't installed yet
 * (the picker still has to render something for an agent the user is
 * considering) and for the case where the subcommand fails.
 *
 * The JSON shape is read defensively. Devin's docs say the flag exists and is
 * "for scripts" but don't pin the schema, so every plausible spelling of id /
 * label / description is accepted and anything unrecognisable is skipped
 * rather than crashing the picker.
 */

/** Devin's own default when its config says nothing, per the CLI's config docs. */
const DEVIN_STOCK_DEFAULT = 'swe-1-6-fast'

/**
 * The fallback list. Short names only: Devin documents that `opus`, `sonnet`,
 * `swe`, `codex` and `gemini` "always resolve to the latest version in that
 * model family", which is the right thing to pin in a catalog that can go
 * stale — unlike a dated id, a family name keeps meaning the same thing.
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

  const models = listed === null ? [...DEVIN_CATALOG] : mergeOptions(DEVIN_CATALOG, listed)
  const note: CapabilityNote | undefined = listed === null ? 'probe-failed' : undefined

  const withDefault = [defaultRow(configured), ...models]
  return {
    models: withDefault,
    // Devin exposes autonomy (`--permission-mode`), not an effort ladder — so
    // the composer hides that control entirely rather than inventing one.
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
  const parsed = parseJsonLoose(output)
  const entries = toEntries(parsed)
  if (entries === null) return null
  const rows = entries.map(toOption).filter((row): row is AgentOption => row !== null)
  return rows.length > 0 ? rows : null
}

/** Accepts a bare array, or an object wrapping one under a plausible key. */
function toEntries(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed
  const record = asRecord(parsed)
  if (!record) return null
  for (const key of ['models', 'data', 'items', 'results']) {
    if (Array.isArray(record[key])) return record[key] as unknown[]
  }
  return null
}

/** One listed model → one picker row, or `null` when it carries no usable id. */
function toOption(entry: unknown): AgentOption | null {
  if (typeof entry === 'string') {
    const id = asText(entry)
    return id ? { id, label: id, group: 'recommended', source: 'detected' } : null
  }
  const record = asRecord(entry)
  if (!record) return null
  const id = firstText(record, ['id', 'slug', 'model', 'value', 'name'])
  if (!id) return null
  const description = firstText(record, ['description', 'summary'])
  const vendor = firstText(record, ['provider', 'vendor', 'family'])
  const contextWindow = firstNumber(record, ['context_window', 'contextWindow', 'context_length'])
  return {
    id,
    label: firstText(record, ['display_name', 'displayName', 'label', 'name']) ?? id,
    ...(description ? { description } : {}),
    ...(vendor ? { vendor } : {}),
    ...(contextWindow ? { contextWindow } : {}),
    // Adaptive is a router, not a model, and saying so is the difference
    // between "why is this one different" and a row that explains itself.
    ...(/adaptive|router/i.test(id) ? { traits: ['router' as const] } : {}),
    group: 'recommended',
    source: 'detected'
  }
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
