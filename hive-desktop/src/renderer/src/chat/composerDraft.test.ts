import { describe, expect, it } from 'vitest'
import {
  EMPTY_DRAFT,
  forgetDraft,
  isEmptyDraft,
  parkDraft,
  takeDraft,
  type ComposerDraft,
  type DraftStore
} from './composerDraft'
import type { AttachmentEntry } from './useAttachments'

function file(name: string): AttachmentEntry {
  return { path: `/abs/${name}`, name, size: 10, kind: 'external' }
}

function draft(text: string, ...names: string[]): ComposerDraft {
  return { text, attachments: names.map(file) }
}

describe('isEmptyDraft', () => {
  it('treats whitespace-only text with no files as empty', () => {
    expect(isEmptyDraft({ text: '   \n ', attachments: [] })).toBe(true)
    expect(isEmptyDraft(EMPTY_DRAFT)).toBe(true)
  })

  // A file with no message is the whole point of `allowEmptySubmit` — it is a
  // draft worth parking even though nothing was typed.
  it('is not empty when only files are attached', () => {
    expect(isEmptyDraft(draft('', 'prd.md'))).toBe(false)
  })
})

describe('parkDraft / takeDraft', () => {
  it('gives each conversation back its own draft', () => {
    const store: DraftStore = new Map()
    parkDraft(store, 'a', draft('para a', 'a.md'))
    parkDraft(store, 'b', draft('para b', 'b.md'))
    expect(takeDraft(store, 'b')).toEqual(draft('para b', 'b.md'))
    expect(takeDraft(store, 'a')).toEqual(draft('para a', 'a.md'))
  })

  // The defect this module exists for: a file attached in one conversation
  // must not be waiting in the composer of the next one.
  it('hands a conversation that parked nothing an empty draft', () => {
    const store: DraftStore = new Map()
    parkDraft(store, 'a', draft('', 'segredo.docx'))
    expect(takeDraft(store, 'b')).toEqual(EMPTY_DRAFT)
    expect(takeDraft(store, null)).toEqual(EMPTY_DRAFT)
  })

  it('releases the slot on take, so a draft is restored once', () => {
    const store: DraftStore = new Map()
    parkDraft(store, 'a', draft('oi'))
    expect(takeDraft(store, 'a').text).toBe('oi')
    expect(takeDraft(store, 'a')).toEqual(EMPTY_DRAFT)
  })

  it('parking an empty draft clears whatever was there', () => {
    const store: DraftStore = new Map()
    parkDraft(store, 'a', draft('rascunho', 'a.md'))
    parkDraft(store, 'a', EMPTY_DRAFT)
    expect(takeDraft(store, 'a')).toEqual(EMPTY_DRAFT)
  })

  it('ignores a conversation with no id — there is no handle to bring it back by', () => {
    const store: DraftStore = new Map()
    parkDraft(store, null, draft('perdido', 'x.md'))
    expect(store.size).toBe(0)
  })

  // The composer keeps mutating its own array; a parked copy that shares the
  // reference would drift with it.
  it('parks a copy of the attachment list', () => {
    const store: DraftStore = new Map()
    const live = [file('a.md')]
    parkDraft(store, 'a', { text: '', attachments: live })
    live.push(file('b.md'))
    expect(takeDraft(store, 'a').attachments).toHaveLength(1)
  })
})

describe('forgetDraft', () => {
  it('drops a deleted conversation’s draft', () => {
    const store: DraftStore = new Map()
    parkDraft(store, 'a', draft('oi'))
    forgetDraft(store, 'a')
    expect(takeDraft(store, 'a')).toEqual(EMPTY_DRAFT)
  })
})
