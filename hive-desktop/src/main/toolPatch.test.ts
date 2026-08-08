import { describe, expect, it } from 'vitest'
import { buildToolPatch, diffLines, diffWords, similarity, toHunks } from './toolPatch'

/** A `readSource` that serves one file and reports every other path as absent. */
function source(path: string, text: string) {
  return (asked: string): string | null => (asked === path ? text : null)
}

const none = (): string | null => null

/** Every line of a patch, flattened, as `"<sign><text>"` — the shape assertions read against. */
function rendered(patch: ReturnType<typeof buildToolPatch>): string[] {
  if (!patch) return []
  const out: string[] = []
  for (const hunk of patch.hunks) {
    for (const line of hunk.lines) {
      out.push(`${line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}${line.text}`)
    }
  }
  return out
}

describe('buildToolPatch — Edit', () => {
  const file = ['const a = 1', 'const b = 2', 'const c = 3'].join('\n')

  it('anchors the change to the real file, so the numbers are the file’s own', () => {
    const patch = buildToolPatch(
      'Edit',
      { file_path: '/ws/x.ts', old_string: 'const b = 2', new_string: 'const b = 22' },
      source('/ws/x.ts', file)
    )
    expect(patch?.anchored).toBe(true)
    expect(patch?.op).toBe('edit')
    expect(patch?.adds).toBe(1)
    expect(patch?.dels).toBe(1)
    expect(rendered(patch)).toEqual([
      ' const a = 1',
      '-const b = 2',
      '+const b = 22',
      ' const c = 3'
    ])
    // One column, git-inline style: a removal keeps the old file's number, an
    // addition takes the new one's.
    const lines = patch!.hunks[0].lines
    expect(lines.map((line) => line.no)).toEqual([1, 2, 2, 3])
  })

  it('still shows the change when the file cannot be read, without inventing line numbers', () => {
    const patch = buildToolPatch(
      'Edit',
      { file_path: '/ws/gone.ts', old_string: 'a', new_string: 'b' },
      none
    )
    expect(patch?.anchored).toBe(false)
    expect(rendered(patch)).toEqual(['-a', '+b'])
    expect(patch?.hunks[0].lines.every((line) => line.no === null)).toBe(true)
  })

  it('falls back to unanchored when `old_string` does not match the file the agent is editing', () => {
    // The agent is working from a stale read — precisely when the user most
    // wants to see what it *thinks* it is replacing.
    const patch = buildToolPatch(
      'Edit',
      { file_path: '/ws/x.ts', old_string: 'const z = 9', new_string: 'const z = 10' },
      source('/ws/x.ts', file)
    )
    expect(patch?.anchored).toBe(false)
    expect(rendered(patch)).toEqual(['-const z = 9', '+const z = 10'])
  })

  it('honours `replace_all`, so the patch matches what the tool will actually do', () => {
    const patch = buildToolPatch(
      'Edit',
      { file_path: '/ws/x.ts', old_string: 'const', new_string: 'let', replace_all: true },
      source('/ws/x.ts', file)
    )
    expect(patch?.adds).toBe(3)
    expect(patch?.dels).toBe(3)
  })

  it('produces nothing at all for an edit that changes nothing', () => {
    expect(
      buildToolPatch(
        'Edit',
        { file_path: '/ws/x.ts', old_string: 'const b = 2', new_string: 'const b = 2' },
        source('/ws/x.ts', file)
      )
    ).toBeUndefined()
  })
})

describe('buildToolPatch — MultiEdit', () => {
  it('replays the edits in order, so an edit that builds on the previous one lands right', () => {
    const patch = buildToolPatch(
      'MultiEdit',
      {
        file_path: '/ws/x.ts',
        edits: [
          { old_string: 'alpha', new_string: 'beta' },
          // Only matches because the first edit already ran. Diffing each pair
          // independently would show the intermediate state as the final one.
          { old_string: 'beta', new_string: 'gamma' }
        ]
      },
      source('/ws/x.ts', 'alpha')
    )
    expect(rendered(patch)).toEqual(['-alpha', '+gamma'])
    expect(patch?.anchored).toBe(true)
  })

  it('ignores malformed entries rather than dropping the whole patch', () => {
    const patch = buildToolPatch(
      'MultiEdit',
      { file_path: '/ws/x.ts', edits: [null, 'nope', { old_string: 'a', new_string: 'b' }] },
      source('/ws/x.ts', 'a')
    )
    expect(rendered(patch)).toEqual(['-a', '+b'])
  })
})

