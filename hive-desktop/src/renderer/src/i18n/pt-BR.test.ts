import { describe, expect, it } from 'vitest'
import { ptBR, intentLabel } from './pt-BR'

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
})
