// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { WorkspaceMark } from './WorkspaceMark'
import { workspaceHue, workspaceMonogram, workspaceState } from './workspaceVisuals'
import { locationOf, shortenPath } from './workspacePath'
import { folderNameOf } from './workspaceName'
import { matchesQuery, panelOrder, type WorkspaceInfo } from './useWorkspaces'

afterEach(() => cleanup())

function entry(over: Partial<WorkspaceInfo> & { path: string }): WorkspaceInfo {
  return {
    name: null,
    displayName: folderNameOf(over.path),
    kind: 'managed',
    primary: false,
    lastOpenedAt: 1,
    provisioned: true,
    missing: false,
    ...over
  }
}

describe('workspaceHue — the identity colour', () => {
  it('is stable for a path: the same folder wears the same colour every launch', () => {
    expect(workspaceHue('/home/dev/api-gateway')).toBe(workspaceHue('/home/dev/api-gateway'))
  })

  it('ignores a trailing separator and letter case — the same place is the same place', () => {
    expect(workspaceHue('/home/dev/API/')).toBe(workspaceHue('/home/dev/api'))
    expect(workspaceHue('C:\\work\\app\\')).toBe(workspaceHue('c:\\work\\app'))
  })

  it('spreads different paths across the palette rather than collapsing onto one hue', () => {
    const hues = new Set(
      ['/a/one', '/a/two', '/a/three', '/b/four', '/b/five', '/c/six'].map(workspaceHue)
    )
    expect(hues.size).toBeGreaterThan(1)
  })
})

describe('workspaceMonogram', () => {
  it('takes one letter from a single-word name', () => {
    expect(workspaceMonogram('hive')).toBe('H')
  })

  it('takes both initials from a segmented name, on either separator', () => {
    expect(workspaceMonogram('api-gateway')).toBe('AG')
    expect(workspaceMonogram('design_system')).toBe('DS')
    expect(workspaceMonogram('Minha Squad')).toBe('MS')
  })

  it('skips connector words, so a Portuguese name is not initialled by a preposition', () => {
    expect(workspaceMonogram('Spike de pagamentos')).toBe('SP')
    expect(workspaceMonogram('notas-da-squad')).toBe('NS')
  })

  it('stands alone when every later word is too short to mean anything', () => {
    expect(workspaceMonogram('app de ti')).toBe('A')
  })

  it('survives an empty name and does not slice a multi-byte glyph in half', () => {
    expect(workspaceMonogram('   ')).toBe('?')
    expect(workspaceMonogram('🎨 design')).toBe('🎨D')
  })
})

describe('WorkspaceMark', () => {
  it('is decorative: the name is always rendered as text next to it, so it stays out of the a11y tree', () => {
    const { container } = render(
      createElement(WorkspaceMark, { path: '/home/dev/api-gateway', name: 'api-gateway' })
    )
    const mark = container.querySelector('.wb-ws-mark')
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
    expect(mark?.textContent).toBe('AG')
  })

  it('carries its hue and size as custom properties, so theming stays token-driven', () => {
    const { container } = render(
      createElement(WorkspaceMark, { path: '/x/y', name: 'y', size: 44 })
    )
    const style = container.querySelector<HTMLElement>('.wb-ws-mark')?.getAttribute('style') ?? ''
    expect(style).toContain('--wb-ws-size: 44px')
    expect(style).toMatch(/--wb-ws-hue: var\(--wb-ic-[a-z]+\)/)
  })

  it('renders without a className and at its default size', () => {
    const { container } = render(createElement(WorkspaceMark, { path: '/x/hive', name: 'hive' }))
    const mark = container.querySelector<HTMLElement>('.wb-ws-mark')
    expect(mark?.className).toBe('wb-ws-mark')
    expect(mark?.getAttribute('style')).toContain('--wb-ws-size: 28px')
    expect(mark?.getAttribute('data-missing')).toBeNull()
  })

  it('takes an extra className without losing its own', () => {
    const { container } = render(
      createElement(WorkspaceMark, { path: '/x/hive', name: 'hive', className: 'extra' })
    )
    expect(container.querySelector('.wb-ws-mark')?.className).toBe('wb-ws-mark extra')
  })

  it('flags a folder that is gone, so the tile can drain its colour', () => {
    const { container } = render(
      createElement(WorkspaceMark, { path: '/gone', name: 'gone', missing: true })
    )
    expect(container.querySelector('.wb-ws-mark')?.getAttribute('data-missing')).toBe('true')
  })
})

