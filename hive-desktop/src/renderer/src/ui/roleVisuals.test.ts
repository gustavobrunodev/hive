import { describe, expect, it } from 'vitest'
import { actionIcon, roleIcon, shortcutIcon, skillIcon, SELECTABLE_ROLE_IDS } from './roleVisuals'
import {
  AutomationIcon,
  BeakerIcon,
  FileTextIcon,
  IntentPrdIcon,
  IntentResearchIcon,
  PersonaChatIcon,
  ReviewIcon,
  RolePmIcon,
  RoleUxIcon
} from './icons'

// shortcut-customization: the icon maps feeding the hero pills, the strip
// chips, and the customizer rows. Identity checks (not rendering) — the SVGs
// themselves are covered by icons.test.ts.
describe('roleVisuals', () => {
  it('roleIcon resolves every selectable role and falls back to the PM glyph', () => {
    for (const roleId of SELECTABLE_ROLE_IDS) {
      expect(typeof roleIcon(roleId)).toBe('function')
    }
    expect(roleIcon('ux')).toBe(RoleUxIcon)
    expect(roleIcon('unknown')).toBe(RolePmIcon)
  })

  it('actionIcon resolves persona-*, every known action key, and falls back to the document glyph', () => {
    expect(actionIcon('persona-pm')).toBe(PersonaChatIcon)
    expect(actionIcon('prd')).toBe(IntentPrdIcon)
    expect(actionIcon('code-review')).toBe(ReviewIcon)
    expect(actionIcon('something-new')).toBe(FileTextIcon)
    // Every role-catalog action key resolves to a real icon (not undefined) —
    // exercises each switch arm so a renamed key can't silently regress.
    const knownKeys = [
      'domain-research',
      'brainstorm',
      'product-brief',
      'epics-stories',
      'story',
      'architecture',
      'ux-spec',
      'test-design',
      'test-automation',
      'dev-story'
    ]
    for (const key of knownKeys) {
      expect(typeof actionIcon(key)).toBe('function')
      expect(actionIcon(key)).not.toBe(FileTextIcon)
    }
  })

  it('skillIcon resolves the flat map, the testarch/testing prefix family, and the fallback', () => {
    expect(skillIcon('bmad-prd')).toBe(IntentPrdIcon)
    expect(skillIcon('bmad-market-research')).toBe(IntentResearchIcon)
    expect(skillIcon('bmad-testarch-automate')).toBe(AutomationIcon)
    expect(skillIcon('bmad-testarch-nfr')).toBe(BeakerIcon)
    expect(skillIcon('bmad-teach-me-testing')).toBe(BeakerIcon)
    expect(skillIcon('bmad-unknown')).toBe(FileTextIcon)
  })

  it('shortcutIcon: personas always read as conversation; workflows try action key then skill key', () => {
    expect(shortcutIcon({ key: 'bmad-agent-pm', kind: 'persona' })).toBe(PersonaChatIcon)
    expect(shortcutIcon({ key: 'prd', kind: 'workflow' })).toBe(IntentPrdIcon)
    expect(shortcutIcon({ key: 'bmad-prd', kind: 'workflow' })).toBe(IntentPrdIcon)
    expect(shortcutIcon({ key: 'totally-unknown', kind: 'workflow' })).toBe(FileTextIcon)
  })
})
