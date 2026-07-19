import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  list,
  listWithDiscovery,
  listSkills,
  listWorkspaceCatalog,
  parseBmadHelpCsv,
  parseSkillManifestCsv
} from './workflowCatalog'

// A trimmed fixture of the *real* `_bmad/_config/bmad-help.csv` header and a
// handful of its actual rows, as captured from the T0 throwaway
// `bmad-method@6.10.0` install (see design.md §7 "Workflow catalog —
// dynamic-discovery source found"). Not invented: same column order/names,
// and the `bmad-prd` row is copied verbatim (including its quoted,
// comma-containing `description` field) to exercise CSV quoting. Also
// includes a `bmad-market-research` row (not one of the curated five) to
// exercise dynamic-discovery extension, and a duplicate `bmad-create-story`
// row (create + validate menu actions) to exercise skill de-duplication.
const REAL_BMAD_HELP_CSV = `module,skill,display-name,menu-code,description,action,args,phase,preceded-by,followed-by,required,output-location,outputs
BMad Method,_meta,,,,,,,,,false,https://docs.bmad-method.org/llms.txt,
BMad Method,bmad-market-research,Market Research,MR,Market analysis competitive landscape customer needs and trends.,,,1-analysis,,,false,planning_artifacts|project-knowledge,research documents
BMad Method,bmad-prd,Create Edit and Review PRD,PRD,"Facilitated PRD workflow — create a new PRD via coached discovery, update an existing one against a change signal, or validate a finished PRD against a checklist with an HTML findings report.",,,2-planning,bmad-product-brief,,true,planning_artifacts,prd
BMad Method,bmad-create-story,Create Story,CS,Story cycle start: Prepare first found story in the sprint plan that is next or a specific epic/story designation.,create,,4-implementation,bmad-sprint-planning,bmad-create-story:validate,true,implementation_artifacts,story
BMad Method,bmad-create-story,Validate Story,VS,Validates story readiness and completeness before development work begins.,validate,,4-implementation,bmad-create-story:create,bmad-dev-story,false,implementation_artifacts,story validation report
`