describe('buildToolPatch — Write', () => {
  it('reads a file that does not exist yet as a creation, numbered from 1', () => {
    const patch = buildToolPatch('Write', { file_path: '/ws/new.ts', content: 'one\ntwo\n' }, none)
    expect(patch?.op).toBe('create')
    expect(patch?.anchored).toBe(true)
    expect(patch?.adds).toBe(2)
    expect(patch?.dels).toBe(0)
    expect(patch?.hunks[0].lines.map((line) => line.no)).toEqual([1, 2])
  })

  it('reads a Write over an existing file as a rewrite, diffed against what is there', () => {
    const patch = buildToolPatch(
      'Write',
      { file_path: '/ws/x.ts', content: 'one\nCHANGED\nthree\n' },
      source('/ws/x.ts', 'one\ntwo\nthree\n')
    )
    expect(patch?.op).toBe('rewrite')
    expect(patch?.adds).toBe(1)
    expect(patch?.dels).toBe(1)
  })

  it('does not invent a trailing blank line for content that ends in a newline', () => {
    const patch = buildToolPatch('Write', { file_path: '/ws/n.ts', content: 'only\n' }, none)
    expect(patch?.adds).toBe(1)
  })
})

describe('buildToolPatch — everything else', () => {
  it('reports nothing for a tool that changes no file', () => {
    expect(buildToolPatch('Bash', { command: 'ls' }, none)).toBeUndefined()
    expect(buildToolPatch('Read', { file_path: '/ws/x.ts' }, none)).toBeUndefined()
  })

  it('reports nothing for an editing tool whose input is missing or malformed', () => {
    expect(buildToolPatch('Edit', undefined, none)).toBeUndefined()
    expect(buildToolPatch('Write', { file_path: '/ws/x.ts' }, none)).toBeUndefined()
    expect(buildToolPatch('Edit', { old_string: 'a', new_string: 'b' }, none)).toBeUndefined()
  })

  it('shows a notebook cell as the source about to exist, without pretending to know the old one', () => {
    const patch = buildToolPatch(
      'NotebookEdit',
      { notebook_path: '/ws/n.ipynb', new_source: 'import pandas' },
      none
    )
    expect(patch?.anchored).toBe(false)
    expect(rendered(patch)).toEqual(['+import pandas'])
  })
})

describe('diffLines', () => {
  it('trims the common prefix and suffix so the alignment follows the change, not the brackets', () => {
    const before = ['{', 'a', 'b', 'c', '}']
    const after = ['{', 'a', 'B', 'c', '}']
    expect(diffLines(before, after).map((line) => `${line.type}:${line.text}`)).toEqual([
      'ctx:{',
      'ctx:a',
      'del:b',
      'add:B',
      'ctx:c',
      'ctx:}'
    ])
  })

  it('reads two identical files as no change at all', () => {
    expect(diffLines(['a', 'b'], ['a', 'b']).every((line) => line.type === 'ctx')).toBe(true)
  })

  it('handles an empty side without an off-by-one', () => {
    expect(diffLines([], ['x']).map((line) => line.type)).toEqual(['add'])
    expect(diffLines(['x'], []).map((line) => line.type)).toEqual(['del'])
  })
})

describe('toHunks', () => {
  const line = (type: 'add' | 'ctx', text: string) => ({ type, text, no: 1 }) as const

  it('keeps context around a change and splits when the untouched gap is wide', () => {
    const lines = [
      line('ctx', '1'),
      line('add', '2'),
      ...Array.from({ length: 20 }, (_, i) => line('ctx', `pad${i}`)),
      line('add', 'z')
    ]
    const hunks = toHunks(lines, 3)
    expect(hunks).toHaveLength(2)
    // Neither hunk drags the twenty untouched lines between them along.
    expect(hunks[0].lines.length).toBeLessThan(8)
    expect(hunks[1].lines.length).toBeLessThan(8)
  })

  it('joins two changes that are close enough that splitting would be noise', () => {
    const lines = [line('add', 'a'), line('ctx', 'x'), line('add', 'b')]
    expect(toHunks(lines, 3)).toHaveLength(1)
  })

  it('produces no hunks for a diff with nothing in it', () => {
    expect(toHunks([line('ctx', 'a')], 3)).toEqual([])
  })
})

