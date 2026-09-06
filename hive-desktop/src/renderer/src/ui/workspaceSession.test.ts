// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EMPTY_SESSION,
  loadWorkspaceSession,
  mergeLayout,
  saveWorkspaceSession
} from './workspaceSession'

const KEY = 'hive.workspaceSession'
const WS = '/home/user/project'

/** The stored record for one workspace, as JSON. */
function stored(workspace = WS): Record<string, unknown> {
  const raw = localStorage.getItem(KEY)
  return raw ? ((JSON.parse(raw) as Record<string, Record<string, unknown>>)[workspace] ?? {}) : {}
}

/** Writes a raw record (bypassing the writer, so corrupt payloads can be exercised). */
function seed(value: unknown): void {
  localStorage.setItem(KEY, JSON.stringify(value))
}

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

/**
 * `workspaceSession` — the per-workspace UI state the workbench reopens into:
 * files, conversation, folders, sidebar and pane widths.
 */
describe('workspaceSession — first launch', () => {
  it('opens a workspace nobody has saved on the chat alone', () => {
    expect(loadWorkspaceSession(WS)).toEqual(EMPTY_SESSION)
    expect(EMPTY_SESSION.sidebarOpen).toBe(false)
  })

  it('keeps workspaces apart', () => {
    saveWorkspaceSession(WS, { sidebarOpen: true, sidebarView: 'scm' })
    expect(loadWorkspaceSession('/other').sidebarOpen).toBe(false)
    expect(loadWorkspaceSession(WS).sidebarView).toBe('scm')
  })
})

describe('workspaceSession — migration from the pre-workspaceSession keys', () => {
  it('adopts the old global view and layout as seeds', () => {
    localStorage.setItem('hive.sidebarView', 'brain')
    localStorage.setItem('hive.workLayout', JSON.stringify({ rail: 27, chat: 73 }))

    const session = loadWorkspaceSession(WS)
    expect(session.sidebarView).toBe('brain')
    expect(session.layout).toEqual({ rail: 27, chat: 73 })
    // ...but never an open sidebar: the rule is about a workspace with no
    // session, and the old global key says nothing about this workspace.
    expect(session.sidebarOpen).toBe(false)
  })

  it('survives each legacy key being corrupt on its own', () => {
    localStorage.setItem('hive.sidebarView', 'not-a-view')
    localStorage.setItem('hive.workLayout', '{corrupt')
    expect(loadWorkspaceSession(WS)).toEqual(EMPTY_SESSION)
  })

  it('stops consulting them once the workspace has a session of its own', () => {
    localStorage.setItem('hive.sidebarView', 'brain')
    saveWorkspaceSession(WS, { sidebarView: 'explorer' })
    expect(loadWorkspaceSession(WS).sidebarView).toBe('explorer')
  })
})

describe('workspaceSession — reading back what was written', () => {
  it('round-trips a whole session', () => {
    const session = {
      tabs: [
        { path: 'docs/prd.md', pinned: true },
        { path: 'README.md', pinned: false }
      ],
      activeTab: 'README.md',
      expanded: ['docs', 'docs/stories'],
      chatSessionId: 's7',
      sidebarView: 'scm' as const,
      sidebarOpen: true,
      layout: { rail: 22, chat: 50, viewer: 28 }
    }
    saveWorkspaceSession(WS, session)
    expect(loadWorkspaceSession(WS)).toEqual(session)
  })

  it('merges a patch into what is already there', () => {
    saveWorkspaceSession(WS, { chatSessionId: 's1', expanded: ['docs'] })
    saveWorkspaceSession(WS, { sidebarOpen: true })
    const session = loadWorkspaceSession(WS)
    expect(session.chatSessionId).toBe('s1')
    expect(session.expanded).toEqual(['docs'])
    expect(session.sidebarOpen).toBe(true)
  })

  it('never hands out its own bookkeeping timestamp', () => {
    saveWorkspaceSession(WS, { sidebarOpen: true })
    expect(typeof stored().savedAt).toBe('number')
    expect(loadWorkspaceSession(WS)).not.toHaveProperty('savedAt')
  })
})

