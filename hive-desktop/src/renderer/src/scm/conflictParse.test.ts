import { describe, expect, it } from 'vitest'
import {
  applyResolutions,
  conflictCount,
  hasConflictMarkers,
  parseConflicts,
  type ConflictChoice
} from './conflictParse'

const twoWay = ['a', '<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> other', 'b'].join('\n')

const diff3 = [
  'a',
  '<<<<<<< HEAD',
  'ours',
  '||||||| base',
  'original',
  '=======',
  'theirs',
  '>>>>>>> other',
  'b'
].join('\n')

describe('hasConflictMarkers', () => {
  it('detects an opening marker', () => {
    expect(hasConflictMarkers(twoWay)).toBe(true)
    expect(hasConflictMarkers('no conflicts here')).toBe(false)
  })
})

describe('parseConflicts', () => {
  it('splits a 2-way conflict into text + block segments', () => {
    const segments = parseConflicts(twoWay)
    expect(segments).toEqual([
      { type: 'text', lines: ['a'] },
      { type: 'conflict', id: 0, ours: ['ours'], theirs: ['theirs'] },
      { type: 'text', lines: ['b'] }
    ])
    expect(conflictCount(segments)).toBe(1)
  })

  it('discards the diff3 base section', () => {
    const block = parseConflicts(diff3).find((s) => s.type === 'conflict')
    expect(block).toMatchObject({ ours: ['ours'], theirs: ['theirs'] })
  })

  it('numbers multiple blocks', () => {
    const content = [
      '<<<<<<< HEAD',
      'a1',
      '=======',
      'b1',
      '>>>>>>> x',
      'mid',
      '<<<<<<< HEAD',
      'a2',
      '=======',
      'b2',
      '>>>>>>> x'
    ].join('\n')
    const blocks = parseConflicts(content).filter((s) => s.type === 'conflict')
    expect(blocks.map((b) => (b.type === 'conflict' ? b.id : -1))).toEqual([0, 1])
  })
})

describe('applyResolutions', () => {
  it('rebuilds the file from each block choice', () => {
    const segments = parseConflicts(twoWay)
    const current: Map<number, ConflictChoice> = new Map([[0, 'current']])
    expect(applyResolutions(segments, current)).toBe(['a', 'ours', 'b'].join('\n'))

    const incoming: Map<number, ConflictChoice> = new Map([[0, 'incoming']])
    expect(applyResolutions(segments, incoming)).toBe(['a', 'theirs', 'b'].join('\n'))

    const both: Map<number, ConflictChoice> = new Map([[0, 'both']])
    expect(applyResolutions(segments, both)).toBe(['a', 'ours', 'theirs', 'b'].join('\n'))
  })

  it('defaults an unspecified block to both', () => {
    const segments = parseConflicts(twoWay)
    expect(applyResolutions(segments, new Map())).toBe(['a', 'ours', 'theirs', 'b'].join('\n'))
  })
})
