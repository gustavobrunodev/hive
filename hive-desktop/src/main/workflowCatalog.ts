import { readFile } from 'fs/promises'
import { join } from 'path'

import type { WorkflowCommand } from './agentAdapter'

/**
 * `WorkflowCatalog` — the curated intent→BMAD-command map plus a
 * dynamic-discovery fallback (T17). See design.md §2 (`WorkflowCatalog` row),
 * §3 (`WorkflowEntry` sketch), §7 "PRD workflow command + output path" and
 * "Workflow catalog — dynamic-discovery source found", and context.md C6
 * ("curated catalog + dynamic fallback").
 *
 * Re-uses `WorkflowCommand` from `agentAdapter.ts` unchanged (T13's
 * `{ key: string; prompt?: string }` placeholder) — this task supplies real
 * *values* for it, not a new shape. `command.key` names the BMAD Claude Code
 * *skill* to invoke (e.g. `"bmad-prd"`); `command.prompt`, when given, is the
 * literal natural-language instruction `AgentSession.runWorkflow` sends
 * (BMAD skills are resolved by Claude Code matching a message against each
 * `SKILL.md`'s `description` frontmatter — there is no special CLI
 * invocation syntax; see design.md §7 "A4 — resolved").
 */
export interface WorkflowEntry {
  /**
   * Intent key. design.md §3 sketches this as a closed union
   * (`"prd" | "domain-research" | "brainstorm" | "architecture" | "story"`)
   * for the curated five; kept as `string` here (not that literal union) so
   * `listWithDiscovery`'s dynamic fallback can extend the catalog with
   * additional BMAD skills beyond the curated five (M3 scope per C6) without
   * a type change later. The curated five below always use those five exact
   * string values.
   */
  key: string
  label: string
  /** How the adapter drives BMAD for this intent. */
  command: WorkflowCommand
  /** MVP: only `prd` is `"wired"`; the rest are visible-but-secondary (R7.1). */
  status: 'wired' | 'planned'
}

/**
 * The curated catalog (C6, R7.3). Skill names and the `prd` prompt are
 * **directly observed** from the real `bmad-method@6.10.0` throwaway install
 * T0 captured (`.claude/skills/<skill>/SKILL.md` frontmatter `name`/
 * `description`, and `_bmad/_config/bmad-help.csv`'s `skill` column) — not
 * guessed:
 *
 * - `bmad-prd` — "Create, update, or validate a PRD. Use when the user wants
 *   help producing, editing, or validating a PRD." An older `bmad-create-prd`
 *   skill still exists but its own frontmatter says it's a deprecated
 *   compatibility shim that forwards to `bmad-prd` — wired to `bmad-prd`
 *   directly per design.md §7.
 * - `bmad-domain-research`, `bmad-brainstorming`, `bmad-create-story` — the
 *   live (non-deprecated) skill names for those intents.
 * - `bmad-architecture` — the live skill; a sibling `bmad-create-architecture`
 *   skill's own frontmatter is explicitly `'DEPRECATED — consolidated into
 *   bmad-architecture create intent'`, so (mirroring the `prd` case)
 *   `bmad-architecture` is used, not the deprecated name.
 *
 * Only `prd`'s `command.prompt` is populated: it's the one workflow this
 * task wires for real (R7.2). The other four are `status: "planned"`
 * (R7.1 — visible, not yet triggerable; M2-M4 per spec.md) so their
 * `command` is a reasonable placeholder (just `command.key`, no `prompt` —
 * `AgentSession.runWorkflow`'s documented fallback is a generic "run
 * workflow `key`" instruction per agentAdapter.ts) rather than a real,
 * user-triggerable prompt.
 */
