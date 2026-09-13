import { describe, expect, it } from 'vitest'
import {
  defaultViewOfTab,
  isSidebarView,
  isWorkView,
  SIDEBAR_VIEWS,
  tabOfView,
  WORK_VIEWS
} from './sidebarNav'

describe('sidebar navigation model', () => {
  it('keeps the conversation list in Chat and the workspace surfaces in Arquivos', () => {
    expect(SIDEBAR_VIEWS.map((view) => [view, tabOfView(view)])).toEqual([
      ['chat', 'chat'],
      ['explorer', 'files'],
      ['scm', 'files']
    ])
    expect(defaultViewOfTab('chat')).toBe('chat')
    expect(defaultViewOfTab('files')).toBe('explorer')
  })

  /**
   * The split that keeps the history on screen. `review` and `brain` are work,
   * not navigation: as sidebar views, opening one evicted the conversation list
   * the user navigates by and then ran a diff review in a 280px column.
   */
  it('separates the work surfaces from the sidebar views, with no id in both', () => {
    expect(WORK_VIEWS).toEqual(['chat', 'review', 'brain'])
    for (const view of ['review', 'brain']) expect(isSidebarView(view)).toBe(false)
    for (const view of ['explorer', 'scm']) expect(isWorkView(view)).toBe(false)
    // `chat` is the one name both vocabularies use — the conversation list in
    // the rail, the transcript in the pane — and it is the home of each.
    expect(isSidebarView('chat') && isWorkView('chat')).toBe(true)
  })

  it('accepts persisted views and rejects invalid workspace session values', () => {
    for (const view of SIDEBAR_VIEWS) expect(isSidebarView(view)).toBe(true)
    for (const value of [null, undefined, 0, {}, [], 'files', 'profile', '']) {
      expect(isSidebarView(value)).toBe(false)
    }
    for (const view of WORK_VIEWS) expect(isWorkView(view)).toBe(true)
    for (const value of [null, undefined, 0, {}, [], 'files', 'profile', '']) {
      expect(isWorkView(value)).toBe(false)
    }
  })
})
