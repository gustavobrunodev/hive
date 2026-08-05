import { describe, expect, it } from 'vitest'
import {
  ptBR,
  intentLabel,
  roleMeta,
  roleActionLabel,
  shortcutLabel,
  agentMeta,
  relativeTimeLabel
} from './pt-BR'

/**
 * T10 (file-management regression pass) — `pt-BR.ts` is one of this
 * feature's gated files (design.md §"Coverage config note": 90/90/90/90 on
 * every touched file), but not every export in it is file-management copy —
 * `theme.pickerLabelWithCurrent`/`workUI.workspaceChipTitle` predate this
 * feature and `intentLabel`'s fallback branch is exercised only for a runtime-discovered
 * (not statically known) workflow key, neither of which any existing suite
 * happened to reach. These are direct unit tests of the exported data/pure
 * functions themselves (no app component touched) purely to close that gate.
 */
describe('pt-BR copy — pure helpers', () => {
  it('theme.pickerLabelWithCurrent() interpolates the active theme name into the label', () => {
    expect(ptBR.theme.pickerLabelWithCurrent('Escuro')).toBe('Aparência (atual: Escuro)')
    expect(ptBR.theme.pickerLabelWithCurrent('Hive')).toBe('Aparência (atual: Hive)')
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

// npm-distribution T10 (ND-R6.7): the self-update flow's copy — parameterized
// helpers for `UpdateNotice` (Tier 2) and `UpdateCenter` (Tier 3).
describe('pt-BR — update flow (npm-distribution)', () => {
  it('versionTransition() composes the current → next version line', () => {
    expect(ptBR.update.versionTransition('0.1.0', '0.2.0')).toBe('0.1.0 → 0.2.0')
  })

  it('sizeEstimate() rounds bytes to a whole megabyte and states the rough duration', () => {
    // 92 MiB exactly.
    expect(ptBR.update.sizeEstimate(92 * 1024 * 1024, 1)).toBe('≈ 92 MB · cerca de 1 min')
    // Rounds rather than truncating/floors.
    expect(ptBR.update.sizeEstimate(90_000_000, 2)).toBe('≈ 86 MB · cerca de 2 min')
  })

  it('notesTeaser() passes the release-notes teaser through unchanged', () => {
    expect(ptBR.update.notesTeaser('Correções no explorador e no chat.')).toBe(
      'Correções no explorador e no chat.'
    )
  })

  it('downloadProgress() formats transferred/total as pt-BR decimal-comma megabytes plus percent', () => {
    // 1.5 MiB of 3 MiB — one decimal place, comma separator, trailing zero kept.
    expect(ptBR.update.downloadProgress(1.5 * 1024 * 1024, 3 * 1024 * 1024, 50)).toBe(
      '1,5 MB de 3,0 MB · 50%'
    )
  })

  it('verifyingHash() strips an SRI "sha512-" prefix and keeps the first 12 characters', () => {
    expect(ptBR.update.verifyingHash('sha512-abcdefghijklmnopqrstuvwxyz==')).toBe('abcdefghijkl')
    // No prefix present — still takes the first 12 characters.
    expect(ptBR.update.verifyingHash('abcdefghijklmnop')).toBe('abcdefghijkl')
  })

  it('lastCheckedLabel() prefixes an already-computed relative-time string', () => {
    expect(ptBR.update.lastCheckedLabel(relativeTimeLabel(Date.now() - 5 * 60_000))).toBe(
      'Verificado há 5 min'
    )
  })

  it('skippedVersionNote() names the version the user chose to skip', () => {
    expect(ptBR.update.skippedVersionNote('0.2.0')).toBe('Você pulou a versão 0.2.0')
  })
})