const CURATED_CATALOG: readonly WorkflowEntry[] = [
  {
    key: 'prd',
    label: 'Create a PRD',
    command: {
      key: 'bmad-prd',
      prompt: 'Use the bmad-prd skill to create a PRD.'
    },
    status: 'wired'
  },
  {
    key: 'domain-research',
    label: 'Domain Research',
    command: { key: 'bmad-domain-research' },
    status: 'planned'
  },
  {
    key: 'brainstorm',
    label: 'Brainstorm',
    command: { key: 'bmad-brainstorming' },
    status: 'planned'
  },
  {
    key: 'architecture',
    label: 'Architecture',
    command: { key: 'bmad-architecture' },
    status: 'planned'
  },
  {
    key: 'story',
    label: 'Create a Story',
    command: { key: 'bmad-create-story' },
    status: 'planned'
  }
]

/** Returns the curated catalog. Works with no BMAD install present at all —
 *  this is the base case `listWithDiscovery` always falls back to. */
export function list(): WorkflowEntry[] {
  // Deep-ish copy (including nested `command`) so callers can't mutate the
  // module-level curated data through the returned array.
  return CURATED_CATALOG.map((entry) => ({ ...entry, command: { ...entry.command } }))
}

/**
 * One row of `_bmad/_config/bmad-help.csv`, the machine-readable
 * module/skill/description/output-location catalog BMAD itself installs
 * (design.md §7 "Workflow catalog — dynamic-discovery source found"). Field
 * names/casing here mirror the CSV's own header exactly, as captured from
 * the real throwaway install — do not rename without re-checking that file:
 *
 *   module,skill,display-name,menu-code,description,action,args,phase,
 *   preceded-by,followed-by,required,output-location,outputs
 *
 * (Note: the real header has two extra columns, `action` and `args`, beyond
 * what design.md §7's prose describes — captured here since they're present
 * in the file, even though this task doesn't use them.)
 */
export interface BmadHelpRow {
  module: string
  skill: string
  displayName: string
  menuCode: string
  description: string
  action: string
  args: string
  phase: string
  precededBy: string
  followedBy: string
  required: string
  outputLocation: string
  outputs: string
}

const BMAD_HELP_CSV_COLUMNS: ReadonlyArray<keyof BmadHelpRow> = [
  'module',
  'skill',
  'displayName',
  'menuCode',
  'description',
  'action',
  'args',
  'phase',
  'precededBy',
  'followedBy',
  'required',
  'outputLocation',
  'outputs'
]

/**
 * Splits one CSV line into fields, honoring double-quoted fields that
 * contain commas (several `bmad-help.csv` `description` values do, e.g. the
 * `prd` row's). Handles `""` as an escaped quote inside a quoted field.
 * Deliberately simple — a hand-rolled state machine rather than a dependency
 * (none of this repo's other main-process modules pull in a CSV library),
 * and this file has no embedded newlines inside quoted fields to worry
 * about (confirmed against the real captured install).
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

/**
 * Parses `bmad-help.csv`'s full contents into rows, matching columns by the
 * file's own header line (not a hardcoded index order) so a harmless column
 * reorder upstream doesn't silently misalign fields. Malformed input (no
 * recognizable header, empty file) yields `[]` rather than throwing —
 * callers fall back to the curated catalog in that case.
 */
export function parseBmadHelpCsv(text: string): BmadHelpRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const header = parseCsvLine(lines[0]).map((h) => h.trim())
  // Map each expected BmadHelpRow field to the header's column index by
  // matching the CSV's own kebab-case column name (e.g. "display-name" ->
  // `displayName`), so this stays correct even if the CSV's column order
  // ever changes.
  const headerToField = new Map<string, keyof BmadHelpRow>([
    ['module', 'module'],
    ['skill', 'skill'],
    ['display-name', 'displayName'],
    ['menu-code', 'menuCode'],
    ['description', 'description'],
    ['action', 'action'],
    ['args', 'args'],
    ['phase', 'phase'],
    ['preceded-by', 'precededBy'],
    ['followed-by', 'followedBy'],
    ['required', 'required'],
    ['output-location', 'outputLocation'],
    ['outputs', 'outputs']
  ])

  const fieldIndex = new Map<keyof BmadHelpRow, number>()
  header.forEach((columnName, index) => {
    const field = headerToField.get(columnName)
    if (field) fieldIndex.set(field, index)
  })

  // No recognizable columns at all — treat as malformed rather than
  // producing rows full of empty strings.
  if (fieldIndex.size === 0) return []

  const rows: BmadHelpRow[] = []
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line)
    const row = {} as BmadHelpRow
    for (const field of BMAD_HELP_CSV_COLUMNS) {
      const index = fieldIndex.get(field)
      row[field] = index !== undefined ? (values[index] ?? '').trim() : ''
    }
    rows.push(row)
  }
  return rows
}