describe('diffWords', () => {
  it('marks only the part of a rewritten line that actually moved', () => {
    const [before, after] = diffWords('const total = price * 2', 'const total = price * 3')
    expect(before?.filter((span) => span.changed).map((span) => span.text)).toEqual(['2'])
    expect(after?.filter((span) => span.changed).map((span) => span.text)).toEqual(['3'])
    // Unchanged runs are merged, not emitted one token at a time.
    expect(before?.filter((span) => !span.changed)).toHaveLength(1)
  })

  it('reassembles each side exactly, so nothing is lost or duplicated in the render', () => {
    const a = 'function run(a, b) { return a + b }'
    const b = 'function run(a, c) { return a - c }'
    const [before, after] = diffWords(a, b)
    expect(before?.map((span) => span.text).join('')).toBe(a)
    expect(after?.map((span) => span.text).join('')).toBe(b)
  })

  it('declines a line too long to be worth the table', () => {
    const long = Array.from({ length: 500 }, (_, i) => `t${i}`).join(' ')
    expect(diffWords(long, `${long} x`)).toEqual([null, null])
  })
})

describe('word marks in a built patch', () => {
  it('pairs a rewritten line with its replacement and marks the difference', () => {
    const patch = buildToolPatch(
      'Edit',
      {
        file_path: '/ws/x.ts',
        old_string: 'const total = price * 2',
        new_string: 'const total = price * 3'
      },
      source('/ws/x.ts', 'const total = price * 2')
    )
    const [removed, added] = patch!.hunks[0].lines
    expect(removed.spans?.filter((span) => span.changed).map((span) => span.text)).toEqual(['2'])
    expect(added.spans?.filter((span) => span.changed).map((span) => span.text)).toEqual(['3'])
  })

  it('leaves two unrelated lines unmarked rather than lighting up their shared punctuation', () => {
    const patch = buildToolPatch(
      'Edit',
      {
        file_path: '/ws/x.ts',
        old_string: 'import { readFileSync } from "fs"',
        new_string: 'export const MAX = 12'
      },
      source('/ws/x.ts', 'import { readFileSync } from "fs"')
    )
    for (const line of patch!.hunks[0].lines) expect(line.spans).toBeUndefined()
  })
})

describe('similarity', () => {
  it('scores an edited line high and an unrelated one low', () => {
    // 3 of 4 tokens survive the change: comfortably above the 0.34 mark
    // threshold, while an unrelated line sits at zero.
    expect(similarity('const a = 1', 'const a = 2')).toBe(0.75)
    expect(similarity('const a = 1', 'zzzzzzzzzzzzzzz')).toBe(0)
  })

  it('scores at the token grain, where two unrelated lines of code share nothing', () => {
    // Per character these overlap 39% — spaces and vowels — which is above any
    // threshold loose enough to catch a real rewrite. Per token they share none.
    expect(similarity('import { readFileSync } from "fs"', 'export const MAX = 12')).toBe(0)
  })

  it('ignores indentation, so a re-indented line still reads as the same line', () => {
    expect(similarity('  return x', '        return x')).toBe(1)
  })

  it('treats two empty lines as identical rather than dividing by zero', () => {
    expect(similarity('', '')).toBe(1)
  })
})

describe('transport cap', () => {
  it('caps a huge rewrite and says how many lines it dropped', () => {
    const before = Array.from({ length: 900 }, (_, i) => `old ${i}`).join('\n')
    const after = Array.from({ length: 900 }, (_, i) => `new ${i}`).join('\n')
    const patch = buildToolPatch(
      'Write',
      { file_path: '/ws/big.ts', content: after },
      source('/ws/big.ts', before)
    )
    const shown = patch!.hunks.reduce((total, hunk) => total + hunk.lines.length, 0)
    expect(shown).toBe(600)
    expect(patch?.truncated).toBe(1200)
    // The counts still describe the whole change, not the visible slice — the
    // header must not under-report because the body was cut.
    expect(patch?.adds).toBe(900)
    expect(patch?.dels).toBe(900)
  })

  it('reports a region too large to align as a straight replacement instead of stalling', () => {
    const before = Array.from({ length: 600 }, (_, i) => `a${i}`).join('\n')
    const after = Array.from({ length: 600 }, (_, i) => `b${i}`).join('\n')
    const started = Date.now()
    const patch = buildToolPatch(
      'Write',
      { file_path: '/ws/big.ts', content: after },
      source('/ws/big.ts', before)
    )
    expect(Date.now() - started).toBeLessThan(2000)
    expect(patch?.dels).toBe(600)
    expect(patch?.adds).toBe(600)
  })
})