describe('WorkflowCatalog', () => {
  describe('list()', () => {
    it('returns a curated catalog with prd wired and the rest planned', () => {
      const catalog = list()

      expect(catalog).toHaveLength(5)

      const prd = catalog.find((entry) => entry.key === 'prd')
      expect(prd).toBeDefined()
      expect(prd?.status).toBe('wired')
      expect(prd?.command.key).toBe('bmad-prd')
      expect(prd?.command.prompt).toBeTruthy()

      const others = catalog.filter((entry) => entry.key !== 'prd')
      expect(others).toHaveLength(4)
      expect(others.map((entry) => entry.key).sort()).toEqual(
        ['architecture', 'brainstorm', 'domain-research', 'story'].sort()
      )
      for (const entry of others) {
        expect(entry.status).toBe('planned')
      }
    })

    it('returns a fresh array/objects each call (no shared mutable state)', () => {
      const a = list()
      const b = list()
      a[0].label = 'mutated'
      a[0].command.key = 'mutated'
      expect(b[0].label).not.toBe('mutated')
      expect(b[0].command.key).not.toBe('mutated')
    })
  })

  describe('parseBmadHelpCsv()', () => {
    it('parses the real header/rows, honoring quoted commas', () => {
      const rows = parseBmadHelpCsv(REAL_BMAD_HELP_CSV)
      const prdRow = rows.find((row) => row.skill === 'bmad-prd')
      expect(prdRow).toBeDefined()
      expect(prdRow?.displayName).toBe('Create Edit and Review PRD')
      // The description contains an em dash and internal commas inside
      // quotes — a naive comma-split would have shredded this field.
      expect(prdRow?.description).toContain(
        'create a new PRD via coached discovery, update an existing one'
      )
      expect(prdRow?.outputLocation).toBe('planning_artifacts')
    })

    it('returns [] for malformed/unrecognizable input', () => {
      expect(parseBmadHelpCsv('')).toEqual([])
      expect(parseBmadHelpCsv('not,a,real,header\nsome,junk,data,here')).toEqual([])
    })
  })

  describe('listWithDiscovery()', () => {
    let workspaceRoot: string

    beforeEach(() => {
      workspaceRoot = mkdtempSync(join(tmpdir(), 'hive-workflow-catalog-'))
    })

    afterEach(() => {
      rmSync(workspaceRoot, { recursive: true, force: true })
    })

    it('falls back cleanly to the curated list when no _bmad/ is present', async () => {
      const result = await listWithDiscovery(workspaceRoot)
      expect(result).toEqual(list())
    })

    it('falls back cleanly when bmad-help.csv is malformed', async () => {
      const configDir = join(workspaceRoot, '_bmad', '_config')
      mkdirSync(configDir, { recursive: true })
      writeFileSync(join(configDir, 'bmad-help.csv'), 'this is not a csv file at all')

      const result = await listWithDiscovery(workspaceRoot)
      expect(result).toEqual(list())
    })

    it('parses a real bmad-help.csv fixture, still includes wired prd, and extends the catalog', async () => {
      const configDir = join(workspaceRoot, '_bmad', '_config')
      mkdirSync(configDir, { recursive: true })
      writeFileSync(join(configDir, 'bmad-help.csv'), REAL_BMAD_HELP_CSV)

      const result = await listWithDiscovery(workspaceRoot)

      // Curated five still present, prd still wired.
      const prd = result.find((entry) => entry.key === 'prd')
      expect(prd?.status).toBe('wired')
      expect(prd?.command.key).toBe('bmad-prd')
      const curatedKeys = ['prd', 'domain-research', 'brainstorm', 'architecture', 'story']
      for (const key of curatedKeys) {
        expect(result.some((entry) => entry.key === key)).toBe(true)
      }

      // A skill outside the curated five (bmad-market-research) is
      // discovered and appended as planned.
      const discovered = result.find((entry) => entry.key === 'bmad-market-research')
      expect(discovered).toBeDefined()
      expect(discovered?.status).toBe('planned')
      expect(discovered?.label).toBe('Market Research')

      // bmad-create-story appears twice in the CSV (create/validate menu
      // actions) but is already one of the curated five — no duplicate
      // extra entry, and no second "story" entry for the raw skill key.
      const storyLikeEntries = result.filter((entry) => entry.command.key === 'bmad-create-story')
      expect(storyLikeEntries).toHaveLength(1)
    })
  })

  // chat-controls (CC-R3.1): the full installed-skill list for the slash menu.
  describe('listSkills()', () => {
    let workspaceRoot: string

    beforeEach(() => {
      workspaceRoot = mkdtempSync(join(tmpdir(), 'hive-skills-'))
    })

    afterEach(() => {
      rmSync(workspaceRoot, { recursive: true, force: true })
    })

    it('returns [] when no bmad-help.csv is present', async () => {
      expect(await listSkills(workspaceRoot)).toEqual([])
    })

    it('returns [] on a malformed csv', async () => {
      const configDir = join(workspaceRoot, '_bmad', '_config')
      mkdirSync(configDir, { recursive: true })
      writeFileSync(join(configDir, 'bmad-help.csv'), 'not a csv')
      expect(await listSkills(workspaceRoot)).toEqual([])
    })

    it('lists every skill (key/label/description), skips _meta, and dedupes multi-action skills', async () => {
      const configDir = join(workspaceRoot, '_bmad', '_config')
      mkdirSync(configDir, { recursive: true })
      writeFileSync(join(configDir, 'bmad-help.csv'), REAL_BMAD_HELP_CSV)

      const skills = await listSkills(workspaceRoot)

      // _meta row is skipped.
      expect(skills.some((s) => s.key === '_meta')).toBe(false)
      // bmad-create-story appears twice in the CSV → deduped to one entry.
      expect(skills.filter((s) => s.key === 'bmad-create-story')).toHaveLength(1)
      // Distinct workflow skills surfaced with label + description.
      const prd = skills.find((s) => s.key === 'bmad-prd')
      expect(prd?.label).toBe('Create Edit and Review PRD')
      expect(prd?.description).toMatch(/PRD/)
      expect(skills.map((s) => s.key)).toEqual(
        expect.arrayContaining(['bmad-market-research', 'bmad-prd', 'bmad-create-story'])
      )
    })
  })
})

