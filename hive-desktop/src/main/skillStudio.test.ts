import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  listCatalogWithCreated,
  listCreatedSkills,
  listSkillsWithCreated,
  parseSkillFrontmatter
} from './skillStudio'

// Mirrors workflowCatalog.test.ts's real-install fixtures: the manifest
// header/quoting are the captured `skill-manifest.csv` shape, and the
// bmad-help header is the captured `bmad-help.csv` shape (both from the T0
// throwaway `bmad-method@6.10.0` install).
const MANIFEST_CSV = `canonicalId,name,description,module,path
"bmad-prd","bmad-prd","Create, update, or validate a PRD.","bmm","_bmad/bmm/workflows/bmad-prd/SKILL.md"
"bmad-agent-pm","bmad-agent-pm","Product manager. Use when the user asks to talk to John.","bmm","_bmad/bmm/agents/bmad-agent-pm/SKILL.md"
`

const BMAD_HELP_CSV = `module,skill,display-name,menu-code,description,action,args,phase,preceded-by,followed-by,required,output-location,outputs
BMad Method,bmad-prd,Create Edit and Review PRD,PRD,PRD workflow.,,,2-planning,,,true,planning_artifacts,prd
`

/** Writes a skill directory under `.claude/skills/<key>` with the given SKILL.md body (and optional evals files). */
function writeSkill(
  root: string,
  key: string,
  frontmatter: { name?: string; description?: string },
  evals?: Record<string, string>
): void {
  const dir = join(root, '.claude', 'skills', key)
  mkdirSync(dir, { recursive: true })
  const lines = ['---']
  if (frontmatter.name !== undefined) lines.push(`name: ${frontmatter.name}`)
  if (frontmatter.description !== undefined) lines.push(`description: ${frontmatter.description}`)
  lines.push('---', '', '# Body')
  writeFileSync(join(dir, 'SKILL.md'), lines.join('\n'), 'utf-8')
  if (evals) {
    mkdirSync(join(dir, 'evals'), { recursive: true })
    for (const [file, content] of Object.entries(evals)) {
      writeFileSync(join(dir, 'evals', file), content, 'utf-8')
    }
  }
}

function writeManifest(root: string, csv: string = MANIFEST_CSV): void {
  mkdirSync(join(root, '_bmad', '_config'), { recursive: true })
  writeFileSync(join(root, '_bmad', '_config', 'skill-manifest.csv'), csv, 'utf-8')
}

