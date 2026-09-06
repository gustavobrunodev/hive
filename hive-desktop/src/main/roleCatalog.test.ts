import { describe, expect, it } from 'vitest'
import {
  ROLE_CATALOG,
  SELECTABLE_ROLES,
  isSelectableRole,
  normalizeRole,
  resolveAllShortcuts,
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
    expect(resolveShortcuts('pm', { start: null, during: null }, catalog)).toEqual(
      resolveRoleActions('pm')
    )
  })

  // The regression that made "remove a default shortcut" impossible in a
  // workspace with no BMAD: an empty catalog used to veto the user's own
  // selection and reinstate the role defaults on every read.
  it('empty catalog → the selection is still honoured, key for key', () => {
    const actions = resolveShortcuts(
      'pm',
      { start: { skills: ['bmad-prd'], agents: ['bmad-agent-pm'] }, during: null },
      []
    )
    expect(actions).toEqual([
      { key: 'bmad-prd', kind: 'workflow', command: { key: 'bmad-prd', prompt: '/bmad-prd' } },
      {
        key: 'bmad-agent-pm',
        kind: 'persona',
        command: { key: 'bmad-agent-pm', prompt: '/bmad-agent-pm' }
      }
    ])
  })

  it('empty catalog + everything deselected → nothing, not the role defaults', () => {
    expect(resolveShortcuts('pm', { start: { skills: [], agents: [] }, during: null }, [])).toEqual(
      []
    )
  })

  it('empty catalog invents nothing — only what the selection names comes back', () => {
    const actions = resolveShortcuts(
      'pm',
      { start: { skills: ['bmad-brainstorming'], agents: [] }, during: null },
      []
    )
    expect(actions.map((action) => action.key)).toEqual(['bmad-brainstorming'])
  })

  it('maps selected skills/agents to launch-ready actions in selection order', () => {
    const actions = resolveShortcuts(
      'pm',
      { start: { skills: ['bmad-spec', 'bmad-prd'], agents: ['bmad-agent-pm'] }, during: null },
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
      { start: { skills: ['bmad-prd', 'bmad-not-installed'], agents: [] }, during: null },
      catalog
    )
    expect(actions.map((a) => a.key)).toEqual(['bmad-prd'])
    // Deselecting everything is a legitimate choice — no fallback kicks in.
    expect(
      resolveShortcuts('pm', { start: { skills: [], agents: [] }, during: null }, catalog)
    ).toEqual([])
  })
})

// shortcut-scopes: the two independent sets — role defaults per scope, and
// per-scope custom selections that never bleed into each other.
describe('shortcut scopes', () => {
  const catalog = [
    {
      key: 'bmad-prd',
      label: 'PRD',
      description: '',
      module: 'bmm',
      kind: 'skill' as const,
      persona: null
    },
    {
      key: 'bmad-party-mode',
      label: 'Party Mode',
      description: '',
      module: 'core',
      kind: 'skill' as const,
      persona: null
    }
  ]

  it('the PM is the only role with an in-conversation default, and it is party mode', () => {
    expect(resolveRoleActions('pm', 'during').map((a) => a.command.key)).toEqual([
      'bmad-party-mode'
    ])
    for (const role of SELECTABLE_ROLES.filter((id) => id !== 'pm')) {
      expect(resolveRoleActions(role, 'during')).toEqual([])
    }
    // The internal fallback carries none either — a role-less user gets a
    // clean composer, not a surprise row.
    expect(resolveRoleActions('general', 'during')).toEqual([])
  })

  it("the PM's party-mode default is a launch-ready slash command", () => {
    const [action] = resolveRoleActions('pm', 'during')
    expect(action).toEqual({
      key: 'party-mode',
      kind: 'workflow',
      command: { key: 'bmad-party-mode', prompt: '/bmad-party-mode' }
    })
  })

  it('the start scope is the default, and matches the pre-scope behaviour', () => {
    expect(resolveRoleActions('pm')).toEqual(resolveRoleActions('pm', 'start'))
    expect(resolveRoleActions('pm', 'start')).not.toEqual(resolveRoleActions('pm', 'during'))
  })

  it('resolves each scope against its own prefs, never the other one', () => {
    const settings = {
      start: { skills: ['bmad-prd'], agents: [] },
      during: { skills: ['bmad-party-mode'], agents: [] }
    }
    expect(resolveShortcuts('pm', settings, catalog, 'start').map((a) => a.key)).toEqual([
      'bmad-prd'
    ])
    expect(resolveShortcuts('pm', settings, catalog, 'during').map((a) => a.key)).toEqual([
      'bmad-party-mode'
    ])
  })

  it('a customized start scope leaves during on its role default', () => {
    const settings = { start: { skills: ['bmad-prd'], agents: [] }, during: null }
    expect(resolveShortcuts('dev', settings, catalog, 'during')).toEqual([])
    expect(resolveShortcuts('pm', settings, catalog, 'during').map((a) => a.command.key)).toEqual([
      'bmad-party-mode'
    ])
  })

  it('resolveAllShortcuts returns both sets in one shot', () => {
    expect(resolveAllShortcuts('pm', null, catalog)).toEqual({
      start: resolveShortcuts('pm', null, catalog, 'start'),
      during: resolveShortcuts('pm', null, catalog, 'during')
    })
  })
})