describe('folderNameOf', () => {
  it('answers with the last segment on either separator', () => {
    expect(folderNameOf('/home/dev/api-gateway')).toBe('api-gateway')
    expect(folderNameOf('C:\\Users\\dev\\api')).toBe('api')
  })

  it('falls back to the whole value when there is no segment to take', () => {
    // A hand-edited config can hold an empty or separator-only path; the
    // placeholder it feeds must not come out blank.
    expect(folderNameOf('')).toBe('')
    expect(folderNameOf('/')).toBe('/')
  })
})

describe('path formatting', () => {
  it('shortenPath keeps a short path whole and trims a long one from the front', () => {
    expect(shortenPath('/home/dev')).toBe('/home/dev')
    expect(shortenPath('/home/dev/work/api-gateway')).toBe('…/dev/work/api-gateway')
  })

  it('locationOf answers "where does it live", not "what is it called"', () => {
    // The row already prints the name on the line above; repeating it here
    // spends the width that disambiguates two folders with the same name.
    expect(locationOf('/home/dev/work/api-gateway')).toBe('…/dev/work')
    expect(locationOf('C:\\Users\\dev\\api')).toBe('…/Users/dev')
  })

  it('locationOf returns a root path untouched rather than an empty line', () => {
    expect(locationOf('/ws')).toBe('/ws')
    expect(locationOf('/')).toBe('/')
  })
})

describe('panelOrder', () => {
  it('puts the primary first and leaves everything else in registry (MRU) order', () => {
    const ordered = panelOrder([
      entry({ path: '/recent' }),
      entry({ path: '/main', primary: true }),
      entry({ path: '/older' })
    ])
    expect(ordered.map((e) => e.path)).toEqual(['/main', '/recent', '/older'])
  })

  it('is the same order the Ctrl+N jump resolves against, even with no primary', () => {
    const ordered = panelOrder([entry({ path: '/a' }), entry({ path: '/b' })])
    expect(ordered.map((e) => e.path)).toEqual(['/a', '/b'])
  })
})

describe('workspaceState — what a row says about itself', () => {
  it('reports a missing folder before anything else — it cannot be interrogated', () => {
    expect(workspaceState(entry({ path: '/gone', missing: true, kind: 'light' }))).toBe('missing')
  })

  it('a light workspace is light, whatever the disk happens to contain', () => {
    // Someone else's `_bmad/` is not consent to manage the folder.
    expect(workspaceState(entry({ path: '/notes', kind: 'light', provisioned: true }))).toBe(
      'light'
    )
  })

  it('separates a managed workspace from one whose install never finished', () => {
    expect(workspaceState(entry({ path: '/ok', provisioned: true }))).toBe('managed')
    expect(workspaceState(entry({ path: '/half', provisioned: false }))).toBe('pending')
  })
})

describe('matchesQuery — the switcher filter', () => {
  const notes = entry({ path: '/home/dev/Documentos/notas', displayName: 'Notas da Squad' })

  it('matches on the display name, ignoring case and accents', () => {
    expect(matchesQuery(notes, 'NOTAS')).toBe(true)
    expect(matchesQuery(notes, 'squad')).toBe(true)
    expect(matchesQuery(notes, 'documentos')).toBe(true)
  })

  it('matches on any part of the path — two folders can share a name', () => {
    expect(matchesQuery(notes, '/home/dev')).toBe(true)
  })

  it('an empty or whitespace query keeps everything', () => {
    expect(matchesQuery(notes, '')).toBe(true)
    expect(matchesQuery(notes, '   ')).toBe(true)
  })

  it('rejects what does not appear in either', () => {
    expect(matchesQuery(notes, 'gateway')).toBe(false)
  })
})
