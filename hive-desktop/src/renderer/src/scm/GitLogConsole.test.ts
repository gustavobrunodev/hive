// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GitLogConsole } from './GitLogConsole'
import type { GitCommandEntry } from './gitLogs'
import { createHiveGitMock } from '../testSupport/hiveGitMock'

/**
 * git-logs — the git command console. What is proved here is the behaviour a
 * debugging instrument has to get right: history is shown even though it
 * happened before the console opened, live commands arrive without a reload,
 * the same command never appears twice, failures are findable, and the copy
 * command produces text worth pasting into an issue.
 */

let seq = 0
function entry(over: Partial<GitCommandEntry> = {}): GitCommandEntry {
  seq += 1
  return {
    id: `git#${seq}`,
    at: Date.UTC(2026, 8, 2, 19, 41, 3),
    cwd: '/ws',
    args: ['status', '--porcelain=v2'],
    code: 0,
    durationMs: 34,
    stderr: '',
    stderrTruncated: false,
    ...over
  }
}

/** The live-entry listener the store registered, so a test can push to it. */
let push: (entry: GitCommandEntry) => void

/**
 * Pointer events with real coordinates.
 *
 * jsdom ships no `PointerEvent`, so `fireEvent.pointerDown(el, {clientY})`
 * silently delivers an event with **no** `clientY` — the handler runs, reads
 * `undefined`, and the drag quietly does nothing while the test still looks
 * like it exercised one. A `MouseEvent` typed `pointerdown` carries the
 * coordinate and React maps it to `onPointerDown` all the same.
 */
function drag(node: Element, clientY: number): void {
  fireEvent(node, new MouseEvent('pointerdown', { clientY, bubbles: true }))
}

function move(clientY: number): void {
  fireEvent(window, new MouseEvent('pointermove', { clientY, bubbles: true }))
}

function mountWith(history: GitCommandEntry[]): void {
  const git = createHiveGitMock()
  git.logs.history.mockResolvedValue(history)
  git.logs.onEntry.mockImplementation((cb: (entry: GitCommandEntry) => void) => {
    push = cb
    return () => {}
  })
  // `copyText` prefers the bridge over `navigator.clipboard` (the web API
  // rejects in this window) — so the clipboard has to be part of the mock, or
  // the copy assertions would be measuring the fallback path the app never
  // takes.
  vi.stubGlobal('hive', {
    git,
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
  } as unknown as typeof window.hive)
}

