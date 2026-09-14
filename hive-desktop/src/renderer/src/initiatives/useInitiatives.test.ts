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
      saveFile: vi.fn().mockResolvedValue({ mtimeMs: 1, size: 1 }),
      move: vi.fn().mockResolvedValue(undefined),
      trash: vi.fn().mockResolvedValue(undefined)
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

describe('useInitiatives — editing a demand', () => {
  /** The hook, ready, plus the demand it read off disk. */
  async function ready(): Promise<
    ReturnType<typeof renderHook<ReturnType<typeof useInitiatives>, unknown>>
  > {
    const rendered = renderHook(() => useInitiatives('/ws'))
    await waitFor(() => expect(rendered.result.current.status).toBe('ready'))
    return rendered
  }

  /** The manifest object the hook wrote, parsed back. */
  function writtenManifest(): Record<string, unknown> {
    const calls = vi.mocked(window.hive.fs.saveFile).mock.calls
    return JSON.parse(String(calls[calls.length - 1][2])) as Record<string, unknown>
  }

  it('writes the new title, year and colour without touching the folder name', async () => {
    const { result } = await ready()
    const demand = result.current.initiatives[0]
    await act(async () => {
      await result.current.update(demand, { title: 'Portal novo', year: 2027, color: 'amber' })
    })
    // The slug is an identity — conversations, editor tabs and artifacts all
    // point at it. Only the label changed.
    expect(window.hive.fs.move).not.toHaveBeenCalled()
    expect(vi.mocked(window.hive.fs.saveFile).mock.calls[0][1]).toBe(`${R2}/portal/iniciativa.json`)
    expect(writtenManifest()).toMatchObject({
      title: 'Portal novo',
      year: 2027,
      color: 'amber',
      release: 'R2'
    })
  })

  it('moves the folder when the release changes, and answers with the new path', async () => {
    const { result } = await ready()
    const demand = result.current.initiatives[0]
    let landed = ''
    await act(async () => {
      landed = await result.current.update(demand, { release: 'R3' })
    })
    expect(landed).toBe(`${INITIATIVES_ROOT}/R3/portal`)
    expect(window.hive.fs.move).toHaveBeenCalledWith(
      '/ws',
      `${R2}/portal`,
      `${INITIATIVES_ROOT}/R3/portal`
    )
    // The manifest lands at the NEW path: writing it first would have left it
    // describing a folder the move then emptied.
    expect(vi.mocked(window.hive.fs.saveFile).mock.calls[0][1]).toBe(
      `${INITIATIVES_ROOT}/R3/portal/iniciativa.json`
    )
  })

  it('refuses a release move onto a demand that is already there', async () => {
    bridge({ fs: { ...window.hive.fs, exists: vi.fn().mockResolvedValue(true) } })
    const { result } = await ready()
    const demand = result.current.initiatives[0]
    await expect(result.current.update(demand, { release: 'R3' })).rejects.toBeInstanceOf(
      InitiativeExistsError
    )
    expect(window.hive.fs.move).not.toHaveBeenCalled()
  })

  it('keeps the original createdAt rather than inventing a new history', async () => {
    bridge({
      readFile: vi.fn().mockResolvedValue(JSON.stringify({ createdAt: '2020-01-01T00:00:00.000Z' }))
    })
    const { result } = await ready()
    await act(async () => {
      await result.current.update(result.current.initiatives[0], { title: 'Outro' })
    })
    expect(writtenManifest().createdAt).toBe('2020-01-01T00:00:00.000Z')
  })

  it('sends a deleted demand to the trash, not to an unlink', async () => {
    const { result } = await ready()
    await act(async () => {
      await result.current.remove(result.current.initiatives[0])
    })
    // The folder holds every artifact the demand produced — "recoverable" is
    // the only acceptable meaning of delete for that.
    expect(window.hive.fs.trash).toHaveBeenCalledWith('/ws', `${R2}/portal`)
  })
})
