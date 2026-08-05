// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { DragEvent } from 'react'
import {
  WORKSPACE_FILE_DRAG_MIME,
  isWorkspaceFileDrag,
  readWorkspaceFileDrag,
  setWorkspaceFileDrag
} from './workspaceFileDnd'

/** Minimal dataTransfer stand-in (jsdom has no DataTransfer constructor). */
function fakeEvent(store: Record<string, string> = {}): DragEvent {
  return {
    dataTransfer: {
      types: Object.keys(store),
      setData: (type: string, data: string) => {
        store[type] = data
      },
      getData: (type: string) => store[type] ?? ''
    }
  } as unknown as DragEvent
}

describe('workspaceFileDnd', () => {
  it('round-trips a file-path payload through set/read', () => {
    const store: Record<string, string> = {}
    setWorkspaceFileDrag(fakeEvent(store), ['docs/prd.md', 'README.md'])
    const event = fakeEvent(store)
    expect(isWorkspaceFileDrag(event)).toBe(true)
    expect(readWorkspaceFileDrag(event)).toEqual(['docs/prd.md', 'README.md'])
  })

  it('an empty payload writes nothing (directories-only selection)', () => {
    const store: Record<string, string> = {}
    setWorkspaceFileDrag(fakeEvent(store), [])
    expect(isWorkspaceFileDrag(fakeEvent(store))).toBe(false)
  })

  it('is not fooled by other drags, and reads malformed payloads as no files', () => {
    expect(isWorkspaceFileDrag(fakeEvent({ 'text/plain': 'docs' }))).toBe(false)
    expect(readWorkspaceFileDrag(fakeEvent({ [WORKSPACE_FILE_DRAG_MIME]: 'not-json{' }))).toEqual(
      []
    )
    expect(readWorkspaceFileDrag(fakeEvent({ [WORKSPACE_FILE_DRAG_MIME]: '{"a":1}' }))).toEqual([])
  })

  it('survives a dataTransfer whose setData throws (jsdom quirk)', () => {
    const event = {
      dataTransfer: {
        setData: vi.fn(() => {
          throw new Error('nope')
        })
      }
    } as unknown as DragEvent
    expect(() => setWorkspaceFileDrag(event, ['a.txt'])).not.toThrow()
  })
})
