import { describe, expect, it } from 'vitest'
import {
  ROLE_CATALOG,
  SELECTABLE_ROLES,
  isSelectableRole,
  normalizeRole,
  resolveRoleActions,
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

  it('resolveRoleActions returns launch-ready commands naming the skill in the prompt', () => {
    const pm = resolveRoleActions('pm')
    expect(pm.length).toBe(ROLE_CATALOG.pm.actions.length)
    const prd = pm.find((action) => action.key === 'prd')
    expect(prd).toBeDefined()
    expect(prd?.kind).toBe('workflow')
    expect(prd?.command.key).toBe('bmad-prd')
    expect(prd?.command.prompt).toMatch(/bmad-prd/)
    // Persona action carries the persona skill + prompt.
    const persona = pm.find((action) => action.kind === 'persona')
    expect(persona?.command.key).toBe('bmad-agent-pm')
    expect(persona?.command.prompt).toMatch(/John/)
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