/**
 * The paths that only open on inputs a normal edit never produces — a
 * malformed tool call, a diff whose two sides run out at different points, a
 * change too big for one hunk. Each of them renders *something* when it goes
 * wrong rather than throwing, which is exactly why they need a test: a
 * misaligned tail or a dropped token is a patch that quietly lies about the
 * file.
 */
describe('edges', () => {
  it('drains the old side when the new one runs out first', () => {
    // The LCS walk exits on `new`, leaving `b` to be reported by the tail.
    const patch = buildToolPatch(
      'Write',
      { file_path: '/ws/x.ts', content: 'a\n' },
      source('/ws/x.ts', 'x\na\nb\n')
    )
    expect(rendered(patch)).toEqual(['-x', ' a', '-b'])
  })

  it('drains the new side when the old one runs out first', () => {
    const patch = buildToolPatch(
      'Write',
      { file_path: '/ws/x.ts', content: 'b\nc\n' },
      source('/ws/x.ts', 'a\nb\n')
    )
    expect(rendered(patch)).toEqual(['-a', ' b', '+c'])
  })

  it('keeps every token when a word diff runs off either end of a line', () => {
    const [longerLeft] = diffWords('a b c', 'a b')
    expect(longerLeft?.map((span) => span.text).join('')).toBe('a b c')
    const [, longerRight] = diffWords('a b', 'a b c')
    expect(longerRight?.map((span) => span.text).join('')).toBe('a b c')
  })

  it('stops emitting hunks once the cap is spent instead of part-filling the rest', () => {
    // Two changes far enough apart to be two hunks, the first big enough to
    // exhaust the whole budget on its own.
    const before = [
      ...Array.from({ length: 700 }, (_, i) => `old ${i}`),
      ...Array.from({ length: 40 }, (_, i) => `pad ${i}`),
      'tail'
    ].join('\n')
    const after = [
      ...Array.from({ length: 700 }, (_, i) => `new ${i}`),
      ...Array.from({ length: 40 }, (_, i) => `pad ${i}`),
      'TAIL'
    ].join('\n')
    const patch = buildToolPatch(
      'Write',
      { file_path: '/ws/x.ts', content: after },
      source('/ws/x.ts', before)
    )
    expect(patch!.hunks).toHaveLength(1)
    expect(patch!.hunks[0].lines).toHaveLength(600)
    expect(patch?.truncated).toBeGreaterThan(0)
  })

  it('refuses an edit whose `old_string` is empty rather than splicing at position zero', () => {
    const patch = buildToolPatch(
      'Edit',
      { file_path: '/ws/x.ts', old_string: '', new_string: 'oops' },
      source('/ws/x.ts', 'a\n')
    )
    // Unanchored, not applied: an empty match would land the insert wherever
    // `indexOf` happened to return.
    expect(patch?.anchored).toBe(false)
    expect(rendered(patch)).toEqual(['+oops'])
  })

  it('shows the blank line a deletion leaves behind, because that is what the tool will do', () => {
    // `Edit` removes the *string*, not the line — so emptying `gone` leaves an
    // empty first line, and the patch says so. Rendering this as a clean
    // one-line removal would be prettier and wrong: the user would approve a
    // diff that does not match the file they end up with.
    const removal = buildToolPatch(
      'Edit',
      { file_path: '/ws/x.ts', old_string: 'gone', new_string: '' },
      source('/ws/x.ts', 'gone\nkeep\n')
    )
    expect(rendered(removal)).toEqual(['-gone', '+', ' keep'])
  })

  it('reports nothing when the tool names no path, or names one with no payload', () => {
    expect(buildToolPatch('Edit', { old_string: 'a' }, none)).toBeUndefined()
    expect(buildToolPatch('MultiEdit', { file_path: '/ws/x.ts' }, none)).toBeUndefined()
    expect(buildToolPatch('MultiEdit', { file_path: '/ws/x.ts', edits: [] }, none)).toBeUndefined()
    // An edit naming a file and nothing else describes no change at all.
    expect(buildToolPatch('Edit', { file_path: '/ws/x.ts' }, none)).toBeUndefined()
    expect(
      buildToolPatch('MultiEdit', { file_path: '/ws/x.ts', edits: [{}] }, none)
    ).toBeUndefined()
    expect(buildToolPatch('NotebookEdit', { notebook_path: '/ws/n.ipynb' }, none)).toBeUndefined()
    // A non-string where a string belongs is treated as absent, not coerced.
    expect(buildToolPatch('Write', { file_path: '/ws/x.ts', content: 42 }, none)).toBeUndefined()
  })

  it('reads two empty sides as no diff at all', () => {
    expect(diffLines([], [])).toEqual([])
  })

  it('clamps a hunk’s context to the ends of the patch', () => {
    const line = (type: 'add' | 'ctx', text: string) => ({ type, text, no: 1 }) as const
    // The change is the very first line: there is no context above it to keep.
    const hunks = toHunks([line('add', 'first'), line('ctx', 'a'), line('ctx', 'b')], 3)
    expect(hunks[0].lines[0].text).toBe('first')
    expect(hunks[0].lines).toHaveLength(3)
  })
})