beforeEach(() => {
  seq = 0
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('GitLogConsole', () => {
  it('opens onto the backlog — the command being investigated already ran', async () => {
    mountWith([entry({ args: ['fetch'] }), entry({ args: ['push'] })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))

    expect(await screen.findByText('git fetch')).toBeTruthy()
    expect(screen.getByText('git push')).toBeTruthy()
  })

  it('shows a live command without a reload', async () => {
    mountWith([entry({ args: ['status'] })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    await screen.findByText('git status')

    act(() => push(entry({ args: ['commit', '-F', '/tmp/msg'] })))

    expect(await screen.findByText('git commit -F /tmp/msg')).toBeTruthy()
  })

  /**
   * The store subscribes *before* reading history, so a command that finishes
   * between the two calls lands twice. Showing it twice would be the console
   * inventing a retry that never happened.
   */
  it('shows a command once even when history and the stream both carry it', async () => {
    const shared = entry({ args: ['fetch'] })
    mountWith([shared])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    await screen.findByText('git fetch')

    act(() => push(shared))

    expect(screen.getAllByText('git fetch')).toHaveLength(1)
  })

  it("names how a command ended, in git's own numbers", async () => {
    mountWith([
      entry({ args: ['push'], code: 128, stderr: 'fatal: could not read Username' }),
      entry({ args: ['status'], code: null })
    ])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))

    expect(await screen.findByText('saiu 128')).toBeTruthy()
    // git never spawned — a different fact, and a different sentence.
    expect(screen.getByText('não executou')).toBeTruthy()
  })

  it("keeps git's stderr behind a disclosure rather than on every row", async () => {
    mountWith([entry({ args: ['push'], code: 128, stderr: 'fatal: could not read Username' })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))

    const row = await screen.findByRole('button', { name: /Ver a saída de erro de git push/ })
    expect(screen.queryByText(/could not read Username/)).toBeNull()

    fireEvent.click(row)
    expect(screen.getByText(/could not read Username/)).toBeTruthy()
  })

  it('says when the output was cut, instead of ending mid-line with no explanation', async () => {
    mountWith([
      entry({ args: ['pull'], code: 1, stderr: 'error: '.repeat(10), stderrTruncated: true })
    ])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))

    fireEvent.click(await screen.findByRole('button', { name: /Ver a saída de erro/ }))
    expect(screen.getByText(/Saída cortada/)).toBeTruthy()
  })

  it('filters down to the failures, and the count says how many there are', async () => {
    mountWith([entry({ args: ['status'] }), entry({ args: ['push'], code: 128, stderr: 'fatal' })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    await screen.findByText('git status')

    fireEvent.click(screen.getByRole('radio', { name: /Falhas/ }))

    await waitFor(() => expect(screen.queryByText('git status')).toBeNull())
    expect(screen.getByRole('button', { name: /Ver a saída de erro de git push/ })).toBeTruthy()
  })

  it('searches across the command, the directory and the error output', async () => {
    mountWith([entry({ args: ['status'] }), entry({ args: ['log'], cwd: '/outro-repo' })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    await screen.findByText('git status')

    fireEvent.change(screen.getByLabelText('Buscar nos comandos'), {
      target: { value: 'outro-repo' }
    })

    await waitFor(() => expect(screen.queryByText('git status')).toBeNull())
    expect(screen.getByText('git log')).toBeTruthy()
  })

  it('offers a way out of a filter that matches nothing', async () => {
    mountWith([entry({ args: ['status'] })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    await screen.findByText('git status')

    fireEvent.click(screen.getByRole('radio', { name: /Falhas/ }))
    const escape = await screen.findByRole('button', { name: 'Limpar filtros' })
    fireEvent.click(escape)

    expect(await screen.findByText('git status')).toBeTruthy()
  })

  it('teaches rather than showing a blank pane when nothing has run', async () => {
    mountWith([])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))

    expect(await screen.findByText('Nenhum comando de git ainda')).toBeTruthy()
  })

  it('copies the visible rows as text carrying time, directory, command and outcome', async () => {
    mountWith([entry({ args: ['fetch'], durationMs: 2840 })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    await screen.findByText('git fetch')

    fireEvent.click(screen.getByRole('button', { name: /Copiar todos os comandos/ }))

    await waitFor(() => expect(window.hive.clipboard.writeText).toHaveBeenCalled())
    const text = vi.mocked(window.hive.clipboard.writeText).mock.calls[0][0]
    expect(text).toContain('/ws > git fetch')
    expect(text).toContain('[2,8 s]')
    // And it confirms in place, so the click is not a silent no-op.
    expect(await screen.findByText('Copiado')).toBeTruthy()
  })

  it("clears main's journal, not just the view", async () => {
    mountWith([entry({ args: ['status'] })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    await screen.findByText('git status')

    fireEvent.click(screen.getByRole('button', { name: 'Descartar os comandos registrados' }))

    await waitFor(() => expect(window.hive.git.logs.clear).toHaveBeenCalled())
    expect(await screen.findByText('Nenhum comando de git ainda')).toBeTruthy()
  })

  it('closes on request', async () => {
    mountWith([])
    const onClose = vi.fn()
    render(createElement(GitLogConsole, { onClose }))

    fireEvent.click(await screen.findByRole('button', { name: 'Fechar os logs do Git' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('takes the whole work area when maximized, and gives it back', async () => {
    mountWith([entry({ args: ['status'] })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    const dock = await screen.findByLabelText('Logs do Git')
    // Closed, the dock is a fixed height; maximized it is `flex: 1` and must
    // NOT also carry an inline height, or it would be pinned to both.
    expect(dock.getAttribute('style')).toContain('height')

    fireEvent.click(screen.getByRole('button', { name: 'Expandir os logs para a área toda' }))
    expect(dock.getAttribute('data-maximized')).toBe('true')
    expect(dock.getAttribute('style') ?? '').not.toContain('height')

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar a altura dos logs' }))
    expect(dock.getAttribute('data-maximized')).toBeNull()
  })

  /**
   * The grip drags the dock's height. Dragging *up* has to make it taller (the
   * delta is `start - current`, and getting that backwards is the classic
   * resize bug), and the floor has to hold against an overshoot.
   */
  it('resizes on a grip drag, upwards for taller, and refuses to go below the floor', async () => {
    mountWith([entry({ args: ['status'] })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    const dock = await screen.findByLabelText('Logs do Git')
    const grip = screen.getByRole('separator', { name: 'Redimensionar os logs do Git' })

    drag(grip, 500)
    move(460)
    expect(dock.style.height).toBe('304px')

    // Dragged far past the bottom: the floor holds rather than collapsing it.
    move(5000)
    expect(dock.style.height).toBe('140px')

    fireEvent(window, new MouseEvent('pointerup', { bubbles: true }))
    // After the release the listeners are gone — a stray move changes nothing.
    move(100)
    expect(dock.style.height).toBe('140px')
  })

  it('leaves the height alone while maximized — there is nothing to resize', async () => {
    mountWith([entry({ args: ['status'] })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    const grip = screen.getByRole('separator', { name: 'Redimensionar os logs do Git' })
    fireEvent.click(screen.getByRole('button', { name: 'Expandir os logs para a área toda' }))

    drag(grip, 500)
    move(100)

    const dock = screen.getByLabelText('Logs do Git')
    expect(dock.getAttribute('style') ?? '').not.toContain('height')
  })

  /**
   * Scrolling up to read stops the console from yanking the viewport back on
   * the next command — and offers the trip back instead of stranding you.
   */
  it('stops following the tail once scrolled away, and offers the way back', async () => {
    mountWith([entry({ args: ['status'] }), entry({ args: ['fetch'] })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    await screen.findByText('git status')
    const stream = screen.getByRole('log')
    // jsdom lays nothing out, so the scroll geometry is declared here.
    Object.defineProperty(stream, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(stream, 'clientHeight', { value: 200, configurable: true })

    stream.scrollTop = 0
    fireEvent.scroll(stream)
    const back = await screen.findByRole('button', { name: 'Voltar para o comando mais recente' })

    fireEvent.click(back)
    expect(stream.scrollTop).toBe(1000)
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Voltar para o comando mais recente' })
      ).toBeNull()
    )
  })

  it('keeps following while the reader is already at the bottom', async () => {
    mountWith([entry({ args: ['status'] })])
    render(createElement(GitLogConsole, { onClose: vi.fn() }))
    const stream = await screen.findByRole('log')
    Object.defineProperty(stream, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(stream, 'clientHeight', { value: 200, configurable: true })

    stream.scrollTop = 800
    fireEvent.scroll(stream)

    expect(screen.queryByRole('button', { name: 'Voltar para o comando mais recente' })).toBeNull()
  })

  /**
   * The dock publishes its own measured height so the viewport-fixed furniture
   * (the Second Brain FAB) gets out of the way of the newest rows.
   */
  it('publishes its footprint on the document root and cleans it up', async () => {
    const observed: Element[] = []
    class FakeResizeObserver {
      observe(node: Element): void {
        observed.push(node)
      }
      disconnect(): void {
        // Nothing to release — the fake keeps no timers or handles.
      }
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    mountWith([])
    const view = render(createElement(GitLogConsole, { onClose: vi.fn() }))
    await screen.findByText('Nenhum comando de git ainda')

    expect(document.documentElement.style.getPropertyValue('--wb-dock-h')).not.toBe('')
    // `contains`, not `[0]`: the DS `SegmentedControl` in the toolbar observes
    // itself too, so the dock is one of several observed nodes here.
    expect(observed).toContain(screen.getByLabelText('Logs do Git'))

    view.unmount()
    expect(document.documentElement.style.getPropertyValue('--wb-dock-h')).toBe('')
  })

  it('drops the live subscription when it unmounts', async () => {
    const off = vi.fn()
    const git = createHiveGitMock()
    git.logs.history.mockResolvedValue([])
    git.logs.onEntry.mockReturnValue(off)
    vi.stubGlobal('hive', { git } as unknown as typeof window.hive)

    const view = render(createElement(GitLogConsole, { onClose: vi.fn() }))
    await screen.findByText('Nenhum comando de git ainda')
    view.unmount()

    expect(off).toHaveBeenCalled()
  })
})
