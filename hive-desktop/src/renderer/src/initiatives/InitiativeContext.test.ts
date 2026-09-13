// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InitiativeContext } from './InitiativeContext'
import { INITIATIVES_ROOT, type Initiative } from './initiatives'

/**
 * The rail embeds the real `FileTree`, which talks to the bridge on mount.
 * A tree that resolves to nothing is fine here — this file is about the plan,
 * the artifact shortcuts and the identity header; `Explorer.test.ts` owns the
 * tree's own behaviour.
 */
beforeEach(() => {
  window.hive = {
    ...window.hive,
    listTree: vi.fn().mockResolvedValue([]),
    watchWorkspace: vi.fn().mockReturnValue(() => {})
  } as unknown as typeof window.hive
})

afterEach(() => {
  cleanup()
})

const FOLDER = `${INITIATIVES_ROOT}/R2/portal-de-cobranca`

function initiative(files: string[] = []): Initiative {
  return {
    path: FOLDER,
    slug: 'portal-de-cobranca',
    title: 'Portal de Cobrança',
    release: 'R2',
    year: 2026,
    files
  }
}

function rail(
  props: Partial<Parameters<typeof InitiativeContext>[0]> = {}
): ReturnType<typeof render> {
  return render(
    createElement(InitiativeContext, {
      workspace: '/ws',
      initiative: initiative(),
      selectedPath: null,
      onOpenFile: vi.fn(),
      onRunStage: vi.fn(),
      ...props
    })
  )
}

describe('InitiativeContext', () => {
  it('renders nothing at all when no demand is open', () => {
    const { container } = rail({ initiative: null })
    expect(container.querySelector('.wb-initctx')).toBeNull()
  })

  it('names the demand and where it sits, so the rail says what it belongs to', () => {
    rail()
    expect(screen.getByRole('heading', { name: 'Portal de Cobrança' })).toBeTruthy()
    const crumbs = screen.getByLabelText('Localização da iniciativa')
    expect(crumbs.textContent).toContain('2026')
    expect(crumbs.textContent).toContain('R2')
  })

  it('lists the eight stages with their pt-BR names, in the order they are worked', () => {
    rail()
    const plan = screen.getByRole('group', { name: /Etapas do fluxo/ })
    const rows = [...plan.querySelectorAll('.hds-stage-name')].map((row) => row.textContent)
    expect(rows).toEqual([
      'Pesquisa de domínio',
      'Brainstorming',
      'PRD',
      'UX Design',
      'Arquitetura',
      'Design de testes',
      'Épicos e histórias',
      'Criação de histórias'
    ])
  })

  it('reads the plan as four named phases, each with its own tally', () => {
    rail({ initiative: initiative(['pesquisa-dominio.md', 'prd.md']) })
    const phases = [...document.querySelectorAll('.hds-stage-group-head')].map((head) => [
      head.querySelector('.hds-stage-group-label')?.textContent,
      head.querySelector('.hds-stage-group-meta')?.textContent
    ])
    expect(phases).toEqual([
      ['Análise', '1/2'],
      ['Planejamento', '1/2'],
      ['Solucionamento', '0/3'],
      ['Implementação', '0/1']
    ])
  })

  it('badges the stages a demand is free to skip, in the name as well as on screen', () => {
    rail()
    expect(
      [...document.querySelectorAll('.hds-stage-badge')].map(
        (badge) => badge.closest('.hds-stage')?.querySelector('.hds-stage-name')?.textContent
      )
    ).toEqual(['Pesquisa de domínio', 'Brainstorming', 'UX Design'])
    expect(screen.getByRole('button', { name: 'Iniciar Brainstorming, Opcional' })).toBeTruthy()
  })

  it('says each stage’s status in words, since the state is drawn in colour and shape', () => {
    rail({ initiative: initiative(['prd.md']) })
    const labels = [...document.querySelectorAll('.hds-stage-label')].map((row) => row.textContent)
    expect(labels).toContain('PRD, concluída')
    // The arrow skips both optional stages above it and lands on the first
    // required one that has nothing.
    expect(labels).toContain('Arquitetura, próxima')
    expect(labels).toContain('Pesquisa de domínioOpcional, pendente')
  })

  it('counts what is finished, out of how many there are', () => {
    rail({ initiative: initiative(['prd.md', 'arquitetura.md']) })
    expect(screen.getByText('2 de 8 etapas')).toBeTruthy()
  })

  it('says the rows run something, and that running one opens its own conversation', () => {
    rail()
    expect(screen.getByText('Clique numa etapa para executá-la em uma conversa nova.')).toBeTruthy()
  })

  it('takes the row to the stage: the document once it exists, the run until then', () => {
    rail({ initiative: initiative(['prd.md']) })
    expect(screen.getByRole('button', { name: 'Abrir PRD' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Iniciar Arquitetura' })).toBeTruthy()
  })

  it('prints the verb on the one stage that is next, so it is visible without hovering', () => {
    rail({ initiative: initiative(['prd.md']) })
    const cues = [...document.querySelectorAll('.hds-stage-cue')]
    const active = document.querySelector('.hds-stage[data-status="active"] .hds-stage-cue')
    expect(active?.textContent).toContain('Iniciar')
    // Every unfinished row carries one; a finished row opens its document
    // instead, and its re-run lives in the trailing slot.
    expect(cues).toHaveLength(7)
    expect(document.querySelector('.hds-stage[data-status="done"] .hds-stage-cue')).toBeNull()
  })

  it('launches a stage scoped to this demand’s folder', () => {
    const onRunStage = vi.fn()
    rail({ onRunStage })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar PRD' }))
    expect(onRunStage).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'bmad-prd', kind: 'workflow' })
    )
    expect(onRunStage.mock.calls[0][0].command.prompt).toContain(FOLDER)
  })

  it('opens a finished stage’s document without re-running the stage', () => {
    const onOpenFile = vi.fn()
    const onRunStage = vi.fn()
    rail({ initiative: initiative(['prd.md']), onOpenFile, onRunStage })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir PRD' }))
    expect(onOpenFile).toHaveBeenCalledWith(`${FOLDER}/prd.md`)
    // A 300px row that silently overwrites the document it names is not
    // something a stray click should be able to start.
    expect(onRunStage).not.toHaveBeenCalled()
  })

  it('keeps re-running a finished stage as the trailing action', () => {
    const onOpenFile = vi.fn()
    const onRunStage = vi.fn()
    rail({ initiative: initiative(['prd.md']), onOpenFile, onRunStage })
    fireEvent.click(screen.getByRole('button', { name: 'Refazer PRD' }))
    expect(onRunStage).toHaveBeenCalledWith(expect.objectContaining({ key: 'bmad-prd' }))
    expect(onOpenFile).not.toHaveBeenCalled()
  })

  it('offers the re-run shortcut only where a stage has already run', () => {
    rail({ initiative: initiative(['prd.md']) })
    expect(screen.queryByRole('button', { name: /^Refazer/ })).toBeTruthy()
    cleanup()
    rail()
    expect(screen.queryByRole('button', { name: /^Refazer/ })).toBeNull()
  })

  it('roots the file tree at the demand, not at the workspace', () => {
    rail()
    expect(window.hive.listTree).toHaveBeenCalledWith('/ws', FOLDER)
  })
})