describe('workspaceSession — corrupt and hand-edited payloads', () => {
  it('falls back to the empty session for anything unparseable', () => {
    seed('{not json')
    expect(loadWorkspaceSession(WS)).toEqual(EMPTY_SESSION)
    localStorage.setItem(KEY, JSON.stringify(['an', 'array']))
    expect(loadWorkspaceSession(WS)).toEqual(EMPTY_SESSION)
  })

  it('drops junk field by field, so one bad field never costs the rest', () => {
    seed({
      [WS]: {
        savedAt: 'yesterday',
        tabs: [{ path: 'a.md', pinned: true }, { path: 42 }, null, { path: 'a.md' }],
        activeTab: 'gone.md',
        expanded: ['docs', 'docs', 7],
        chatSessionId: 12,
        sidebarView: 'nowhere',
        sidebarOpen: 'yes',
        layout: { rail: 'wide' }
      }
    })
    expect(loadWorkspaceSession(WS)).toEqual({
      tabs: [{ path: 'a.md', pinned: true }],
      // An active tab that isn't in the strip is a torn write, not a state.
      activeTab: 'a.md',
      expanded: ['docs'],
      chatSessionId: null,
      sidebarView: 'explorer',
      // Only a literal `true` opens the sidebar — a truthy string does not.
      sidebarOpen: false,
      layout: null
    })
  })

  it('skips entries that are not objects at all', () => {
    seed({ [WS]: 'nope', '/other': { sidebarOpen: true } })
    expect(loadWorkspaceSession(WS)).toEqual(EMPTY_SESSION)
    expect(loadWorkspaceSession('/other').sidebarOpen).toBe(true)
  })

  it('treats an empty layout object as no layout', () => {
    seed({ [WS]: { layout: {} } })
    expect(loadWorkspaceSession(WS).layout).toBeNull()
  })

  it('survives storage that throws on read and on write', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(loadWorkspaceSession(WS)).toEqual(EMPTY_SESSION)
    expect(() => saveWorkspaceSession(WS, { sidebarOpen: true })).not.toThrow()
    getItem.mockRestore()
    setItem.mockRestore()
  })
})

describe('workspaceSession — the record stays bounded', () => {
  it('evicts the least-recently-saved workspace past the cap', () => {
    const now = vi.spyOn(Date, 'now')
    for (let index = 0; index < 14; index += 1) {
      now.mockReturnValue(1000 + index)
      saveWorkspaceSession(`/ws-${index}`, { chatSessionId: `s${index}` })
    }
    now.mockRestore()

    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    expect(Object.keys(all)).toHaveLength(12)
    // The two oldest are gone; the newest is not.
    expect(all['/ws-0']).toBeUndefined()
    expect(all['/ws-1']).toBeUndefined()
    expect(all['/ws-13']).toBeDefined()
  })
})

/**
 * The layout merge is what keeps a hidden sidebar's width alive:
 * `react-resizable-panels` reports a collapsed panel as ~0, and writing that
 * through would mean re-dragging the rail after every Ctrl+B.
 */
describe('workspaceSession — mergeLayout', () => {
  it('keeps a known width when the live report is a collapse', () => {
    expect(mergeLayout({ rail: 24, chat: 76 }, { rail: 0, chat: 100 })).toEqual({
      rail: 24,
      chat: 100
    })
  })

  it('takes every real width, including a brand-new pane', () => {
    expect(mergeLayout({ rail: 24, chat: 76 }, { rail: 18, chat: 52, viewer: 30 })).toEqual({
      rail: 18,
      chat: 52,
      viewer: 30
    })
  })

  it('records a zero for a pane nothing knew about — there is no better answer', () => {
    expect(mergeLayout(null, { rail: 0 })).toEqual({ rail: 0 })
  })
})
