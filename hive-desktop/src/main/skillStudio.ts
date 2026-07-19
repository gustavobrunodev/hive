import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'

import {
  classifySkill,
  listSkills,
  listWorkspaceCatalog,
  parseSkillManifestCsv,
  type SkillEntry,
  type WorkspaceSkill
} from './workflowCatalog'

/**
 * `SkillStudio` — the main-process half of the "Estúdio de skills" feature:
 * discovering the skills the *user* created in a workspace (via the BMAD
 * builder skills, or by hand) so the renderer can list them, offer eval
 * runs, and pin them as shortcuts.
 *
 * "Created by the user" is data-driven, not tracked state: any
 * `.claude/skills/<dir>/SKILL.md` whose directory name is NOT in BMAD's
 * installed-skill manifest (`_bmad/_config/skill-manifest.csv`) was put
 * there by someone other than the BMAD installer. That covers skills built
 * by `bmad-workflow-builder`/`bmad-agent-builder` (the studio's own flow
 * instructs them to install there — Claude Code only resolves skills under
 * `.claude/skills/`) as well as skills the user dropped in manually. No
 * sidecar registry to drift out of sync with the disk.
 */
export interface CreatedSkill {
  /** The skill's launch key (= its directory name; a leading-slash prompt invokes it). */
  key: string
  /** Frontmatter `name` (falls back to the directory name). */
  name: string
  /** Frontmatter `description` — what the skill does / when it triggers. */
  description: string
  /** Same agent-vs-workflow classification the shortcut catalog uses. */
  kind: 'skill' | 'agent'
  /** The specialist's first name when the description carries one. */
  persona: string | null
  /** Whether `<skill>/evals/` exists with at least one file (bmad-eval-runner's primary discovery location). */
  hasEvals: boolean
  /** Best-effort count of eval cases found in `<skill>/evals/` (0 when uncountable/absent). */
  evalCases: number
  /** Workspace-relative path to the skill's directory (trash / eval-runner arg). */
  relPath: string
  /** SKILL.md mtime — "updated <relative time>" in the studio gallery. */
  updatedAt: number
}

/** Directory (workspace-relative) where Claude Code resolves skills — the studio's create prompts install there, and the scan reads from there. */
export const CREATED_SKILLS_DIR = '.claude/skills'

/**
 * Parses a SKILL.md's leading YAML frontmatter block into a flat
 * string→string map. Deliberately minimal — BMAD/Claude skill frontmatter
 * is `name:`/`description:` scalars (sometimes quoted, sometimes wrapping
 * onto indented continuation lines); a YAML dependency would be the first
 * in the main process for two keys. Missing/malformed frontmatter → `{}`.
 */
export function parseSkillFrontmatter(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return {}

  const fields: Record<string, string> = {}
  let currentKey: string | null = null
  for (const line of lines.slice(1)) {
    if (line.trim() === '---') break
    const keyMatch = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (keyMatch) {
      currentKey = keyMatch[1]
      fields[currentKey] = keyMatch[2].trim()
    } else if (currentKey && /^\s+\S/.test(line)) {
      // Indented continuation of the previous scalar (folded/wrapped value).
      const joiner = fields[currentKey] === '' ? '' : ' '
      fields[currentKey] = `${fields[currentKey]}${joiner}${line.trim()}`
    }
  }

  for (const key of Object.keys(fields)) {
    const value = fields[key]
    // Strip one layer of symmetric quotes and YAML block-scalar markers.
    fields[key] = value.replace(/^(['"])([\s\S]*)\1$/, '$2').replace(/^[>|][+-]?\s*/, '')
  }
  return fields
}

/** The keys BMAD's own installer owns in this workspace — everything else under `.claude/skills/` is user-created. Missing manifest → empty set. */
async function readInstalledSkillKeys(workspaceRoot: string): Promise<Set<string>> {
  try {
    const text = await readFile(
      join(workspaceRoot, '_bmad', '_config', 'skill-manifest.csv'),
      'utf-8'
    )
    const keys = new Set<string>()
    for (const row of parseSkillManifestCsv(text)) {
      if (row.canonicalId) keys.add(row.canonicalId)
      if (row.name) keys.add(row.name)
    }
    return keys
  } catch {
    return new Set()
  }
}

/**
 * Counts the eval cases inside one `<skill>/evals/` file, best-effort:
 * a JSON array (or `{ cases: [...] }`) counts its entries; a JSONL file
 * counts its non-empty lines; anything else counts 0 (present but not a
 * countable cases file).
 */
function countCasesIn(fileName: string, text: string): number {
  if (fileName.endsWith('.jsonl')) {
    return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length
  }
  if (!fileName.endsWith('.json')) return 0
  try {
    const parsed: unknown = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.length
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { cases?: unknown }).cases)
    )
      return (parsed as { cases: unknown[] }).cases.length
  } catch {
    // Malformed JSON — present, but not countable.
  }
  return 0
}

