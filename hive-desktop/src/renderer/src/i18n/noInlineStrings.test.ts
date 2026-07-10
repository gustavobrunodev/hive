import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import ts from 'typescript'

/**
 * Guard against inline UI string literals in `src/renderer/src` components
 * (design.md §4.1, R1.6, task T3b). All UI chrome copy must be sourced via
 * `t()` from `./index` — never as a raw JSX text child or a literal on a
 * text-bearing JSX attribute (title, placeholder, aria-label, ...).
 *
 * A deliberate, non-UI-copy exception (e.g. a technical attribute value) can
 * be silenced with an `i18n-exempt` comment on the same source line:
 *   - attribute:      <input placeholder="ok" /* i18n-exempt *\/ />
 *   - JSX text child:  <p>{/* i18n-exempt *\/}debug-only literal</p>
 *
 * This file is exempt from its own scan (it lives in `i18n/`), so the
 * fixtures above are inert examples used only inside string literals below,
 * never as real JSX in this file.
 */

const TEXT_BEARING_ATTRIBUTES = new Set([
  'placeholder',
  'title',
  'alt',
  'aria-label',
  'aria-valuetext',
  'aria-description',
  'label'
])

const EXEMPT_MARKER = 'i18n-exempt'

interface Violation {
  line: number
  message: string
}

function lineTextAt(sourceFile: ts.SourceFile, pos: number): string {
  const { line } = sourceFile.getLineAndCharacterOfPosition(pos)
  const starts = sourceFile.getLineStarts()
  const start = starts[line]
  const end = line + 1 < starts.length ? starts[line + 1] : sourceFile.text.length
  return sourceFile.text.slice(start, end)
}

function isExempt(sourceFile: ts.SourceFile, pos: number): boolean {
  return lineTextAt(sourceFile, pos).includes(EXEMPT_MARKER)
}

/**
 * Scans TSX source and returns every raw UI-copy string literal found:
 * non-whitespace JSX text children, string literals wrapped in `{}` in
 * children position, and string literals on known text-bearing attributes.
 */
export function findInlineStringViolations(sourceText: string, fileName = 'file.tsx'): Violation[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const violations: Violation[] = []

  function report(node: ts.Node, message: string): void {
    const pos = node.getStart(sourceFile)
    if (isExempt(sourceFile, pos)) return
    const { line } = sourceFile.getLineAndCharacterOfPosition(pos)
    violations.push({ line: line + 1, message })
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile).trim()
      if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(text)) {
        report(node, `inline JSX text "${text}"`)
      }
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      ts.isStringLiteral(node.expression) &&
      node.parent &&
      !ts.isJsxAttribute(node.parent)
    ) {
      report(node, `inline string literal "${node.expression.text}" in JSX children`)
    } else if (
      ts.isJsxAttribute(node) &&
      TEXT_BEARING_ATTRIBUTES.has(node.name.getText(sourceFile))
    ) {
      const init = node.initializer
      const literal =
        init && ts.isStringLiteral(init)
          ? init
          : init &&
              ts.isJsxExpression(init) &&
              init.expression &&
              ts.isStringLiteral(init.expression)
            ? init.expression
            : undefined
      if (literal) {
        report(
          node,
          `inline literal "${literal.text}" on "${node.name.getText(sourceFile)}" attribute`
        )
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

/**
 * Pre-existing electron-vite scaffold file(s), confirmed unused (not
 * imported by App.tsx or main.tsx, not part of any built screen) and outside
 * T3b's touch scope (`i18n/**` + `App.tsx` only — see task constraints).
 * Left out of the guard's remit deliberately rather than silently retrofitted
 * or deleted; a follow-up task should either i18n-ify or remove it.
 */
const OUT_OF_SCOPE_FILES = new Set(['components/Versions.tsx'])

function collectTsxFiles(dir: string, baseDir = dir): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'i18n') continue
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectTsxFiles(fullPath, baseDir))
    } else if (entry.endsWith('.tsx') && !OUT_OF_SCOPE_FILES.has(relative(baseDir, fullPath))) {
      files.push(fullPath)
    }
  }
  return files
}

describe('no inline UI string literals outside i18n/ (T3b guard)', () => {
  it('flags a component with an inline JSX text literal', () => {
    const violations = findInlineStringViolations(`
      function Bad(): React.JSX.Element {
        return <p>Hello world</p>
      }
    `)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('flags a component with an inline text-bearing attribute literal', () => {
    const violations = findInlineStringViolations(`
      function Bad(): React.JSX.Element {
        return <button title="Close">X</button>
      }
    `)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('flags a string literal wrapped in braces in JSX children', () => {
    const violations = findInlineStringViolations(`
      function Bad(): React.JSX.Element {
        return <p>{'Hello world'}</p>
      }
    `)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('does not flag copy sourced via t(), technical attributes, or an explicitly exempted literal', () => {
    const violations = findInlineStringViolations(`
      function Ok(): React.JSX.Element {
        return (
          <div className="panel" data-testid="close-button" id="ok">
            {t('app.title')}
            <input placeholder="ok" /* i18n-exempt: internal debug field */ />
            <p>{/* i18n-exempt: internal debug marker */}debug-only</p>
          </div>
        )
      }
    `)
    expect(violations).toEqual([])
  })

  it('src/renderer/src/**/*.tsx (excluding i18n/) has no inline UI string literals', () => {
    const rendererSrcDir = join(__dirname, '..')
    const tsxFiles = collectTsxFiles(rendererSrcDir)
    expect(tsxFiles.length).toBeGreaterThan(0)

    const allViolations = tsxFiles.flatMap((filePath) => {
      const relativePath = relative(rendererSrcDir, filePath)
      const source = readFileSync(filePath, 'utf-8')
      return findInlineStringViolations(source, filePath).map(
        (v) => `${relativePath}:${v.line} — ${v.message}`
      )
    })

    expect(allViolations).toEqual([])
  })
})
