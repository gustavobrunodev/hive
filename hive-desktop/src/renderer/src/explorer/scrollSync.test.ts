// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  MEASURE_CEILING,
  collectAnchors,
  lineAtOffset,
  lineAtTop,
  measureLineTops,
  offsetOfLine,
  offsetOfLineStart,
  topForLine,
  type LineAnchor
} from './scrollSync'

/** Six lines, the fourth of which wrapped to two rows — 20px per row. */
const TOPS = [0, 20, 40, 60, 100, 120]

describe('lineAtOffset', () => {
  it('names the line whose row the offset is inside, not the next one', () => {
    expect(lineAtOffset(TOPS, 0)).toBe(1)
    expect(lineAtOffset(TOPS, 19)).toBe(1)
    expect(lineAtOffset(TOPS, 20)).toBe(2)
    // The wrapped line owns both of its rows.
    expect(lineAtOffset(TOPS, 80)).toBe(4)
    expect(lineAtOffset(TOPS, 99)).toBe(4)
    expect(lineAtOffset(TOPS, 100)).toBe(5)
  })

  it('clamps past the end instead of running off it', () => {
    expect(lineAtOffset(TOPS, 99_999)).toBe(6)
    expect(lineAtOffset([], 40)).toBe(1)
  })
})

describe('offsetOfLine', () => {
  it('round-trips with lineAtOffset', () => {
    for (let line = 1; line <= TOPS.length; line++) {
      expect(lineAtOffset(TOPS, offsetOfLine(TOPS, line))).toBe(line)
    }
  })

  it('clamps a line the file does not have', () => {
    expect(offsetOfLine(TOPS, 0)).toBe(0)
    expect(offsetOfLine(TOPS, 999)).toBe(120)
  })
})

describe('collectAnchors', () => {
  it('reads every stamped block and orders it by source line', () => {
    const scroller = document.createElement('div')
    scroller.innerHTML =
      '<p data-line="9">c</p><h1 data-line="1">a</h1><p>sem marca</p><li data-line="4">b</li>'
    document.body.appendChild(scroller)
    expect(collectAnchors(scroller).map((anchor) => anchor.line)).toEqual([1, 4, 9])
    scroller.remove()
  })
})

const ANCHORS: LineAnchor[] = [
  { line: 1, top: 0, height: 40 },
  { line: 5, top: 40, height: 200 },
  { line: 9, top: 240, height: 40 }
]

describe('topForLine', () => {
  it('puts a block that starts a line at the top of the view', () => {
    expect(topForLine(ANCHORS, 5)).toBe(40)
    expect(topForLine(ANCHORS, 9)).toBe(240)
  })

  /**
   * The reason for interpolating rather than snapping: lines 5–8 are one long
   * paragraph, and a reader halfway down it must not be thrown back to its
   * first line.
   */
  it('interpolates through a block that spans several source lines', () => {
    expect(topForLine(ANCHORS, 7)).toBe(140)
  })

  it('has nothing to say about a document with no blocks', () => {
    expect(topForLine([], 3)).toBeNull()
  })
})

describe('lineAtTop', () => {
  it('is the inverse of topForLine on the anchors themselves', () => {
    expect(lineAtTop(ANCHORS, 40)).toBe(5)
    expect(lineAtTop(ANCHORS, 240)).toBe(9)
  })

  it('interpolates inside a tall block', () => {
    expect(lineAtTop(ANCHORS, 140)).toBe(7)
  })

  it('answers the top of the document before the first block', () => {
    expect(lineAtTop(ANCHORS, 0)).toBe(1)
    expect(lineAtTop([], 0)).toBeNull()
  })
})

describe('measureLineTops', () => {
  /**
   * jsdom lays nothing out, so the *values* here are all zero and worth
   * nothing. What this holds is the contract around them: one entry per source
   * line, a refusal above the ceiling, and — the part a leak would make
   * permanent — that the hidden probe it builds is taken back out of the
   * document every time.
   */
  const field = (padding = ''): HTMLTextAreaElement => {
    const node = document.createElement('textarea')
    node.style.padding = padding
    document.body.appendChild(node)
    return node
  }

  it('returns one offset per source line', () => {
    const tops = measureLineTops(field(), 'um\ndois\ntrês\n')
    expect(tops).toHaveLength(4)
    expect(tops?.every((top) => Number.isFinite(top))).toBe(true)
  })

  it('leaves nothing behind in the document', () => {
    const before = document.body.childElementCount
    measureLineTops(field(), 'a\nb')
    expect(document.body.childElementCount).toBe(before + 1)
  })

  it('refuses a file too big to measure between two frames', () => {
    expect(measureLineTops(field(), 'x\n'.repeat(MEASURE_CEILING + 1))).toBeNull()
  })

  /**
   * The field\u2019s own padding is part of every offset — the top padding sits
   * above line 1, and the horizontal padding is the difference between the
   * width the text wraps in and the width of the box. A field that declares
   * none (jsdom's default, and the case above) takes the zero fallback; this
   * is the other side of it.
   */
  it('reads the field\u2019s padding rather than assuming there is none', () => {
    const tops = measureLineTops(field('10px 12px'), 'um\ndois')
    expect(tops).toHaveLength(2)
    expect(tops?.[0]).toBe(10)
  })
})

describe('the empty document', () => {
  it('answers for a preview that rendered nothing at all', () => {
    expect(offsetOfLine([], 3)).toBe(0)
    expect(topForLine([], 3)).toBeNull()
    expect(lineAtTop([], 0)).toBeNull()
  })

  it('ignores a rendered block whose data-line is not a number', () => {
    const scroller = document.createElement('div')
    scroller.innerHTML = '<p data-line="nada">x</p><p data-line="2">y</p>'
    document.body.appendChild(scroller)
    expect(collectAnchors(scroller).map((anchor) => anchor.line)).toEqual([2])
  })

  it('clamps to the first anchor when the target is above all of them', () => {
    const anchors: LineAnchor[] = [
      { line: 5, top: 100, height: 20 },
      { line: 9, top: 140, height: 20 }
    ]
    expect(topForLine(anchors, 1)).toBe(100)
    expect(lineAtTop(anchors, 0)).toBe(5)
  })
})

describe('offsetOfLineStart', () => {
  const SOURCE = 'um\ndois\ntrês'

  it('finds the character each line starts at', () => {
    expect(offsetOfLineStart(SOURCE, 1)).toBe(0)
    expect(offsetOfLineStart(SOURCE, 2)).toBe(3)
    expect(offsetOfLineStart(SOURCE, 3)).toBe(8)
  })

  it('lands at the end rather than past it', () => {
    expect(offsetOfLineStart(SOURCE, 99)).toBe(SOURCE.length)
    expect(offsetOfLineStart('', 1)).toBe(0)
  })
})
