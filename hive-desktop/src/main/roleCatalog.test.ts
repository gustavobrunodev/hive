import { describe, expect, it } from 'vitest'
import {
  ROLE_CATALOG,
  SELECTABLE_ROLES,
  isSelectableRole,
  normalizeRole,
  resolveRoleActions,
  resolveShortcuts,
  type RoleId
} from './roleCatalog'

describe('roleCatalog', () => {
  it('exposes exactly the five selectable roles in order', () => {
    expect(SELECTABLE_ROLES).toEqual(['pm', 'tech-lead', 'ux', 'qa', 'dev'])
  })

  it('isSelectableRole accepts real roles and rejects general/unknown/null', () => {
    expect(isSelectableRole('pm')).toBe(true)
    expect(isSelectableRole('qa')).toBe(true)
    expect(isSelectableRole('general')).toBe(false)
    expect(isSelectableRole('nope')).toBe(false)
    expect(isSelectableRole(null)).toBe(false)
    expect(isSelectableRole(undefined)).toBe(false)
  })

  it('normalizeRole passes known roles through and falls back to general', () => {
    expect(normalizeRole('pm')).toBe('pm')
    expect(normalizeRole('general')).toBe('general')
    expect(normalizeRole('unknown')).toBe('general')
    expect(normalizeRole(null)).toBe('general')
    expect(normalizeRole(undefined)).toBe('general')
  })

  it('every selectable role ends with its persona action bound to the role persona skill', () => {
    const expectedPersona: Record<Exclude<RoleId, 'general'>, string> = {
      pm: 'bmad-agent-pm',
      'tech-lead': 'bmad-agent-architect',
      ux: 'bmad-agent-ux-designer',
      qa: 'bmad-tea',
      dev: 'bmad-agent-dev'
    }
    for (const role of SELECTABLE_ROLES) {
      const def = ROLE_CATALOG[role]
      const last = def.actions[def.actions.length - 1]
      expect(last.kind).toBe('persona')
      expect(last.skill).toBe(expectedPersona[role as Exclude<RoleId, 'general'>])
      expect(def.personaSkill).toBe(last.skill)
    }
  })

  it('resolveRoleActions returns launch-ready slash-command prompts', () => {
    const pm = resolveRoleActions('pm')
    expect(pm.length).toBe(ROLE_CATALOG.pm.actions.length)
    const prd = pm.find((action) => action.key === 'prd')
    expect(prd).toBeDefined()
    expect(prd?.kind).toBe('workflow')
    expect(prd?.command.key).toBe('bmad-prd')
    // The shortcut IS the slash command — the prompt is exactly `/<skill>`.
    expect(prd?.command.prompt).toBe('/bmad-prd')
    // Persona action launches the specialist skill the same way.
    const persona = pm.find((action) => action.kind === 'persona')
    expect(persona?.command.key).toBe('bmad-agent-pm')
    expect(persona?.command.prompt).toBe('/bmad-agent-pm')
  })

  it('every action prompt is its skill slash command', () => {
    for (const role of Object.keys(ROLE_CATALOG) as RoleId[]) {
      for (const action of ROLE_CATALOG[role].actions) {
        expect(action.prompt).toBe(`/${action.skill}`)
      }
    }
  })

  it('resolveRoleActions falls back to general for null/unknown role', () => {
    expect(resolveRoleActions(null).map((a) => a.command.key)).toEqual(
      ROLE_CATALOG.general.actions.map((a) => a.skill)
    )
    expect(resolveRoleActions('bogus').length).toBe(ROLE_CATALOG.general.actions.length)
  })

  it('uses only live (non-deprecated) BMAD skill names', () => {
    const deprecated = ['bmad-create-prd', 'bmad-create-architecture']
    for (const role of Object.keys(ROLE_CATALOG) as RoleId[]) {
      for (const action of ROLE_CATALOG[role].actions) {
        expect(deprecated).not.toContain(action.skill)
      }
    }
  })
})

// shortcut-customization: custom-selection resolution over the workspace catalog.
describe('resolveShortcuts()', () => {
  const catalog = [
    {
      key: 'bmad-prd',
      label: 'Create Edit and Review PRD',
      description: '',
      module: 'bmm',
      kind: 'skill' as const,
      persona: null
    },
    {
      key: 'bmad-spec',
      label: 'bmad-spec',
      description: '',
      module: 'bmm',
      kind: 'skill' as const,
      persona: null
    },
    {
      key: 'bmad-agent-pm',
      label: 'John',
      description: '',
      module: 'bmm',
      kind: 'agent' as const,
      persona: 'John'
    }
  ]

  it('null prefs → the role defaults, untouched', () => {
    expect(resolveShortcuts('pm', null, catalog)).toEqual(resolveRoleActions('pm'))
  })

  it('empty catalog → role defaults even with prefs (no data to validate against)', () => {
    expect(resolveShortcuts('pm', { skills: ['bmad-prd'], agents: [] }, [])).toEqual(
      resolveRoleActions('pm')
    )
  })

  it('maps selected skills/agents to launch-ready actions in selection order', () => {
    const actions = resolveShortcuts(
      'pm',
      { skills: ['bmad-spec', 'bmad-prd'], agents: ['bmad-agent-pm'] },
      catalog
    )
    expect(actions.map((a) => a.key)).toEqual(['bmad-spec', 'bmad-prd', 'bmad-agent-pm'])
    expect(actions[0]).toMatchObject({
      kind: 'workflow',
      label: 'bmad-spec',
      command: { key: 'bmad-spec', prompt: '/bmad-spec' }
    })
    expect(actions[2]).toMatchObject({
      kind: 'persona',
      label: 'John',
      command: { key: 'bmad-agent-pm', prompt: '/bmad-agent-pm' }
    })
  })

  it('skips selected keys the workspace does not have, and respects an all-deselected set', () => {
    const actions = resolveShortcuts(
      'pm',
      { skills: ['bmad-prd', 'bmad-not-installed'], agents: [] },
      catalog
    )
    expect(actions.map((a) => a.key)).toEqual(['bmad-prd'])
    // Deselecting everything is a legitimate choice — no fallback kicks in.
    expect(resolveShortcuts('pm', { skills: [], agents: [] }, catalog)).toEqual([])
  })
})
