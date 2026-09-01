import { join } from 'path'
import type { AgentCapabilities, AgentOption, AgentProvider, CapabilityNote } from './agentAdapter'
import {
  CLI_DEFAULT_ID,
  asRecord,
  asText,
  mergeOptions,
  readJsonFile,
  strongestSource
} from './modelCatalog'

/**
 * What the `claude` CLI can actually run **on this machine** — the fix for
 * "os modelos do Claude parecem estar fixos (deveria reconhecer os que tem
 * disponível, ex: Bedrock)".
 *
 * Nothing here spawns the CLI. Everything it needs is already written down by
 * the CLI itself, and reading files is instant where a probe would cost a
 * process and a second of latency on every picker open. Four sources, in
 * increasing order of how specific they are to this user:
 *
 *  1. **The curated alias catalog** — `opus`/`sonnet`/`haiku`/`fable`, their
 *     `[1m]` long-context variants, `opusplan`, and the pinned-version aliases.
 *     Verified against `claude --help` and the shipped binary's own picker
 *     strings (2.1.226). This is the floor, and it is labelled `catalog` so the
 *     picker never implies it measured something it didn't.
 *  2. **The settings chain** — `managed-settings.json` (policy),
 *     `~/.claude/settings.json`, `<workspace>/.claude/settings.json`, and
 *     `<workspace>/.claude/settings.local.json`. These carry `model`,
 *     `effortLevel` (the user's own defaults, so the "Automático" row can say
 *     what it will actually do) and an `env` block that is the real switch for
 *     everything below.
 *  3. **The provider environment** — `CLAUDE_CODE_USE_BEDROCK`/`_VERTEX`/
 *     `_FOUNDRY`, `ANTHROPIC_BASE_URL`, plus the model-naming vars the CLI
 *     documents for third-party providers: `ANTHROPIC_MODEL`,
 *     `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU,FABLE}_MODEL` (each with optional
 *     `_NAME`/`_DESCRIPTION`), `ANTHROPIC_SMALL_FAST_MODEL`, and
 *     `ANTHROPIC_CUSTOM_MODEL_OPTION` (+ `_NAME`/`_DESCRIPTION`). On Bedrock
 *     this is the *only* place the real ids exist, which is precisely the case
 *     the old hard-coded list got wrong.
 *  4. **`~/.claude.json`** — the CLI's own account caches.
 *     `additionalModelOptionsCache` is a live list of `{value,label,
 *     description}` rows the CLI learned from the account (measured on 2.1.226:
 *     it held `claude-fable-5[1m]`), i.e. models this user really has. It is
 *     merged in as `detected`, the strongest claim on the picker.
 *
 * `modelAccessCache` is read too, but **only additively**: its populated shape
 * isn't documented and was empty on the machine this was built against, so
 * treating it as an allow-list could silently delete rows that work. Adding
 * rows it names can only ever be an improvement; removing rows on a guess
 * cannot.
 */

/** Tokens of context every current first-party Claude model exposes via the CLI. */
const STANDARD_CONTEXT = 200_000

/** The `[1m]` variants' window — the whole reason those aliases exist. */
const LONG_CONTEXT = 1_000_000

/** Env vars that name a model per tier on a third-party provider. */
const TIER_VARS = [
  { tier: 'opus', variable: 'ANTHROPIC_DEFAULT_OPUS_MODEL' },
  { tier: 'sonnet', variable: 'ANTHROPIC_DEFAULT_SONNET_MODEL' },
  { tier: 'haiku', variable: 'ANTHROPIC_DEFAULT_HAIKU_MODEL' },
  { tier: 'fable', variable: 'ANTHROPIC_DEFAULT_FABLE_MODEL' }
] as const

/**
 * The alias catalog. Labels are the **alias names**, not version numbers, and
 * that is deliberate: `opus` resolves to whatever the installed CLI considers
 * current, so a row hard-labelled "Opus 5" goes stale on the next CLI update
 * while the alias it sends stays right. The concrete id is shown where it is
 * actually known — from a detected row's own description, or from the model
 * the running turn reports back (`usage.model`).
 */