/**
 * One discovered BMAD skill for the chat slash-command menu (chat-controls
 * CC-R3.1). A flatter shape than `WorkflowEntry` — the slash menu only needs a
 * launch key, a human label, and a description to filter/display.
 */
export interface SkillEntry {
  /** The BMAD skill name (`command.key` when launched via `agent.runWorkflow`). */
  key: string
  /** Human display name (`display-name` column, falling back to the skill name). */
  label: string
  /** One-line description (`description` column) — shown muted, and filtered on. */
  description: string
}

/**
 * Lists the *full* set of BMAD workflow skills installed in a workspace, for
 * the chat slash-command menu (CC-R2/R3). Reuses the same `bmad-help.csv`
 * source and `parseBmadHelpCsv` parser as `listWithDiscovery` — this is the
 * complete list (~34 rows), not the curated five. Deduplicates by skill (some
 * skills appear as multiple menu-action rows) and skips `_meta`/blank rows.
 *
 * Note (CC-R3): `bmad-help.csv` is BMAD's *workflow* catalog — it does not list
 * the `bmad-agent-*`/`bmad-tea` personas, so those never appear in the slash
 * menu (they're reached via role actions instead — role-personalization). This
 * source is BMAD workspace metadata, not a Claude-specific surface, keeping the
 * menu agent-agnostic. Missing/unreadable/empty CSV → `[]` (CC-R2.5), never
 * throws.
 */
export async function listSkills(workspaceRoot: string): Promise<SkillEntry[]> {
  const csvPath = join(workspaceRoot, '_bmad', '_config', 'bmad-help.csv')

  let rows: BmadHelpRow[]
  try {
    const text = await readFile(csvPath, 'utf-8')
    rows = parseBmadHelpCsv(text)
  } catch {
    return []
  }

  const seen = new Set<string>()
  const skills: SkillEntry[] = []
  for (const row of rows) {
    if (!row.skill || row.skill === '_meta') continue
    if (seen.has(row.skill)) continue
    seen.add(row.skill)
    skills.push({
      key: row.skill,
      label: row.displayName || row.skill,
      description: row.description
    })
  }
  return skills
}

/**
 * One entry of the *full* workspace skill catalog (shortcut-customization):
 * every BMAD skill installed in the workspace — workflows AND specialist
 * agents — as offered by the "Personalizar atalhos" picker. Sourced from
 * `_bmad/_config/skill-manifest.csv` (the only BMAD-installed catalog that
 * lists the `bmad-agent-*`/`bmad-tea` persona skills; `bmad-help.csv` covers
 * workflows only), with `bmad-help.csv` contributing nicer display names
 * where it knows the skill.
 */
export interface WorkspaceSkill {
  /** The skill name — `command.key` when launched via `agent.runWorkflow`. */
  key: string
  /**
   * Best-effort human display name: `bmad-help.csv`'s `display-name` when
   * present, the persona's first name for agents, else the raw skill name.
   * The renderer maps known keys to pt-BR labels and uses this as fallback.
   */
  label: string
  /** One-line description (SKILL.md frontmatter, English) — searched on. */
  description: string
  /** BMAD module (`core`, `bmm`, `tea`, `bmb`…) — grouping metadata. */
  module: string
  /** `agent` = a "talk to <persona>" specialist skill; `skill` = a workflow. */
  kind: 'skill' | 'agent'
  /** The specialist's first name ("John", "Sally") when detectable, else null. */
  persona: string | null
  /**
   * `true` for a user-created skill (skill-studio: found under
   * `.claude/skills/` but absent from BMAD's install manifest). Absent —
   * not `false` — on BMAD-installed entries, keeping this additive.
   */
  custom?: boolean
}

