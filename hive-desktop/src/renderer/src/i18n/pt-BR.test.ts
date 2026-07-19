import { describe, expect, it } from 'vitest'
import { ptBR, intentLabel, roleMeta, roleActionLabel, shortcutLabel, agentMeta } from './pt-BR'

/**
 * T10 (file-management regression pass) — `pt-BR.ts` is one of this
 * feature's gated files (design.md §"Coverage config note": 90/90/90/90 on
 * every touched file), but not every export in it is file-management copy —
 * `theme.toggle`/`workUI.workspaceChipTitle` predate this feature and
 * `intentLabel`'s fallback branch is exercised only for a runtime-discovered
 * (not statically known) workflow key, neither of which any existing suite
 * happened to reach. These are direct unit tests of the exported data/pure
 * functions themselves (no app component touched) purely to close that gate.
 */
describe('pt-BR copy — pure helpers', () => {
  it('theme.toggle() interpolates the current theme name into the label', () => {
    expect(ptBR.theme.toggle('escuro')).toBe('Alternar tema (atual: escuro)')
    expect(ptBR.theme.toggle('claro')).toBe('Alternar tema (atual: claro)')
  })

  it('workUI.workspaceChipTitle() interpolates the workspace path into the label', () => {
    expect(ptBR.workUI.workspaceChipTitle('/home/user/my-workspace')).toBe(
      'Workspace ativo: /home/user/my-workspace'
    )
  })

  it('intentLabel() resolves a known WorkflowEntry key to its pt-BR label', () => {
    expect(intentLabel('prd')).toBe('Criar um PRD')
  })

  it('intentLabel() falls back to the raw key for an unrecognized, runtime-discovered entry', () => {
    expect(intentLabel('some-future-workflow')).toBe('some-future-workflow')
  })

  it('chat.agentIndicatorAria() interpolates the active agent name', () => {
    expect(ptBR.chat.agentIndicatorAria('Claude Code')).toBe('Agente ativo: Claude Code')
  })

  it('roleMeta() resolves a known role and falls back to a general descriptor', () => {
    expect(roleMeta('pm').name).toBe('Product Manager')
    expect(roleMeta('pm').persona).toBe('John')
    expect(roleMeta('qa').persona).toBe('Murat')
    expect(roleMeta('general').name).toBe('Geral')
    expect(roleMeta('unknown').persona).toBe('BMAD')
  })

  it('roleActionLabel() resolves known action keys and falls back to the raw key', () => {
    expect(roleActionLabel('prd')).toBe('Criar um PRD')
    expect(roleActionLabel('persona-pm')).toBe('Conversar com John')
    expect(roleActionLabel('unknown-action')).toBe('unknown-action')
  })
})

// shortcut-customization: skill labels, agent meta, and the picker's copy.
describe('pt-BR — shortcut-customization', () => {
  it('shortcutLabel() resolves role-action keys and skill keys through the pt-BR maps', () => {
    expect(shortcutLabel('prd', 'workflow')).toBe('Criar um PRD')
    expect(shortcutLabel('bmad-prd', 'workflow')).toBe('Criar um PRD')
    expect(shortcutLabel('bmad-spec', 'workflow')).toBe('Criar uma spec')
    expect(shortcutLabel('bmad-agent-pm', 'persona')).toBe('Conversar com John')
  })

  it('shortcutLabel() composes "Conversar com <persona>" for unknown agents from the fallback', () => {
    expect(shortcutLabel('bmad-agent-zoe', 'persona', 'Zoe')).toBe('Conversar com Zoe')
    // No fallback either → the raw key (never crashes).
    expect(shortcutLabel('bmad-agent-zoe', 'persona')).toBe('bmad-agent-zoe')
  })

  it('shortcutLabel() falls back to the carried catalog label, then the key, for unknown skills', () => {
    expect(shortcutLabel('bmad-future-skill', 'workflow', 'Future Skill')).toBe('Future Skill')
    expect(shortcutLabel('bmad-future-skill', 'workflow')).toBe('bmad-future-skill')
  })

  it('agentMeta() resolves known specialists and returns null for unknown agents', () => {
    expect(agentMeta('bmad-agent-ux-designer')).toEqual({
      persona: 'Sally',
      role: 'Designer de UX e UI'
    })
    expect(agentMeta('bmad-tea')?.persona).toBe('Murat')
    expect(agentMeta('bmad-agent-zoe')).toBeNull()
  })

  it('shortcuts counts pluralize correctly', () => {
    expect(ptBR.shortcuts.selectedCount(0)).toBe('Nenhum atalho selecionado')
    expect(ptBR.shortcuts.selectedCount(1)).toBe('1 atalho selecionado')
    expect(ptBR.shortcuts.selectedCount(3)).toBe('3 atalhos selecionados')
    expect(ptBR.shortcuts.groupCount(2, 7)).toBe('2 de 7')
    expect(ptBR.shortcuts.toggleAria('Criar um PRD')).toBe('Alternar atalho: Criar um PRD')
  })
})
