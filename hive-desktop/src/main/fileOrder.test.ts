import { describe, expect, it } from 'vitest'
import { compareEntries, compareFileNames, type OrderableEntry } from './fileOrder'

/** Sorts a list of names with the explorer's own name comparator. */
function sortNames(names: string[]): string[] {
  return [...names].sort(compareFileNames)
}

/** Sorts `dir/` and `file` entries the way a tree level is ordered. */
function sortEntries(entries: OrderableEntry[]): string[] {
  return [...entries]
    .sort(compareEntries)
    .map((entry) => (entry.directory ? `${entry.name}/` : entry.name))
}

const dir = (name: string): OrderableEntry => ({ name, directory: true })
const file = (name: string): OrderableEntry => ({ name, directory: false })

describe('compareFileNames', () => {
  it('counts digit runs instead of comparing them character by character', () => {
    expect(sortNames(['item10.md', 'item2.md', 'item1.md'])).toEqual([
      'item1.md',
      'item2.md',
      'item10.md'
    ])
  })

  it('treats case as a tertiary difference, not a first-class one', () => {
    // A raw code-unit sort would put every capital ahead of every lowercase
    // and file `README.md` before `api.ts`. VS Code sorts by the word.
    expect(sortNames(['README.md', 'api.ts', 'AGENTS.md', 'build.mjs'])).toEqual([
      'AGENTS.md',
      'api.ts',
      'build.mjs',
      'README.md'
    ])
  })

  it('breaks a numeric-collation tie by length so the order is stable', () => {
    // `foo1` and `foo01` compare equal under `numeric: true`; without the
    // tie-break the same directory could come back in either order.
    expect(compareFileNames('foo1', 'foo01')).toBeLessThan(0)
    expect(compareFileNames('foo01', 'foo1')).toBeGreaterThan(0)
    expect(compareFileNames('foo1', 'foo1')).toBe(0)
  })

  it('sorts accented names next to their base letter', () => {
    expect(sortNames(['zebra.md', 'época.md', 'estado.md'])).toEqual([
      'época.md',
      'estado.md',
      'zebra.md'
    ])
  })
})

describe('compareEntries', () => {
  it('puts every directory ahead of every file', () => {
    expect(sortEntries([file('AGENTS.md'), dir('src'), file('README.md'), dir('assets')])).toEqual([
      'assets/',
      'src/',
      'AGENTS.md',
      'README.md'
    ])
  })

  it('orders inside each group by name', () => {
    expect(sortEntries([dir('utils'), dir('components'), file('b.ts'), file('a.ts')])).toEqual([
      'components/',
      'utils/',
      'a.ts',
      'b.ts'
    ])
  })
})