/**
 * One row of `_bmad/_config/skill-manifest.csv` — BMAD's complete installed-
 * skill manifest (62 rows in the real captured install vs. bmad-help.csv's
 * workflow-only view). Header observed from a real install:
 *
 *   canonicalId,name,description,module,path
 */
interface SkillManifestRow {
  canonicalId: string
  name: string
  description: string
  module: string
  path: string
}

/** Parses `skill-manifest.csv` with the same header-mapped tolerance as `parseBmadHelpCsv` — malformed input yields `[]`, never throws. */
export function parseSkillManifestCsv(text: string): SkillManifestRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const header = parseCsvLine(lines[0]).map((h) => h.trim())
  const columns: ReadonlyArray<keyof SkillManifestRow> = [
    'canonicalId',
    'name',
    'description',
    'module',
    'path'
  ]
  const fieldIndex = new Map<keyof SkillManifestRow, number>()
  header.forEach((columnName, index) => {
    if ((columns as readonly string[]).includes(columnName)) {
      fieldIndex.set(columnName as keyof SkillManifestRow, index)
    }
  })
  if (!fieldIndex.has('canonicalId') && !fieldIndex.has('name')) return []

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row = {} as SkillManifestRow
    for (const field of columns) {
      const index = fieldIndex.get(field)
      row[field] = index !== undefined ? (values[index] ?? '').trim() : ''
    }
    return row
  })
}

/**
 * The agent-skill detector. BMAD persona skills describe themselves as
 * "Use when the user asks to talk to <Name>…" (observed across every
 * `bmad-agent-*` and `bmad-tea` SKILL.md in the real install) — that's the
 * primary signal, and it also yields the persona's display name. The path
 * fallback (`…/agents/…`, e.g. `_bmad/tea/agents/bmad-tea/`) catches an
 * agent whose description drops the phrase. Note `bmad-agent-builder` is
 * deliberately NOT an agent (it *builds* agents — its description has no
 * "talk to", and its path has no `/agents/` segment).
 */
const TALK_TO_PATTERN = /talk to ([A-Za-zÀ-ſ]+)/i

export function classifySkill(
  description: string,
  path: string
): Pick<WorkspaceSkill, 'kind' | 'persona'> {
  const match = TALK_TO_PATTERN.exec(description)
  if (match) return { kind: 'agent', persona: match[1] }
  if (/(^|\/)agents\//.test(path)) return { kind: 'agent', persona: null }
  return { kind: 'skill', persona: null }
}

/** Deprecated compatibility shims (e.g. `bmad-create-prd`) self-describe as "DEPRECATED — consolidated into …" — never offered as shortcuts. */
function isDeprecated(description: string): boolean {
  return description.toUpperCase().includes('DEPRECATED')
}

/**
 * Reads `bmad-help.csv`'s first `display-name` per skill — the friendliest
 * label source available ("Create Brief", "Domain Research"). Missing or
 * unreadable file yields an empty map (labels then fall back per
 * `WorkspaceSkill.label`'s chain).
 */
async function readDisplayNames(workspaceRoot: string): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  try {
    const text = await readFile(join(workspaceRoot, '_bmad', '_config', 'bmad-help.csv'), 'utf-8')
    for (const row of parseBmadHelpCsv(text)) {
      if (!row.skill || row.skill === '_meta' || !row.displayName) continue
      if (!names.has(row.skill)) names.set(row.skill, row.displayName)
    }
  } catch {
    // No help CSV — labels fall back to persona/skill names.
  }
  return names
}