// A trimmed fixture of the *real* `_bmad/_config/skill-manifest.csv` header
// and rows, as captured from the live install in this repo's own workspace
// root: same `canonicalId,name,description,module,path` columns. Includes the
// signals `listWorkspaceCatalog` classifies on — a "talk to <persona>" agent
// (bmad-agent-pm/John), an agent detected by its `/agents/` path with no
// "talk to" phrase (bmad-tea variant), `bmad-agent-builder` (agent-*named*
// but NOT a persona), and a DEPRECATED shim that must be filtered out.
const REAL_SKILL_MANIFEST_CSV = `canonicalId,name,description,module,path
"bmad-brainstorming","bmad-brainstorming","Facilitate a brainstorming session using diverse creative techniques.","core","_bmad/core/bmad-brainstorming/SKILL.md"
"bmad-agent-pm","bmad-agent-pm","Product manager for PRD creation and requirements discovery. Use when the user asks to talk to John or requests the product manager.","bmm","_bmad/bmm/2-plan-workflows/bmad-agent-pm/SKILL.md"
"bmad-agent-builder","bmad-agent-builder","Builds, edits or analyzes Agent Skills through conversational discovery.","bmb","_bmad/bmb/bmad-agent-builder/SKILL.md"
"bmad-tea","bmad-tea","Master Test Architect and Quality Advisor.","tea","_bmad/tea/agents/bmad-tea/SKILL.md"
"bmad-create-prd","bmad-create-prd","DEPRECATED — consolidated into bmad-prd create intent.","bmm","_bmad/bmm/2-plan-workflows/bmad-create-prd/SKILL.md"
"bmad-prd","bmad-prd","Create, update, or validate a PRD. Use when the user wants help producing, editing, or validating a PRD.","bmm","_bmad/bmm/2-plan-workflows/bmad-prd/SKILL.md"
`

describe('listWorkspaceCatalog() — shortcut-customization', () => {
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'hive-workspace-catalog-'))
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  function writeConfig(files: Record<string, string>): void {
    const configDir = join(workspaceRoot, '_bmad', '_config')
    mkdirSync(configDir, { recursive: true })
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(configDir, name), content)
    }
  }

  it('parseSkillManifestCsv maps the real header and tolerates malformed input', () => {
    const rows = parseSkillManifestCsv(REAL_SKILL_MANIFEST_CSV)
    expect(rows).toHaveLength(6)
    expect(rows[0]).toMatchObject({ canonicalId: 'bmad-brainstorming', module: 'core' })
    expect(parseSkillManifestCsv('')).toEqual([])
    expect(parseSkillManifestCsv('no,recognizable,columns\na,b,c')).toEqual([])
  })

  it('classifies agents ("talk to <persona>" or /agents/ path) apart from skills', async () => {
    writeConfig({ 'skill-manifest.csv': REAL_SKILL_MANIFEST_CSV })

    const catalog = await listWorkspaceCatalog(workspaceRoot)
    const byKey = new Map(catalog.map((s) => [s.key, s]))

    // "talk to John" → agent, persona captured.
    expect(byKey.get('bmad-agent-pm')).toMatchObject({ kind: 'agent', persona: 'John' })
    // `/agents/` path with no "talk to" phrase → still an agent.
    expect(byKey.get('bmad-tea')?.kind).toBe('agent')
    // Agent-*named* but neither signal → a plain skill (it builds agents).
    expect(byKey.get('bmad-agent-builder')?.kind).toBe('skill')
    expect(byKey.get('bmad-prd')?.kind).toBe('skill')
  })

  it('filters DEPRECATED shims and merges bmad-help display names as labels', async () => {
    writeConfig({
      'skill-manifest.csv': REAL_SKILL_MANIFEST_CSV,
      'bmad-help.csv': REAL_BMAD_HELP_CSV
    })

    const catalog = await listWorkspaceCatalog(workspaceRoot)

    expect(catalog.some((s) => s.key === 'bmad-create-prd')).toBe(false)
    // Label chain: bmad-help display-name > persona > key.
    expect(catalog.find((s) => s.key === 'bmad-prd')?.label).toBe('Create Edit and Review PRD')
    expect(catalog.find((s) => s.key === 'bmad-agent-pm')?.label).toBe('John')
    expect(catalog.find((s) => s.key === 'bmad-brainstorming')?.label).toBe('bmad-brainstorming')
  })

  it('falls back to the bmad-help workflow view when the manifest is missing', async () => {
    writeConfig({ 'bmad-help.csv': REAL_BMAD_HELP_CSV })

    const catalog = await listWorkspaceCatalog(workspaceRoot)

    expect(catalog.length).toBeGreaterThan(0)
    expect(catalog.every((s) => s.kind === 'skill')).toBe(true)
    expect(catalog.find((s) => s.key === 'bmad-prd')?.label).toBe('Create Edit and Review PRD')
  })

  it('returns [] when no BMAD metadata exists at all', async () => {
    expect(await listWorkspaceCatalog(workspaceRoot)).toEqual([])
  })
})