export const CLAUDE_ALIAS_CATALOG: AgentOption[] = [
  {
    id: 'opus',
    label: 'Opus',
    descriptionKey: 'claude.opus',
    contextWindow: STANDARD_CONTEXT,
    traits: ['flagship', 'thinking'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'sonnet',
    label: 'Sonnet',
    descriptionKey: 'claude.sonnet',
    contextWindow: STANDARD_CONTEXT,
    traits: ['balanced', 'thinking'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'haiku',
    label: 'Haiku',
    descriptionKey: 'claude.haiku',
    contextWindow: STANDARD_CONTEXT,
    traits: ['fast'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'fable',
    label: 'Fable',
    descriptionKey: 'claude.fable',
    contextWindow: STANDARD_CONTEXT,
    traits: ['flagship', 'thinking'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'opus[1m]',
    label: 'Opus 1M',
    descriptionKey: 'claude.opus1m',
    contextWindow: LONG_CONTEXT,
    traits: ['flagship', 'long-context'],
    group: 'more',
    source: 'catalog'
  },
  {
    id: 'sonnet[1m]',
    label: 'Sonnet 1M',
    descriptionKey: 'claude.sonnet1m',
    contextWindow: LONG_CONTEXT,
    traits: ['balanced', 'long-context'],
    group: 'more',
    source: 'catalog'
  },
  {
    id: 'opusplan',
    label: 'Opus Plan',
    descriptionKey: 'claude.opusplan',
    contextWindow: STANDARD_CONTEXT,
    traits: ['flagship'],
    group: 'more',
    source: 'catalog'
  }
]

/**
 * Pinned-version aliases (`opus48`, `sonnet46`, …). Their whole identity is the
 * version number, so unlike the rolling aliases above they are labelled with
 * it. They live in their own group because a conversation started on one keeps
 * resuming on it — the picker has to be able to *show* that without putting
 * seven superseded rows in front of the four that matter.
 */
export const CLAUDE_PINNED_CATALOG: AgentOption[] = [
  'opus48',
  'opus47',
  'opus46',
  'opus41',
  'sonnet5',
  'sonnet46',
  'fable5',
  'haiku45',
  'haiku35'
].map((id) => ({
  id,
  label: prettifyAlias(id),
  descriptionKey: 'claude.pinned',
  contextWindow: STANDARD_CONTEXT,
  traits: ['legacy'],
  group: 'legacy',
  source: 'catalog'
}))

/** `--effort`, verified against `claude --help` (2.1.226). */
export const CLAUDE_EFFORTS: AgentOption[] = [
  { id: 'low', label: 'Baixo', descriptionKey: 'effort.low', group: 'recommended' },
  { id: 'medium', label: 'Médio', descriptionKey: 'effort.medium', group: 'recommended' },
  { id: 'high', label: 'Alto', descriptionKey: 'effort.high', group: 'recommended' },
  { id: 'xhigh', label: 'Extra', descriptionKey: 'effort.xhigh', group: 'recommended' },
  { id: 'max', label: 'Máx', descriptionKey: 'effort.max', group: 'recommended' }
]

/** Everything detection reads, injected so the whole module is testable with no disk. */
export interface ClaudeCatalogDeps {
  env: NodeJS.ProcessEnv
  home: string
  platform: NodeJS.Platform
  workspace?: string
  /** Injection seam for tests; defaults to the real filesystem read. */
  readJson?: <T>(path: string) => T | null
}

/** The merged view of the settings chain that detection actually consumes. */
interface ClaudeSettings {
  model: string | null
  effortLevel: string | null
  env: Record<string, string>
}

/**
 * Builds the capabilities for the Claude adapter by reading this machine.
 * Pure over `deps` — no spawning, no globals — so a test can hand it a fake
 * home directory and assert the Bedrock path without a Bedrock account.
 */
export function detectClaudeCapabilities(deps: ClaudeCatalogDeps): AgentCapabilities {
  const readJson = deps.readJson ?? readJsonFile
  const settings = readSettingsChain(deps, readJson)
  // Settings' `env` block wins over the inherited environment: the CLI applies
  // it to every session it starts, so it is what the *turn* will see, whatever
  // Hive itself was launched with.
  const env: Record<string, string | undefined> = { ...deps.env, ...settings.env }
  const provider = detectProvider(env)

  const configured = configuredModels(env, provider)
  const account = accountModels(deps, readJson)

  // A third-party provider that names its own models replaces the alias
  // catalog as the *lead* — those ids are the ones that exist there — while
  // the aliases stay reachable below, because the CLI still maps them.
  const base =
    provider.id === 'anthropic' || provider.id === 'unknown'
      ? [...CLAUDE_ALIAS_CATALOG, ...CLAUDE_PINNED_CATALOG]
      : [...configured, ...demoteToMore(CLAUDE_ALIAS_CATALOG), ...CLAUDE_PINNED_CATALOG]

  const models = mergeOptions(
    provider.id === 'anthropic' || provider.id === 'unknown'
      ? mergeOptions(base, configured)
      : base,
    account
  )

  const withDefault = [defaultRow(settings, provider), ...models]
  const note: CapabilityNote | undefined =
    account.length === 0 && configured.length === 0 ? 'no-listing' : undefined

  return {
    models: withDefault,
    efforts: [defaultEffortRow(settings), ...CLAUDE_EFFORTS],
    supportsAttachments: true,
    provider,
    modelSource: strongestSource(withDefault),
    defaults: { model: settings.model, effort: settings.effortLevel },
    ...(note ? { note } : {})
  }
}

/**
 * The "Automático" row. It is not a model: it is the *absence* of `--model`,
 * which hands the choice to the CLI's own configuration. Its fine print names
 * that configuration (`settings.model`) so picking it is informed — the whole
 * difference between an auto mode a user trusts and one they route around.
 */
function defaultRow(settings: ClaudeSettings, provider: AgentProvider): AgentOption {
  return {
    id: CLI_DEFAULT_ID,
    label: 'Automático',
    descriptionKey: 'cliDefault',
    traits: ['cli-default'],
    group: 'default',
    source: settings.model ? 'configured' : 'catalog',
    ...(settings.model ? { resolvedId: settings.model } : {}),
    ...(provider.id === 'anthropic' || provider.id === 'unknown'
      ? { contextWindow: STANDARD_CONTEXT }
      : {})
  }
}

function defaultEffortRow(settings: ClaudeSettings): AgentOption {
  return {
    id: CLI_DEFAULT_ID,
    label: 'Automático',
    descriptionKey: 'effort.cliDefault',
    traits: ['cli-default'],
    group: 'default',
    source: settings.effortLevel ? 'configured' : 'catalog',
    ...(settings.effortLevel ? { resolvedId: settings.effortLevel } : {})
  }
}

/** Aliases stop being the headline act once a provider names concrete ids. */
function demoteToMore(options: AgentOption[]): AgentOption[] {
  return options.map((option) => ({
    ...option,
    group: option.group === 'recommended' ? 'more' : option.group
  }))
}

/**
 * Reads the settings chain in precedence order (later wins): user → shared
 * project → local project → enterprise policy. Policy last because it is the
 * one layer the user cannot override, which is exactly why an admin-pinned
 * model has to be the one the picker shows as the default.
 */
function readSettingsChain(
  deps: ClaudeCatalogDeps,
  readJson: <T>(path: string) => T | null
): ClaudeSettings {
  const files = [
    join(deps.home, '.claude', 'settings.json'),
    ...(deps.workspace
      ? [
          join(deps.workspace, '.claude', 'settings.json'),
          join(deps.workspace, '.claude', 'settings.local.json')
        ]
      : []),
    policySettingsPath(deps.platform)
  ]
  const merged: ClaudeSettings = { model: null, effortLevel: null, env: {} }
  for (const file of files) {
    const raw = readJson<Record<string, unknown>>(file)
    if (!raw) continue
    merged.model = asText(raw.model) ?? merged.model
    merged.effortLevel = asText(raw.effortLevel) ?? merged.effortLevel
    const envBlock = asRecord(raw.env)
    if (envBlock) {
      for (const [key, value] of Object.entries(envBlock)) {
        const text = asText(value)
        if (text !== null) merged.env[key] = text
      }
    }
  }
  return merged
}

/** Where an administrator's managed settings live, per the CLI's own layout. */
function policySettingsPath(platform: NodeJS.Platform): string {
  if (platform === 'win32') return 'C:\\ProgramData\\ClaudeCode\\managed-settings.json'
  if (platform === 'darwin') return '/Library/Application Support/ClaudeCode/managed-settings.json'
  return '/etc/claude-code/managed-settings.json'
}

/**
 * Which backend the CLI will talk to. The order matters: the three provider
 * switches are explicit opt-ins and outrank a base-URL override, which is
 * itself only a gateway when it points somewhere that isn't Anthropic.
 */
export function detectProvider(env: Record<string, string | undefined>): AgentProvider {
  if (isOn(env.CLAUDE_CODE_USE_BEDROCK)) {
    return { id: 'bedrock', detail: asText(env.AWS_REGION ?? env.AWS_DEFAULT_REGION) }
  }
  if (isOn(env.CLAUDE_CODE_USE_VERTEX)) {
    return {
      id: 'vertex',
      detail: asText(env.CLOUD_ML_REGION ?? env.GOOGLE_CLOUD_PROJECT ?? env.GCLOUD_PROJECT)
    }
  }
  if (isOn(env.CLAUDE_CODE_USE_FOUNDRY)) {
    return { id: 'foundry', detail: hostOf(env.ANTHROPIC_FOUNDRY_BASE_URL) }
  }
  const baseUrl = asText(env.ANTHROPIC_BASE_URL)
  if (baseUrl && !/(^|\.)anthropic\.com$/.test(hostOf(baseUrl) ?? '')) {
    return { id: 'gateway', detail: hostOf(baseUrl) }
  }
  return { id: 'anthropic', detail: null }
}

/** `1`/`true`/`yes`/`on` — the CLI's own truthiness for its switches. */
function isOn(value: string | undefined): boolean {
  const text = asText(value)?.toLowerCase()
  return text === '1' || text === 'true' || text === 'yes' || text === 'on'
}

function hostOf(url: string | undefined): string | null {
  const text = asText(url)
  if (!text) return null
  try {
    return new URL(text).host
  } catch {
    return text
  }
}

/**
 * Models this machine's environment names explicitly. On Bedrock/Vertex/
 * Foundry these are the real, runnable ids; on the first-party API they are
 * still worth surfacing, because a pinned `ANTHROPIC_MODEL` is what every turn
 * will use whether or not the picker admits it exists.
 */
function configuredModels(
  env: Record<string, string | undefined>,
  provider: AgentProvider
): AgentOption[] {
  const rows: AgentOption[] = []
  const seen = new Set<string>()
  const push = (row: AgentOption): void => {
    if (seen.has(row.id)) return
    seen.add(row.id)
    rows.push(row)
  }

  const pinned = asText(env.ANTHROPIC_MODEL)
  if (pinned) {
    push({
      id: pinned,
      label: asText(env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME) ?? prettifyModelId(pinned),
      description: asText(env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION) ?? undefined,
      resolvedId: pinned,
      contextWindow: STANDARD_CONTEXT,
      traits: traitsForModelId(pinned),
      group: 'recommended',
      source: 'configured',
      vendor: vendorFor(provider)
    })
  }

  const custom = asText(env.ANTHROPIC_CUSTOM_MODEL_OPTION)
  if (custom) {
    push({
      id: custom,
      label: asText(env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME) ?? prettifyModelId(custom),
      description: asText(env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION) ?? undefined,
      resolvedId: custom,
      contextWindow: STANDARD_CONTEXT,
      traits: traitsForModelId(custom),
      group: 'recommended',
      source: 'configured',
      vendor: vendorFor(provider)
    })
  }

  for (const { tier, variable } of TIER_VARS) {
    const id = asText(env[variable])
    if (!id) continue
    push({
      id,
      label: asText(env[`${variable}_NAME`]) ?? prettifyModelId(id),
      description: asText(env[`${variable}_DESCRIPTION`]) ?? undefined,
      descriptionKey: env[`${variable}_DESCRIPTION`] ? undefined : `claude.${tier}`,
      resolvedId: id,
      contextWindow: STANDARD_CONTEXT,
      traits: traitsForModelId(id),
      group: 'recommended',
      source: 'configured',
      vendor: vendorFor(provider)
    })
  }

  const smallFast = asText(env.ANTHROPIC_SMALL_FAST_MODEL)
  if (smallFast) {
    push({
      id: smallFast,
      label: prettifyModelId(smallFast),
      descriptionKey: 'claude.smallFast',
      resolvedId: smallFast,
      contextWindow: STANDARD_CONTEXT,
      traits: ['fast'],
      group: 'more',
      source: 'configured',
      vendor: vendorFor(provider)
    })
  }

  return rows
}

function vendorFor(provider: AgentProvider): string | undefined {
  if (provider.id === 'bedrock') return 'Amazon Bedrock'
  if (provider.id === 'vertex') return 'Google Vertex AI'
  if (provider.id === 'foundry') return 'Microsoft Foundry'
  if (provider.id === 'gateway') return provider.detail ?? undefined
  return undefined
}

/**
 * Rows the installed CLI itself learned for this account, out of
 * `~/.claude.json`. These are `detected`: nobody wrote them into Hive, and
 * they change when the account's access changes — which is the property the
 * old hard-coded list was missing.
 */
function accountModels(
  deps: ClaudeCatalogDeps,
  readJson: <T>(path: string) => T | null
): AgentOption[] {
  const configPath = asText(deps.env.CLAUDE_CONFIG_DIR)
    ? join(deps.env.CLAUDE_CONFIG_DIR as string, '.claude.json')
    : join(deps.home, '.claude.json')
  const config = readJson<Record<string, unknown>>(configPath)
  if (!config) return []

  const rows: AgentOption[] = []
  const seen = new Set<string>()
  const collect = (entry: unknown): void => {
    // Two shapes are accepted because two caches carry these rows and only one
    // of them was populated on the machine this was measured against: a full
    // `{value,label,description}` option, or a bare model id string.
    const id = typeof entry === 'string' ? asText(entry) : asText(asRecord(entry)?.value)
    if (!id || seen.has(id)) return
    seen.add(id)
    const record = asRecord(entry)
    rows.push({
      id,
      label: asText(record?.label) ?? prettifyModelId(id),
      description: asText(record?.description) ?? undefined,
      resolvedId: id.includes('claude-') ? id : undefined,
      contextWindow: id.includes('[1m]') ? LONG_CONTEXT : STANDARD_CONTEXT,
      traits: traitsForModelId(id),
      group: 'recommended',
      source: 'detected'
    })
  }

  for (const key of ['additionalModelOptionsCache', 'modelAccessCache']) {
    const list = config[key]
    if (Array.isArray(list)) for (const entry of list) collect(entry)
  }
  return rows
}

/** What can be said about a model from its id alone, without pretending to more. */
function traitsForModelId(id: string): AgentOption['traits'] {
  const lower = id.toLowerCase()
  const traits: NonNullable<AgentOption['traits']> = []
  if (lower.includes('[1m]')) traits.push('long-context')
  if (lower.includes('haiku')) traits.push('fast')
  else if (lower.includes('opus') || lower.includes('fable')) traits.push('flagship')
  else if (lower.includes('sonnet')) traits.push('balanced')
  return traits.length > 0 ? traits : undefined
}

/**
 * Turns a concrete model id into something a person reads:
 * `us.anthropic.claude-sonnet-4-5-20250929-v1:0` → `Claude Sonnet 4.5`.
 * Version segments rejoin with dots (`4-5` → `4.5`) because that is how every
 * vendor writes them everywhere except inside an id.
 */
export function prettifyModelId(id: string): string {
  const core = id
    .replace(/^[a-z]{2}\.(anthropic|meta|amazon)\./, '')
    .replace(/^(anthropic|publishers\/anthropic\/models)[./]/, '')
    .replace(/:[0-9]+$/, '')
    .replace(/-v\d+$/, '')
    .replace(/-\d{8}$/, '')
  const long = core.includes('[1m]')
  const words = core.replace('[1m]', '').split(/[-_]/).filter(Boolean)
  const parts: string[] = []
  for (const word of words) {
    if (/^\d+$/.test(word) && parts.length > 0 && /\d$/.test(parts[parts.length - 1])) {
      parts[parts.length - 1] = `${parts[parts.length - 1]}.${word}`
      continue
    }
    parts.push(/^\d+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))
  }
  const label = parts.join(' ')
  return long ? `${label} 1M` : label
}

/** `opus48` → `Opus 4.8`; `haiku35` → `Haiku 3.5`; `sonnet` → `Sonnet`. */
function prettifyAlias(alias: string): string {
  const match = /^([a-z]+)(\d)(\d)?$/.exec(alias)
  if (!match) return alias.charAt(0).toUpperCase() + alias.slice(1)
  const [, name, major, minor] = match
  const version = minor ? `${major}.${minor}` : major
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${version}`
}