/**
 * Lists the complete workspace skill catalog for shortcut customization:
 * every installed, non-deprecated BMAD skill, classified as `agent` or
 * `skill`. Primary source is `skill-manifest.csv`; when it's missing
 * (older BMAD installs), falls back to `bmad-help.csv`'s workflow rows so
 * the picker still works (agents then simply aren't listed). Missing/
 * malformed everything → `[]`, never throws.
 */
export async function listWorkspaceCatalog(workspaceRoot: string): Promise<WorkspaceSkill[]> {
  const displayNames = await readDisplayNames(workspaceRoot)

  let rows: SkillManifestRow[]
  try {
    const text = await readFile(
      join(workspaceRoot, '_bmad', '_config', 'skill-manifest.csv'),
      'utf-8'
    )
    rows = parseSkillManifestCsv(text)
  } catch {
    rows = []
  }

  if (rows.length === 0) {
    // Manifest unavailable — degrade to the workflow-only view.
    const workflows = await listSkills(workspaceRoot)
    return workflows.map((entry) => ({
      key: entry.key,
      label: entry.label,
      description: entry.description,
      module: '',
      kind: 'skill' as const,
      persona: null
    }))
  }

  const seen = new Set<string>()
  const catalog: WorkspaceSkill[] = []
  for (const row of rows) {
    const key = row.canonicalId || row.name
    if (!key || seen.has(key) || isDeprecated(row.description)) continue
    seen.add(key)
    const { kind, persona } = classifySkill(row.description, row.path)
    catalog.push({
      key,
      label: displayNames.get(key) ?? persona ?? key,
      description: row.description,
      module: row.module,
      kind,
      persona
    })
  }
  return catalog
}

/**
 * Extends the curated catalog with dynamic discovery from an installed
 * BMAD, reading `<workspaceRoot>/_bmad/_config/bmad-help.csv` (the concrete
 * mechanism design.md §7 recommends over guessing at other formats). Plain
 * `fs/promises`, no `electron` dependency, mirroring `configStore.ts`'s DI
 * style — unit-testable against a plain temp directory.
 *
 * Modest, M3-scoped merge (per this task's brief): the curated five always
 * come back as-is (in particular `prd` always stays `status: "wired"` —
 * discovery only *adds*, it never demotes a curated entry based on what it
 * does or doesn't find in the CSV). Any additional skill rows found in the
 * CSV that aren't already one of the curated five's `command.key`s are
 * appended as extra `status: "planned"` entries — useful groundwork for
 * surfacing more BMAD skills later, without committing to it now.
 *
 * Missing file, unreadable file, or a CSV that doesn't parse to any rows all
 * fall back cleanly to the plain curated list — this never throws.
 */
export async function listWithDiscovery(workspaceRoot: string): Promise<WorkflowEntry[]> {
  const curated = list()
  const csvPath = join(workspaceRoot, '_bmad', '_config', 'bmad-help.csv')

  let rows: BmadHelpRow[]
  try {
    const text = await readFile(csvPath, 'utf-8')
    rows = parseBmadHelpCsv(text)
  } catch {
    // Missing file, permission error, etc. — no BMAD data available.
    return curated
  }

  if (rows.length === 0) return curated

  const curatedSkillKeys = new Set(curated.map((entry) => entry.command.key))
  const seenSkills = new Set<string>()
  const discovered: WorkflowEntry[] = []

  for (const row of rows) {
    // `_meta` rows carry no skill (module-level metadata, e.g. a docs URL in
    // `output-location`) — not a workflow.
    if (!row.skill || row.skill === '_meta') continue
    if (curatedSkillKeys.has(row.skill)) continue
    // Some skills (e.g. `bmad-create-story`) appear as multiple rows, one
    // per menu action (create/validate) — surface the skill once.
    if (seenSkills.has(row.skill)) continue
    seenSkills.add(row.skill)

    discovered.push({
      key: row.skill,
      label: row.displayName || row.skill,
      command: { key: row.skill },
      status: 'planned'
    })
  }

  return [...curated, ...discovered]
}
