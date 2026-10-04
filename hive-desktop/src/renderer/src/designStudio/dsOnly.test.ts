import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

/**
 * Criterion 8 — the module uses only `@hive/design-system` tokens.
 *
 * The validation prototype painted with its own orange and its own fonts; the
 * module is that prototype rebuilt on the Hive's values. A colour or a font
 * family written out literally anywhere under this directory is a value the
 * theme cannot reach, so it is the defect this scan exists to catch before a
 * person does — in one theme out of two, as every earlier contrast defect here
 * was found.
 *
 * The rule is the one in the check: no hex colour, no rgb / hsl / oklch colour
 * function, and no `font-family` that is not a `var(--ff-*)`. It reads every
 * `.css`, `.ts` and `.tsx` file in the directory, this one included — which is
 * why the patterns below are spelled so that they never match themselves.
 */

const ROOT = join(__dirname)

const COLOR_PATTERNS: Array<[string, RegExp]> = [
  ['hex colour', /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/i],
  ['rgb colour function', /\brgba?\(/i],
  ['hsl colour function', /\bhsla?\(/i],
  ['oklch colour function', /\boklch\(/i]
]

/** A `font-family` (CSS) or `fontFamily` (inline style) whose value is not a `--ff-*` token. */
const FONT_PATTERNS: Array<[string, RegExp]> = [
  // The whitespace sits INSIDE each lookahead: outside it, `\s*` backtracks to
  // zero and the lookahead is tested against " var(…", which it never matches.
  ['font-family', /font-family\s*:(?!\s*var\(--ff-[a-z-]+\)\s*[;}])/i],
  ['fontFamily', /fontFamily\s*:(?!\s*['"`]var\(--ff-[a-z-]+\)['"`])/],
  // The shorthand can name a family too; the only value the module needs from
  // it is `inherit` (a button taking its row's type, as the Hive's own do).
  ['font shorthand', /(^|[\s;{])font\s*:(?!\s*inherit\s*[;}])/]
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(css|ts|tsx)$/.test(entry) ? [path] : []
  })
}

function violations(text: string): string[] {
  const found: string[] = []
  text.split('\n').forEach((line, index) => {
    for (const [kind, pattern] of [...COLOR_PATTERNS, ...FONT_PATTERNS]) {
      if (pattern.test(line)) found.push(`${index + 1}: ${kind} — ${line.trim()}`)
    }
  })
  return found
}

describe('Design Studio uses only design-system values', () => {
  it('flags each kind of literal the rule forbids, and lets tokens through', () => {
    // The scanner itself, on fixtures — a guard that matched nothing would pass
    // over a directory full of literals.
    const hash = String.fromCharCode(35)
    expect(violations(`color: ${hash}ec7000;`)).toHaveLength(1)
    expect(violations(`background: ${hash}fff;`)).toHaveLength(1)
    expect(violations(['border-color: rgb', '(255, 122, 26);'].join(''))).toHaveLength(1)
    expect(violations(['fill: hsl', '(30 100% 50%);'].join(''))).toHaveLength(1)
    expect(violations(['stroke: oklch', '(0.7 0.2 50);'].join(''))).toHaveLength(1)
    expect(violations(['font-family', ': "Geist", sans-serif;'].join(''))).toHaveLength(1)
    expect(violations(['font', 'Family: "Bricolage Grotesque"'].join(''))).toHaveLength(1)
    expect(violations(['  font', ': 600 1rem "Geist";'].join(''))).toHaveLength(1)
    expect(violations(['  font', ': inherit;'].join(''))).toEqual([])

    expect(violations('color: var(--ink);')).toEqual([])
    expect(violations(['font-family', ': var(--ff-body);'].join(''))).toEqual([])
    expect(violations(['font', "Family: 'var(--ff-display)'"].join(''))).toEqual([])
  })

  it('C8a: no file under designStudio/ declares a literal colour or a non-token font family', () => {
    const files = sourceFiles(ROOT)
    // Non-vacuous: the module's stylesheet and at least one component are here.
    expect(files.some((file) => file.endsWith('.css'))).toBe(true)
    expect(files.some((file) => file.endsWith('.tsx'))).toBe(true)

    const report = files.flatMap((file) =>
      violations(readFileSync(file, 'utf-8')).map((line) => `${relative(ROOT, file)}:${line}`)
    )
    expect(report, report.join('\n')).toEqual([])
  })
})