/** Scans `<skillDir>/evals/` (bmad-eval-runner's primary discovery path). Missing dir → `{ hasEvals: false, evalCases: 0 }`. */
async function scanEvals(skillDir: string): Promise<Pick<CreatedSkill, 'hasEvals' | 'evalCases'>> {
  const evalsDir = join(skillDir, 'evals')
  let entries: string[]
  try {
    entries = await readdir(evalsDir)
  } catch {
    return { hasEvals: false, evalCases: 0 }
  }
  let cases = 0
  for (const entry of entries) {
    if (!entry.endsWith('.json') && !entry.endsWith('.jsonl')) continue
    try {
      cases += countCasesIn(entry, await readFile(join(evalsDir, entry), 'utf-8'))
    } catch {
      // Unreadable file — still counts as "evals exist".
    }
  }
  return { hasEvals: entries.length > 0, evalCases: cases }
}

/**
 * Lists the workspace's user-created skills for the studio gallery — every
 * `.claude/skills/<dir>/SKILL.md` not owned by the BMAD manifest, classified
 * with the same agent-vs-workflow rule as the shortcut catalog, with eval
 * presence/count from the skill's own `evals/` directory. Missing skills
 * dir, unreadable entries, or no BMAD install at all → `[]`/partial results,
 * never throws.
 */
export async function listCreatedSkills(workspaceRoot: string): Promise<CreatedSkill[]> {
  const skillsRoot = join(workspaceRoot, CREATED_SKILLS_DIR)
  let dirs: string[]
  try {
    dirs = (await readdir(skillsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
  } catch {
    return []
  }

  const installed = await readInstalledSkillKeys(workspaceRoot)
  const created: CreatedSkill[] = []

  for (const dir of dirs.sort()) {
    if (installed.has(dir)) continue
    const skillDir = join(skillsRoot, dir)
    const skillMdPath = join(skillDir, 'SKILL.md')

    let text: string
    let updatedAt: number
    try {
      text = await readFile(skillMdPath, 'utf-8')
      updatedAt = (await stat(skillMdPath)).mtimeMs
    } catch {
      continue // No SKILL.md — not a skill, whatever the directory is.
    }

    const frontmatter = parseSkillFrontmatter(text)
    const description = frontmatter['description'] ?? ''
    const { kind, persona } = classifySkill(description, `${CREATED_SKILLS_DIR}/${dir}`)
    created.push({
      key: dir,
      name: frontmatter['name'] || dir,
      description,
      kind,
      persona,
      ...(await scanEvals(skillDir)),
      relPath: `${CREATED_SKILLS_DIR}/${dir}`,
      updatedAt
    })
  }
  return created
}

/**
 * The shortcut-customization catalog including user-created skills: BMAD's
 * installed catalog first, then every created skill as a `custom: true`
 * entry (module `"custom"`). Created skills thereby become pinnable
 * shortcuts through the existing `ShortcutPrefs`/`resolveShortcuts` path
 * with zero changes there — validation against this merged catalog is what
 * keeps a pinned created skill resolving after it's built.
 */
export async function listCatalogWithCreated(workspaceRoot: string): Promise<WorkspaceSkill[]> {
  const [catalog, created] = await Promise.all([
    listWorkspaceCatalog(workspaceRoot),
    listCreatedSkills(workspaceRoot)
  ])
  const known = new Set(catalog.map((skill) => skill.key))
  const extra: WorkspaceSkill[] = created
    .filter((skill) => !known.has(skill.key))
    .map((skill) => ({
      key: skill.key,
      label: skill.name,
      description: skill.description,
      module: 'custom',
      kind: skill.kind,
      persona: skill.persona,
      custom: true
    }))
  return [...catalog, ...extra]
}

/**
 * The chat slash-menu list including user-created skills, so `/minha-skill`
 * autocompletes the moment the builder finishes it — BMAD's workflow rows
 * first (unchanged), created skills appended.
 */
export async function listSkillsWithCreated(workspaceRoot: string): Promise<SkillEntry[]> {
  const [skills, created] = await Promise.all([
    listSkills(workspaceRoot),
    listCreatedSkills(workspaceRoot)
  ])
  const known = new Set(skills.map((skill) => skill.key))
  const extra = created
    .filter((skill) => !known.has(skill.key))
    .map((skill) => ({ key: skill.key, label: skill.name, description: skill.description }))
  return [...skills, ...extra]
}