describe('LCS alignment', () => {
  it('takes the insertion when advancing the new side preserves more of the file', () => {
    // The backtrack has to choose: report `b` as an insertion above `a`, or
    // report `a` as removed and re-added. Choosing wrong produces a patch that
    // claims the agent rewrote a line it never touched.
    const patch = buildToolPatch(
      'Write',
      { file_path: '/ws/x.ts', content: 'b\na\ny\n' },
      source('/ws/x.ts', 'a\nz\n')
    )
    expect(rendered(patch)).toEqual(['+b', ' a', '-z', '+y'])
  })
})

describe('defensive paths', () => {
  it('treats a half-specified edit as a one-sided change rather than throwing', () => {
    // `new_string` absent: the CLI would reject this, but the parser sits on a
    // wire and must not take the transcript down with it.
    const patch = buildToolPatch(
      'Edit',
      { file_path: '/ws/x.ts', old_string: 'a' },
      source('/ws/x.ts', 'a\nb\n')
    )
    expect(rendered(patch)).toEqual(['-a', '+', ' b'])

    // And the mirror: `old_string` absent, which can only be read as an
    // insertion of something that was not there.
    const inserted = buildToolPatch(
      'Edit',
      { file_path: '/ws/x.ts', new_string: 'added' },
      source('/ws/x.ts', 'a\n')
    )
    expect(rendered(inserted)).toEqual(['+added'])
  })

  it('word-diffs an empty line without tripping over the tokenizer returning nothing', () => {
    const [before, after] = diffWords('', 'x')
    expect(before).toEqual([])
    expect(after).toEqual([{ text: 'x', changed: true }])

    const [emptiedFrom, emptiedTo] = diffWords('x', '')
    expect(emptiedFrom).toEqual([{ text: 'x', changed: true }])
    expect(emptiedTo).toEqual([])
  })

  it('declines the word pass when either side alone is too long', () => {
    const long = Array.from({ length: 500 }, (_, i) => `t${i}`).join(' ')
    expect(diffWords('a', long)).toEqual([null, null])
  })

  it('stops mid-list once the cap is spent, rather than part-filling every later hunk', () => {
    const pad = Array.from({ length: 40 }, (_, i) => `pad ${i}`)
    const before = [...Array.from({ length: 350 }, (_, i) => `old ${i}`), ...pad, 'tail'].join('\n')
    const after = [...Array.from({ length: 350 }, (_, i) => `new ${i}`), ...pad, 'TAIL'].join('\n')
    const patch = buildToolPatch(
      'Write',
      { file_path: '/ws/x.ts', content: after },
      source('/ws/x.ts', before)
    )
    // Two real hunks, but the first one alone overruns the budget — the second
    // is dropped whole instead of appearing as a misleading stub.
    expect(patch!.hunks).toHaveLength(1)
    expect(patch!.hunks[0].lines).toHaveLength(600)
    expect(patch?.truncated).toBeGreaterThan(0)
  })
})
