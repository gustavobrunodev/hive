// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConflictView } from './ConflictView'
import { GitProvider } from '../scm/useGit'
import { createGitStore } from '../testSupport/gitStoreMock'

const conflicted = ['a', '<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> other', 'b'].join(
  '\n'
)

let readFile: ReturnType<typeof vi.fn>
let saveFile: ReturnType<typeof vi.fn>
let store: ReturnType<typeof createGitStore>

function renderView(): void {
  render(createElement(GitProvider, { store }, createElement(ConflictView, { path: 'src/c.txt' })))
}

beforeEach(() => {
  readFile = vi.fn().mockResolvedValue(conflicted)
  saveFile = vi.fn().mockResolvedValue({ mtimeMs: 1, size: 1 })
  store = createGitStore()
  window.hive = { readFile, fs: { saveFile } } as unknown as typeof window.hive
})

afterEach(() => {
  cleanup()
})

describe('ConflictView', () => {
  it('loads the file and shows ours/theirs blocks', async () => {
    renderView()
    expect(await screen.findByText('ours')).toBeTruthy()
    expect(screen.getByText('theirs')).toBeTruthy()
    expect(readFile).toHaveBeenCalledWith('/ws', 'src/c.txt')
    // One unresolved conflict until a side is chosen.
    expect(screen.getByText('1 conflito não resolvido')).toBeTruthy()
  })

  it('resolves the block, writes the merged file and stages it', async () => {
    renderView()
    await screen.findByText('ours')
    fireEvent.click(screen.getByText('Aceitar atual'))
    // "Marcar como resolvido" enables once every block has a choice.
    const markButtons = screen.getAllByText('Marcar como resolvido')
    fireEvent.click(markButtons[markButtons.length - 1])
    await waitFor(() =>
      expect(saveFile).toHaveBeenCalledWith('/ws', 'src/c.txt', ['a', 'ours', 'b'].join('\n'))
    )
    expect(store.stage).toHaveBeenCalledWith(['src/c.txt'])
  })

  it('accepts incoming and both sides', async () => {
    renderView()
    await screen.findByText('ours')
    fireEvent.click(screen.getByText('Aceitar recebido'))
    let mark = screen.getAllByText('Marcar como resolvido')
    fireEvent.click(mark[mark.length - 1])
    await waitFor(() =>
      expect(saveFile).toHaveBeenCalledWith('/ws', 'src/c.txt', ['a', 'theirs', 'b'].join('\n'))
    )

    cleanup()
    saveFile.mockClear()
    renderView()
    await screen.findByText('ours')
    fireEvent.click(screen.getByText('Aceitar ambos'))
    mark = screen.getAllByText('Marcar como resolvido')
    fireEvent.click(mark[mark.length - 1])
    await waitFor(() =>
      expect(saveFile).toHaveBeenCalledWith(
        '/ws',
        'src/c.txt',
        ['a', 'ours', 'theirs', 'b'].join('\n')
      )
    )
  })

  it('shows the already-resolved state and stages on click when there are no markers', async () => {
    readFile.mockResolvedValue('clean file, no markers')
    renderView()
    expect(await screen.findByText('Sem conflitos neste arquivo')).toBeTruthy()
    fireEvent.click(screen.getByText('Marcar como resolvido'))
    expect(store.stage).toHaveBeenCalledWith(['src/c.txt'])
  })

  it('degrades to an empty resolved view on a read error', async () => {
    readFile.mockRejectedValue(new Error('boom'))
    renderView()
    // Empty content parses as "no markers" → the resolved state.
    expect(await screen.findByText('Sem conflitos neste arquivo')).toBeTruthy()
  })
})
