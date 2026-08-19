import { describe, expect, it } from 'vitest'
import {
  namesIn,
  nextCopyName,
  pasteableSources,
  pasteDestination,
  type FileClipboard
} from './fileClipboard'

/**
 * The two decisions that decide whether paste *feels* right — what the copy is
 * called, and where it lands — plus the two guards around them. Pure functions,
 * so they are tested directly rather than through six clicks of a tree.
 */
describe('nextCopyName', () => {
  it('leaves a free name alone', () => {
    expect(nextCopyName('nota.md', new Set())).toBe('nota.md')
    expect(nextCopyName('nota.md', new Set(['outra.md']))).toBe('nota.md')
  })

  it('suffixes a taken name, keeping the extension where it belongs', () => {
    expect(nextCopyName('nota.md', new Set(['nota.md']))).toBe('nota cópia.md')
  })

  it('numbers the series from the second copy on', () => {
    expect(nextCopyName('nota.md', new Set(['nota.md', 'nota cópia.md']))).toBe('nota cópia 2.md')
    expect(nextCopyName('nota.md', new Set(['nota.md', 'nota cópia.md', 'nota cópia 2.md']))).toBe(
      'nota cópia 3.md'
    )
  })

  it('continues the series instead of nesting it — never "nota cópia cópia.md"', () => {
    expect(nextCopyName('nota cópia.md', new Set(['nota cópia.md']))).toBe('nota cópia 2.md')
    expect(nextCopyName('nota cópia 2.md', new Set(['nota cópia.md', 'nota cópia 2.md']))).toBe(
      'nota cópia 3.md'
    )
  })

  it('treats a dotfile as all stem — ".env" is not a file called nothing', () => {
    expect(nextCopyName('.env', new Set(['.env']))).toBe('.env cópia')
  })

  it('handles a name with no extension, and one with several dots', () => {
    expect(nextCopyName('Makefile', new Set(['Makefile']))).toBe('Makefile cópia')
    expect(nextCopyName('app.test.ts', new Set(['app.test.ts']))).toBe('app.test cópia.ts')
  })

  it('applies to directories the same way (they have no extension to protect)', () => {
    expect(nextCopyName('docs', new Set(['docs']))).toBe('docs cópia')
  })
})

describe('pasteDestination', () => {
  const types = new Map<string, 'file' | 'directory'>([
    ['docs', 'directory'],
    ['docs/prd.md', 'file'],
    ['README.md', 'file']
  ])

  it('is the selected folder itself', () => {
    expect(pasteDestination(['docs'], types, '')).toBe('docs')
  })

  it("is a selected file's own folder", () => {
    expect(pasteDestination(['docs/prd.md'], types, '')).toBe('docs')
    expect(pasteDestination(['README.md'], types, 'docs')).toBe('')
  })

  it('falls back to the active dir for an empty or mixed selection', () => {
    expect(pasteDestination([], types, 'docs')).toBe('docs')
    expect(pasteDestination(['docs', 'README.md'], types, 'docs')).toBe('docs')
  })

  it('falls back rather than trusting a selection the tree no longer has', () => {
    expect(pasteDestination(['deleted.md'], types, 'docs')).toBe('docs')
  })
})

describe('namesIn', () => {
  const types = new Map<string, 'file' | 'directory'>([
    ['README.md', 'file'],
    ['docs', 'directory'],
    ['docs/prd.md', 'file'],
    ['docs/deep', 'directory'],
    ['docs/deep/nested.md', 'file']
  ])

  it('lists only the direct children of a directory', () => {
    expect([...namesIn('docs', types)].sort()).toEqual(['deep', 'prd.md'])
  })

  it("lists the root's own direct children for ''", () => {
    expect([...namesIn('', types)].sort()).toEqual(['README.md', 'docs'])
  })

  it('does not confuse a sibling whose name merely starts the same way', () => {
    const siblings = new Map<string, 'file' | 'directory'>([
      ['docs', 'directory'],
      ['docs-old', 'directory'],
      ['docs-old/x.md', 'file']
    ])
    expect([...namesIn('docs', siblings)]).toEqual([])
  })
})

describe('pasteableSources', () => {
  it('keeps ordinary sources', () => {
    expect(pasteableSources(['a.md', 'docs/b.md'], 'src')).toEqual(['a.md', 'docs/b.md'])
  })

  it('drops a folder pasted into itself or into its own subtree', () => {
    expect(pasteableSources(['docs'], 'docs')).toEqual([])
    expect(pasteableSources(['docs'], 'docs/deep')).toEqual([])
  })

  it('keeps a sibling whose path merely shares a prefix', () => {
    expect(pasteableSources(['docs'], 'docs-old')).toEqual(['docs'])
  })
})

describe('FileClipboard', () => {
  it('is a mode plus the paths it covers', () => {
    const clipboard: FileClipboard = { mode: 'cut', paths: ['a.md'] }
    expect(clipboard.mode).toBe('cut')
  })
})
