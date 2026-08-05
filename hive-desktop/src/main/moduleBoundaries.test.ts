import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { dirname, join, relative, resolve, sep } from 'path'
import ts from 'typescript'

/**
 * Guard against cross-process imports between `src/main`, `src/preload` and
 * `src/renderer` (AGENTS.md "Desacople o agente" / "Fronteiras").
 *
 * Electron runs these three as *separate processes with separate bundles*, so
 * an import across them is not a style preference — it drags Node-only code
 * into the browser bundle (or vice versa) and fails at runtime, not at build.
 * The type checker can't see it: `import type` erases, and a value import
 * resolves fine on disk.
 *
 * Lives in `src/main/` because main owns the process-boundary contract (the
 * IPC handlers and `agentAdapter`), but it scans all three zones. Same shape as
 * `i18n/noInlineStrings.test.ts`: a pure exported analyzer, unit tests for the
 * analyzer itself, then one scan over the real tree.
 *
 * Two deliberate exceptions, both type-only (erased — no bundle impact):
 *   - `preload -> main` is *the* contract. `src/preload/index.ts` types the
 *     `window.hive` bridge from main's service types; that's the intended
 *     direction of knowledge.
 *   - a `*.test.ts` may `import type` across zones, since tests all run in one
 *     Node process and several already do (e.g. `onboarding/*.test.ts` pulling
 *     `BmadEvent`).
 * Value imports are a violation everywhere, with no exception.
 */

type Zone = 'main' | 'preload' | 'renderer'

interface BoundaryViolation {
  line: number
  message: string
}

const ZONE_DIRS: Record<Zone, string> = {
  main: `src${sep}main`,
  preload: `src${sep}preload`,
  renderer: `src${sep}renderer`
}

/** Which process a path belongs to, or `undefined` if it's outside the three. */
export function zoneOf(pathFromRepoRoot: string): Zone | undefined {
  const normalized = pathFromRepoRoot.split(/[\\/]/).join(sep)
  return (Object.keys(ZONE_DIRS) as Zone[]).find((zone) =>
    normalized.startsWith(`${ZONE_DIRS[zone]}${sep}`)
  )
}

function isAllowed(from: Zone, to: Zone, typeOnly: boolean, isTest: boolean): boolean {
  if (from === to) return true
  if (!typeOnly) return false
  return (from === 'preload' && to === 'main') || isTest
}

function correction(from: Zone, to: Zone, typeOnly: boolean): string {
  if (!typeOnly) {
    return (
      `value import — ${from} and ${to} are separate Electron processes with ` +
      `separate bundles. Move the shared code behind the IPC bridge ` +
      `(handler in src/main/index.ts + method in src/preload/index.ts), or ` +
      `extract the pure part into a module the importing zone owns.`
    )
  }
  if (from === 'renderer') {
    return (
      `type import — the renderer derives its types from the bridge, not from ` +
      `main. Use the window.hive surface, e.g. ` +
      `Awaited<ReturnType<Window['hive']['git']['status']>> (the Chat.tsx mirror ` +
      `convention). Add "i18n"-style local types only if the bridge can't express it.`
    )
  }
  return `type import — only preload may type-import from main, and only in non-test code.`
}

/**
 * Scans one source file and returns every import that crosses a process
 * boundary without an exception covering it. `filePath` is relative to the
 * package root (e.g. `src/renderer/src/chat/Chat.tsx`).
 */
export function findBoundaryViolations(sourceText: string, filePath: string): BoundaryViolation[] {
  const from = zoneOf(filePath)
  if (!from) return []

  const isTest = /\.test\.tsx?$/.test(filePath)
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const violations: BoundaryViolation[] = []

  function check(node: ts.Node, specifier: string, typeOnly: boolean): void {
    if (!specifier.startsWith('.')) return
    // Purely lexical resolution against a synthetic root, so the analyzer is
    // independent of the process's cwd (the scan below passes package-relative
    // paths; the unit tests pass literals).
    const target = relative(sep, resolve(sep, dirname(filePath), specifier))
    const to = zoneOf(target)
    if (!to || isAllowed(from!, to, typeOnly, isTest)) return
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    violations.push({
      line: line + 1,
      message: `${from} imports ${to} ('${specifier}'): ${correction(from!, to, typeOnly)}`
    })
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      const named = clause?.namedBindings
      const typeOnly =
        clause?.isTypeOnly === true ||
        (named !== undefined &&
          ts.isNamedImports(named) &&
          named.elements.length > 0 &&
          named.elements.every((element) => element.isTypeOnly))
      check(node, node.moduleSpecifier.text, typeOnly === true)
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      check(node, node.moduleSpecifier.text, node.isTypeOnly)
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      // dynamic import() is always a value import — it pulls the module in at runtime
      check(node, node.arguments[0].text, false)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath))
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) {
      files.push(fullPath)
    }
  }
  return files
}

describe('process boundaries between main, preload and renderer', () => {
  it('flags a value import from renderer into main', () => {
    const violations = findBoundaryViolations(
      `import { gitStatus } from '../../../main/gitService'`,
      'src/renderer/src/scm/useGit.ts'
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('separate Electron processes')
  })

  it('flags a type import from renderer into main in non-test code', () => {
    const violations = findBoundaryViolations(
      `import type { BmadEvent } from '../../../main/bmadService'`,
      'src/renderer/src/onboarding/GuidedInstall.tsx'
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('derives its types from the bridge')
  })

  it('allows the same type import from a test file', () => {
    const violations = findBoundaryViolations(
      `import type { BmadEvent } from '../../../main/bmadService'`,
      'src/renderer/src/onboarding/GuidedInstall.test.ts'
    )
    expect(violations).toEqual([])
  })

  it('allows preload to type-import from main (the bridge contract)', () => {
    const violations = findBoundaryViolations(
      `import type { OpenResult } from '../main/workspaceService'`,
      'src/preload/index.ts'
    )
    expect(violations).toEqual([])
  })

  it('flags preload taking a value import from main', () => {
    const violations = findBoundaryViolations(
      `import { openWorkspace } from '../main/workspaceService'`,
      'src/preload/index.ts'
    )
    expect(violations).toHaveLength(1)
  })

  it('flags a dynamic import across the boundary even when the module is a type source', () => {
    const violations = findBoundaryViolations(
      `const mod = await import('../../../main/gitService')`,
      'src/renderer/src/scm/useGit.ts'
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('value import')
  })

  it('ignores package imports and same-zone relative imports', () => {
    const violations = findBoundaryViolations(
      `import { useState } from 'react'
       import { toSplitRows } from './gitStatus'
       import { AgentClaudeIcon } from '../ui/icons'`,
      'src/renderer/src/scm/DiffView.tsx'
    )
    expect(violations).toEqual([])
  })

  it('src/**/*.{ts,tsx} has no cross-process imports', () => {
    const packageRoot = resolve(__dirname, '..', '..')
    const files = collectSourceFiles(join(packageRoot, 'src'))
    expect(files.length).toBeGreaterThan(0)

    const allViolations = files.flatMap((absolutePath) => {
      const filePath = relative(packageRoot, absolutePath)
      return findBoundaryViolations(readFileSync(absolutePath, 'utf-8'), filePath).map(
        (v) => `${filePath}:${v.line} — ${v.message}`
      )
    })

    expect(allViolations).toEqual([])
  })
})
