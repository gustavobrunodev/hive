import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * "Sempre permitir", written where the agent itself will read it.
 *
 * ## The defect
 *
 * Clicking *Sempre permitir* used to record the grant in **Hive's own** config
 * store and nowhere else. That does work — Hive brokers every permission
 * prompt through `approvalService`, so the next matching call is auto-allowed
 * without asking — but it is invisible and non-portable: the user opens
 * `.claude/` expecting to find what they just authorized and finds nothing,
 * the CLI still round-trips through Hive for a call it was told to stop asking
 * about, and running the same agent outside Hive re-asks everything.
 *
 * A standing grant is a statement about *the agent in this workspace*, so it
 * belongs in that agent's own permission file, in that agent's own syntax.
 *
 * ## Per-agent reality
 *
 * Only the Claude CLI has a permission file to write: `-p` mode reads
 * `<workspace>/.claude/settings.local.json` and honours `permissions.allow`,
 * which is the same file `mcpService.ts` already maintains. The GitHub Copilot
 * CLI is launched with `--allow-all-tools` and never prompts at all, and the
 * Devin CLI exposes no permission surface — for both, `null` is the honest
 * answer, and Hive's own rule remains the only (unused) record.
 *
 * The grant is *additive and idempotent*: unrelated keys in the file are
 * preserved byte-for-byte, and re-granting the same rule is a no-op rather
 * than a duplicate entry.
 */

const CLAUDE_DIR = '.claude'
const CLAUDE_SETTINGS_FILE = 'settings.local.json'

/** Agent ids as `agentRegistry.ts` registers them. */
const CLAUDE_AGENT = 'claude-cli'

export interface PermissionGrant {
  /** Absolute path of the file the rule was written into. */
  file: string
  /** The rule as that agent's config spells it (e.g. `Bash(mkdir:*)`). */
  rule: string
}

/** The pending call a standing grant was made from. */
export interface GrantRequest {
  agentId: string
  workspace: string
  tool: string
  input?: Record<string, unknown>
}

/**
 * Translates one approved call into the Claude CLI's permission syntax.
 *
 * A shell command is granted by its **executable**, spelled as Claude's prefix
 * pattern (`Bash(mkdir:*)`) — the same granularity `approvalRuleFor` uses in
 * `approvalService.ts`, and the same one a person reasons about. Remembering
 * the whole command line would never match twice; remembering bare `Bash`
 * would hand over the entire shell on one click.
 *
 * Every other tool — including MCP tools, which are already namespaced
 * `mcp__server__tool` — is granted by name, which is exactly what the user was
 * shown on the card.
 */
export function claudePermissionRule(
  tool: string,
  input: Record<string, unknown> | undefined
): string | null {
  if (tool === '') return null
  if (tool !== 'Bash') return tool
  const command = typeof input?.command === 'string' ? input.command.trim() : ''
  const head = command.split(/\s+/)[0] ?? ''
  // A `Bash` call with no readable command can't be narrowed, and granting the
  // whole shell is not something to do silently — Hive's own rule still
  // covers it, so nothing is written here.
  return head === '' ? null : `Bash(${head}:*)`
}

/** The fields written here; everything else in the file is round-tripped untouched. */
interface ClaudeSettings {
  permissions?: {
    allow?: unknown
    [key: string]: unknown
  }
  [key: string]: unknown
}

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return {}
  }
  try {
    const parsed = JSON.parse(text) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    // A hand-broken settings file is the user's, not ours to overwrite.
    throw new Error(`Invalid JSON in ${path}`)
  }
}

/** Atomically writes pretty JSON (temp file + rename), creating parent dirs. */
async function writeJsonObject(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tmp, path)
}

/**
 * Records a standing grant in the agent's own permission config.
 *
 * Returns the grant that was written, or `null` when this agent has no
 * permission file to write (Copilot, Devin) or the call can't be narrowed to a
 * safe rule. Never throws for an absent file — that is the common case on the
 * first grant in a workspace.
 */
export async function grantAgentPermission(request: GrantRequest): Promise<PermissionGrant | null> {
  if (request.agentId !== CLAUDE_AGENT) return null
  if (request.workspace === '') return null
  const rule = claudePermissionRule(request.tool, request.input)
  if (rule === null) return null

  const file = join(request.workspace, CLAUDE_DIR, CLAUDE_SETTINGS_FILE)
  const settings = (await readJsonObject(file)) as ClaudeSettings
  const permissions =
    settings.permissions !== undefined &&
    settings.permissions !== null &&
    typeof settings.permissions === 'object' &&
    !Array.isArray(settings.permissions)
      ? settings.permissions
      : {}
  const allow = Array.isArray(permissions.allow)
    ? permissions.allow.filter((entry): entry is string => typeof entry === 'string')
    : []
  if (allow.includes(rule)) return { file, rule }

  await writeJsonObject(file, {
    ...settings,
    permissions: { ...permissions, allow: [...allow, rule] }
  })
  return { file, rule }
}

/**
 * Drops every rule Hive granted from the agent's config (the profile's
 * "esquecer permissões"). Only the listed rules are removed — a rule the user
 * wrote by hand, or one another tool added, is left alone.
 */
export async function revokeAgentPermissions(
  agentId: string,
  workspace: string,
  rules: string[]
): Promise<void> {
  if (agentId !== CLAUDE_AGENT || workspace === '' || rules.length === 0) return
  const file = join(workspace, CLAUDE_DIR, CLAUDE_SETTINGS_FILE)
  const settings = (await readJsonObject(file)) as ClaudeSettings
  const permissions = settings.permissions
  if (permissions === undefined || permissions === null || typeof permissions !== 'object') return
  const allow = Array.isArray(permissions.allow)
    ? permissions.allow.filter((entry): entry is string => typeof entry === 'string')
    : []
  const drop = new Set(rules)
  const kept = allow.filter((entry) => !drop.has(entry))
  if (kept.length === allow.length) return
  await writeJsonObject(file, { ...settings, permissions: { ...permissions, allow: kept } })
}
