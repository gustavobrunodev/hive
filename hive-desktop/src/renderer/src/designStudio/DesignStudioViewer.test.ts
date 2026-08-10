// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DesignStudioViewer } from './DesignStudioViewer'
import type { ScreensResponse } from './screens'

// `Resizable` measures its group; jsdom ships no ResizeObserver.
class ObserverStub {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}
vi.stubGlobal('ResizeObserver', ObserverStub)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockScreens(impl: () => Promise<ScreensResponse>): ReturnType<typeof vi.fn> {
  const screens = vi.fn(impl)
  window.hive = {
    ...window.hive,
    designStudio: {
      screens,
      openPreview: vi.fn().mockResolvedValue('hive-studio://preview/abc/index.html'),
      closePreview: vi.fn().mockResolvedValue(undefined)
    }
  } as unknown as typeof window.hive
  return screens
}

function renderViewer(onOpenSpec = vi.fn()): { onOpenSpec: ReturnType<typeof vi.fn> } {
  render(
    createElement(DesignStudioViewer, {
      workspace: '/ws',
      specPath: 'docs/ux.md',
      onOpenSpec
    })
  )
  return { onOpenSpec }
}

const oneScreen: ScreensResponse = {
  screens: [{ screenId: 'login', title: 'Login', probe: 'screenHeading' }],
  probed: ['screenHeading', 'iaTable']
}

describe('DesignStudioViewer — the Bancada shell (T4.3, DS-R16)', () => {
  it('mounts the three columns of the Bancada inside the tab', async () => {
    mockScreens(async () => oneScreen)
    renderViewer()

    await screen.findByLabelText('Palco')
    expect(screen.getByRole('region', { name: 'Design Studio — docs/ux.md' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Telas' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Árvore' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Inspetor' })).toBeTruthy()
  })

  it('puts a resize handle between every pair of columns', async () => {
    mockScreens(async () => oneScreen)
    renderViewer()
    await screen.findByLabelText('Palco')

    expect(
      screen.getAllByRole('separator', { name: 'Redimensionar colunas do Design Studio' })
    ).toHaveLength(2)
  })

  it('covers the read with a Skeleton on the stage, not a blank panel', () => {
    mockScreens(() => new Promise<ScreensResponse>(() => {}))
    renderViewer()

    expect(screen.getByLabelText('Lendo a Spec…').getAttribute('aria-busy')).toBe('true')
  })

  it('teaches instead of showing a blank stage when the Spec names no Tela (DS-R1 AC-3)', async () => {
    mockScreens(async () => ({ screens: [], probed: ['screenHeading', 'iaTable'] }))
    const { onOpenSpec } = renderViewer()

    await screen.findByText('Nenhuma Tela reconhecida nesta Spec')
    expect(screen.queryByLabelText('Palco')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir a Spec no editor' }))
    expect(onOpenSpec).toHaveBeenCalledWith('docs/ux.md')
  })

  it('renders an unreadable Spec as a retryable failure whose retry re-reads (DS-R1 AC-5)', async () => {
    let response: ScreensResponse = {
      kind: 'operation',
      scope: 'io',
      message: 'ENOENT',
      retryable: true
    }
    const screens = mockScreens(async () => response)
    renderViewer()

    await screen.findByText('Não foi possível ler a Spec')
    response = oneScreen
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    await waitFor(() => expect(screen.getByLabelText('Palco')).toBeTruthy())
    expect(screens).toHaveBeenCalledTimes(2)
  })
})