describe('SkillStudio (main)', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hive-studio-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  describe('parseSkillFrontmatter', () => {
    it('parses plain, quoted, and wrapped scalars', () => {
      const text = [
        '---',
        'name: minha-skill',
        'description: "Faz algo útil. Use when the user asks to',
        '  review release notes."',
        '---',
        '# Body'
      ].join('\n')
      const fields = parseSkillFrontmatter(text)
      expect(fields.name).toBe('minha-skill')
      expect(fields.description).toBe(
        'Faz algo útil. Use when the user asks to review release notes.'
      )
    })

    it('returns {} for missing/malformed frontmatter', () => {
      expect(parseSkillFrontmatter('# No frontmatter')).toEqual({})
      expect(parseSkillFrontmatter('')).toEqual({})
    })
  })

  describe('listCreatedSkills', () => {
    it('lists only skills absent from the BMAD manifest, classified and sorted', async () => {
      writeManifest(root)
      // BMAD-owned (in the manifest) — must NOT be listed as created.
      writeSkill(root, 'bmad-prd', { name: 'bmad-prd', description: 'PRD workflow.' })
      // User-created workflow skill.
      writeSkill(root, 'revisor-notas', {
        name: 'Revisor de Notas',
        description: 'Revisa release notes.'
      })
      // User-created agent (the "talk to" signal), with countable evals.
      writeSkill(
        root,
        'clara-dados',
        { name: 'Clara', description: 'Data specialist. Use when the user asks to talk to Clara.' },
        { 'cases.json': JSON.stringify([{ id: 'a' }, { id: 'b' }]) }
      )

      const created = await listCreatedSkills(root)
      expect(created.map((skill) => skill.key)).toEqual(['clara-dados', 'revisor-notas'])

      const clara = created[0]
      expect(clara.kind).toBe('agent')
      expect(clara.persona).toBe('Clara')
      expect(clara.hasEvals).toBe(true)
      expect(clara.evalCases).toBe(2)
      expect(clara.relPath).toBe('.claude/skills/clara-dados')
      expect(clara.updatedAt).toBeGreaterThan(0)

      const revisor = created[1]
      expect(revisor.kind).toBe('skill')
      expect(revisor.name).toBe('Revisor de Notas')
      expect(revisor.hasEvals).toBe(false)
      expect(revisor.evalCases).toBe(0)
    })

    it('counts cases in {cases:[…]} json and jsonl, and flags uncountable evals dirs', async () => {
      writeManifest(root)
      writeSkill(
        root,
        'com-objeto',
        { name: 'a', description: 'x' },
        { 'cases.json': JSON.stringify({ cases: [1, 2, 3] }) }
      )
      writeSkill(
        root,
        'com-jsonl',
        { name: 'b', description: 'x' },
        { 'cases.jsonl': '{"id":1}\n{"id":2}\n\n' }
      )
      writeSkill(root, 'com-md', { name: 'c', description: 'x' }, { 'README.md': 'notas' })

      const byKey = new Map((await listCreatedSkills(root)).map((skill) => [skill.key, skill]))
      expect(byKey.get('com-objeto')).toMatchObject({ hasEvals: true, evalCases: 3 })
      expect(byKey.get('com-jsonl')).toMatchObject({ hasEvals: true, evalCases: 2 })
      expect(byKey.get('com-md')).toMatchObject({ hasEvals: true, evalCases: 0 })
    })

    it('skips directories without SKILL.md and works with no manifest at all', async () => {
      // No manifest written: everything with a SKILL.md is "created".
      writeSkill(root, 'minha-skill', { name: 'Minha', description: 'faz algo' })
      mkdirSync(join(root, '.claude', 'skills', 'sem-skill-md'), { recursive: true })

      const created = await listCreatedSkills(root)
      expect(created.map((skill) => skill.key)).toEqual(['minha-skill'])
    })

    it('yields [] when .claude/skills does not exist', async () => {
      await expect(listCreatedSkills(root)).resolves.toEqual([])
    })
  })

  describe('listCatalogWithCreated', () => {
    it('appends created skills as custom entries after the BMAD catalog', async () => {
      writeManifest(root)
      mkdirSync(join(root, '_bmad', '_config'), { recursive: true })
      writeFileSync(join(root, '_bmad', '_config', 'bmad-help.csv'), BMAD_HELP_CSV, 'utf-8')
      writeSkill(root, 'revisor-notas', {
        name: 'Revisor de Notas',
        description: 'Revisa release notes.'
      })

      const catalog = await listCatalogWithCreated(root)
      const keys = catalog.map((skill) => skill.key)
      expect(keys).toContain('bmad-prd')
      expect(keys).toContain('bmad-agent-pm')

      const custom = catalog.find((skill) => skill.key === 'revisor-notas')
      expect(custom).toMatchObject({
        label: 'Revisor de Notas',
        module: 'custom',
        kind: 'skill',
        custom: true
      })
      // BMAD entries never carry the flag.
      expect(catalog.find((skill) => skill.key === 'bmad-prd')?.custom).toBeUndefined()
    })

    it('degrades to just the created skills when no BMAD metadata exists', async () => {
      writeSkill(root, 'minha-skill', { name: 'Minha', description: 'faz algo' })
      const catalog = await listCatalogWithCreated(root)
      expect(catalog.map((skill) => skill.key)).toEqual(['minha-skill'])
    })
  })

  describe('listSkillsWithCreated', () => {
    it('appends created skills to the slash-menu list', async () => {
      writeManifest(root)
      mkdirSync(join(root, '_bmad', '_config'), { recursive: true })
      writeFileSync(join(root, '_bmad', '_config', 'bmad-help.csv'), BMAD_HELP_CSV, 'utf-8')
      writeSkill(root, 'revisor-notas', {
        name: 'Revisor de Notas',
        description: 'Revisa release notes.'
      })

      const skills = await listSkillsWithCreated(root)
      expect(skills.map((skill) => skill.key)).toEqual(['bmad-prd', 'revisor-notas'])
      expect(skills[1].label).toBe('Revisor de Notas')
    })
  })
})
