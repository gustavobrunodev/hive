import { describe, expect, it } from 'vitest'
import { computeGutter } from './gutter'

describe('computeGutter', () => {
  it('marks every line of a brand-new file as added', () => {
    expect(computeGutter('', 'a\nb\nc')).toEqual(['add', 'add', 'add'])
  })

  it('returns all-null for an unchanged file', () => {
    expect(computeGutter('a\nb\nc', 'a\nb\nc')).toEqual([null, null, null])
  })

  it('marks a purely added line', () => {
    // Inserted "x" between b and c.
    expect(computeGutter('a\nb\nc', 'a\nb\nx\nc')).toEqual([null, null, 'add', null])
  })

  it('marks a modified line (a delete paired with an insert)', () => {
    expect(computeGutter('a\nb\nc', 'a\nB\nc')).toEqual([null, 'modified', null])
  })

  it('marks a deletion boundary on the following line', () => {
    // Removed "b"; the deletion caret lands on the line that follows it ("c").
    expect(computeGutter('a\nb\nc', 'a\nc')).toEqual([null, 'deleted'])
  })

  it('marks a trailing deletion on the last line', () => {
    expect(computeGutter('a\nb\nc', 'a\nb')).toEqual([null, 'deleted'])
  })

  it('caps huge files (all null)', () => {
    const huge = Array.from({ length: 5001 }, (_, i) => `line ${i}`).join('\n')
    expect(computeGutter('', huge).every((m) => m === null)).toBe(true)
  })
})
