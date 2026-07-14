import { describe, expect, it } from 'vitest'
import { ptBR, intentLabel, roleMeta, roleActionLabel } from './pt-BR'

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
