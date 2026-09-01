import { join } from 'path'
import type { AgentCapabilities, AgentOption } from './agentAdapter'
import {
  CLI_DEFAULT_ID,
  asRecord,
  asText,
  mergeOptions,
  readJsonFile,
  strongestSource
} from './modelCatalog'

/**
 * The GitHub Copilot CLI's models.
 *
 * Copilot is the one agent of the three that publishes **no** machine-readable
 * model list: its catalog is fetched from the GitHub API at session start and
 * chosen with the in-session `/model` command, and the binary exposes neither
 * a `models` subcommand nor a `--list-models` flag (checked against the
 * installed `@github/copilot` build). So detection here is narrower, and the
 * picker says so — `note: 'no-listing'` renders as "o CLI do Copilot não
 * publica a lista; estes são os modelos conhecidos".
 *
 * What *can* be read off the machine is the user's own chosen default, which
 * the CLI persists in `$COPILOT_HOME/config.json` (default `~/.copilot`).
 * That row is marked `configured`, and it is the one the composer preselects —
 * so a user who picked GPT-5 in the Copilot TUI sees GPT-5 here too instead of
 * whatever happened to be first in a list Hive wrote.
 *
 * The catalog itself is no longer a guess: the ids below were read out of the
 * installed CLI's own bundle, so they are that CLI's vocabulary rather than
 * plausible-looking slugs. Which of them a given account may actually run
 * depends on its Copilot plan, which nothing local can answer.
 */

/** Copilot fronts several vendors; the picker groups by this. */
const ANTHROPIC = 'Anthropic'
const OPENAI = 'OpenAI'
const GOOGLE = 'Google'

export const COPILOT_CATALOG: AgentOption[] = [
  {
    id: 'claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5',
    descriptionKey: 'copilot.sonnet45',
    vendor: ANTHROPIC,
    contextWindow: 200_000,
    traits: ['balanced', 'thinking'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    descriptionKey: 'copilot.sonnet46',
    vendor: ANTHROPIC,
    contextWindow: 200_000,
    traits: ['balanced', 'thinking'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'claude-opus-4.5',
    label: 'Claude Opus 4.5',
    descriptionKey: 'copilot.opus45',
    vendor: ANTHROPIC,
    contextWindow: 200_000,
    traits: ['flagship', 'thinking'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    descriptionKey: 'copilot.haiku45',
    vendor: ANTHROPIC,
    contextWindow: 200_000,
    traits: ['fast'],
    group: 'more',
    source: 'catalog'
  },
  {
    id: 'gpt-5.1',
    label: 'GPT-5.1',
    descriptionKey: 'copilot.gpt51',
    vendor: OPENAI,
    traits: ['flagship', 'thinking'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'gpt-5',
    label: 'GPT-5',
    descriptionKey: 'copilot.gpt5',
    vendor: OPENAI,
    traits: ['balanced', 'thinking'],
    group: 'recommended',
    source: 'catalog'
  },
  {
    id: 'gpt-5.1-codex',
    label: 'GPT-5.1 Codex',
    descriptionKey: 'copilot.codex',
    vendor: OPENAI,
    traits: ['balanced'],
    group: 'more',
    source: 'catalog'
  },
  {
    id: 'gpt-5-mini',
    label: 'GPT-5 mini',
    descriptionKey: 'copilot.gpt5mini',
    vendor: OPENAI,
    traits: ['fast'],
    group: 'more',
    source: 'catalog'
  },
  {
    id: 'gemini-3-pro-preview',
    label: 'Gemini 3 Pro',
    descriptionKey: 'copilot.gemini3',
    vendor: GOOGLE,
    traits: ['flagship'],
    group: 'more',
    source: 'catalog'
  }
]

export interface CopilotCatalogDeps {
  env: NodeJS.ProcessEnv
  home: string
  readJson?: <T>(path: string) => T | null
}

/** Builds Copilot's capabilities: curated catalog + the user's own default. */
export function detectCopilotCapabilities(deps: CopilotCatalogDeps): AgentCapabilities {
  const readJson = deps.readJson ?? readJsonFile
  const configured = configuredModel(deps, readJson)

  // A model the user picked that Hive's catalog doesn't know about is still
  // real — it goes on the list rather than being silently dropped, which is
  // the only way this picker survives GitHub adding a model tomorrow.
  const configuredRows: AgentOption[] = configured
    ? [
        {
          id: configured,
          label: configured,
          group: 'recommended',
          source: 'configured'
        }
      ]
    : []

  const models = [defaultRow(configured), ...mergeOptions(COPILOT_CATALOG, configuredRows)]
  return {
    models,
    // Verified against the installed CLI's option list: no effort/reasoning
    // level flag exists, so the composer shows no effort control for Copilot.
    efforts: [],
    supportsAttachments: true,
    provider: { id: 'github', detail: null },
    modelSource: strongestSource(models),
    defaults: { model: configured, effort: null },
    note: 'no-listing'
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
    ...(configured ? { resolvedId: configured } : {})
  }
}

/**
 * The model in the Copilot CLI's own config. The key isn't documented, so the
 * three plausible spellings are tried — a wrong guess costs nothing (the row
 * simply isn't marked configured), while missing the right one would show the
 * user a default they never chose.
 */
function configuredModel(
  deps: CopilotCatalogDeps,
  readJson: <T>(path: string) => T | null
): string | null {
  const home = asText(deps.env.COPILOT_HOME) ?? join(deps.home, '.copilot')
  const config = readJson<Record<string, unknown>>(join(home, 'config.json'))
  if (!config) return null
  return (
    asText(config.model) ??
    asText(config.selectedModel) ??
    asText(config.defaultModel) ??
    asText(asRecord(config.agent)?.model)
  )
}
