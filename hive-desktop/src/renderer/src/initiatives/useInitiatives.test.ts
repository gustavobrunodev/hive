// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { InitiativeExistsError, useInitiatives } from './useInitiatives'
import { INITIATIVES_ROOT } from './initiatives'

const R2 = `${INITIATIVES_ROOT}/R2`

/** One release with one demand, as `listTree` answers it. */
function tree(files: { name: string; path: string }[] = []): unknown {
  return [
    {
      name: 'R2',
      path: R2,
      type: 'directory',
      children: [
        {
          name: 'portal',
          path: `${R2}/portal`,
          type: 'directory',
          children: files.map((file) => ({ ...file, type: 'file' }))
        }
      ]
    }
  ]
}

let watchers: ((event: { type: string; path: string }) => void)[] = []

function bridge(overrides: Record<string, unknown> = {}): void {
  window.hive = {
    ...window.hive,
    listTree: vi.fn().mockResolvedValue(tree()),
    readFile: vi.fn().mockResolvedValue('{}'),
    watchWorkspace: vi.fn((_root: string, onChange: (event: never) => void) => {
      watchers.push(onChange as never)
      return () => {}
    }),
    fs: {
      ...(window.hive?.fs ?? {}),
      exists: vi.fn().mockResolvedValue(false),
      createDirectory: vi.fn().mockResolvedValue(undefined),
      saveFile: vi.fn().mockResolvedValue({ mtimeMs: 1, size: 1 })
    },
    ...overrides
  } as unknown as typeof window.hive
}

beforeEach(() => {
  watchers = []
  bridge()
})

afterEach(() => {
  // `watchWorkspaceShared` keeps ONE bridge subscription per root at module
  // scope and hands it to every listener. Leaving a hook mounted means the next
  // test's `watchWorkspace` mock is never called — the existing subscription is
  // reused — and the fake watcher it installed never fires.
  cleanup()
  vi.restoreAllMocks()
})

describe('useInitiatives', () => {
  it('walks the initiatives root once and groups what it finds', async () => {
    const { result } = renderHook(() => useInitiatives('/ws'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(window.hive.listTree).toHaveBeenCalledWith('/ws', INITIATIVES_ROOT)
    expect(result.current.initiatives).toHaveLength(1)
    expect(result.current.years[0].releases[0].release).toBe('R2')
  })

  it('treats a missing docs/iniciativas as "none yet", not as a failure', async () => {
    bridge({ listTree: vi.fn().mockRejectedValue(new Error('ENOENT')) })
    const { result } = renderHook(() => useInitiatives('/ws'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.initiatives).toEqual([])
  })

  it('reads a manifest only where there is one', async () => {
    bridge({
      listTree: vi.fn().mockResolvedValue(tree()),
      readFile: vi.fn()
    })
    const { result } = renderHook(() => useInitiatives('/ws'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(window.hive.readFile).not.toHaveBeenCalled()
  })

  it('lets the manifest name the demand and date it', async () => {
    bridge({
      listTree: vi
        .fn()
        .mockResolvedValue(
          tree([{ name: 'iniciativa.json', path: `${R2}/portal/iniciativa.json` }])
        ),
      readFile: vi.fn().mockResolvedValue('{"title":"Portal de Cobrança","year":2024}')
    })
    const { result } = renderHook(() => useInitiatives('/ws'))
    await waitFor(() => expect(result.current.initiatives[0]?.title).toBe('Portal de Cobrança'))
    expect(window.hive.readFile).toHaveBeenCalledWith('/ws', `${R2}/portal/iniciativa.json`)
    expect(result.current.initiatives[0].year).toBe(2024)
  })

  it('keeps the folder when its manifest cannot be read', async () => {
    bridge({
      listTree: vi
        .fn()
        .mockResolvedValue(
          tree([{ name: 'iniciativa.json', path: `${R2}/portal/iniciativa.json` }])
        ),
      readFile: vi.fn().mockRejectedValue(new Error('EACCES'))
    })
    const { result } = renderHook(() => useInitiatives('/ws'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.initiatives[0].title).toBe('Portal')
  })

  it('re-walks when something lands under the root — the agent writes here, and never says so', async () => {
    const { result } = renderHook(() => useInitiatives('/ws'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const before = (window.hive.listTree as ReturnType<typeof vi.fn>).mock.calls.length

    act(() => watchers.forEach((notify) => notify({ type: 'add', path: `${R2}/portal/prd.md` })))
    await waitFor(() =>
      expect((window.hive.listTree as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        before
      )
    )
  })

  it('ignores a change anywhere else in the workspace', async () => {
    const { result } = renderHook(() => useInitiatives('/ws'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const before = (window.hive.listTree as ReturnType<typeof vi.fn>).mock.calls.length

    act(() => watchers.forEach((notify) => notify({ type: 'add', path: 'src/index.ts' })))
    expect((window.hive.listTree as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before)
  })

  it('creates the folder and its manifest, and answers with the path', async () => {
    const { result } = renderHook(() => useInitiatives('/ws'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    let created = ''
    await act(async () => {
      created = await result.current.create({
        title: 'Portal de Cobrança',
        year: 2026,
        release: 'R3'
      })
    })
    expect(created).toBe(`${INITIATIVES_ROOT}/R3/portal-de-cobranca`)
    expect(window.hive.fs.createDirectory).toHaveBeenCalledWith('/ws', created)
    const [, path, contents] = (window.hive.fs.saveFile as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(path).toBe(`${created}/iniciativa.json`)
    expect(JSON.parse(contents as string)).toMatchObject({
      title: 'Portal de Cobrança',
      year: 2026,
      release: 'R3'
    })
  })

  it('refuses to create over a folder that already exists', async () => {
    bridge({
      fs: {
        ...window.hive.fs,
        exists: vi.fn().mockResolvedValue(true),
        createDirectory: vi.fn(),
        saveFile: vi.fn()
      }
    })
    const { result } = renderHook(() => useInitiatives('/ws'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await expect(
      result.current.create({ title: 'Portal', year: 2026, release: 'R1' })
    ).rejects.toBeInstanceOf(InitiativeExistsError)
    expect(window.hive.fs.createDirectory).not.toHaveBeenCalled()
  })
})
