import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
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

/**
 * design-studio / AD-2: `screenDocument.ts` is the single mutation of a
 * `ScreenDocument`. Every other surface — Inspector, Tree, Chat, the preview
 * receiver, the exporter — changes a screen by dispatching a `Command`.
 *
 * That rule is not enforceable by the type system (the model is plain mutable
 * objects, and making it `readonly` would only push the cast one line down),
 * and it is exactly the rule a hurried edit breaks: writing `node.props.variant`
 * directly is one line, works on screen, and silently defeats undo — the log
 * no longer describes the document, so replay-from-origin rebuilds a different
 * screen than the one the user is looking at. This analyzer is the sensor.
 *
 * It flags writes through the document's own fields (`.props`, `.children`,
 * `.root`, `.tag`, `.slot`): direct assignment, indexed assignment, `delete`,
 * and the mutating array methods on `.children`.
 */
const DOCUMENT_FIELDS = new Set(['props', 'children', 'root', 'tag', 'slot'])

const MUTATING_ARRAY_METHODS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin'
])

const DISPATCH_INSTEAD =
  'mutates the screen document outside the reducer (AD-2). Dispatch a Command ' +
  'through applyCommand() in designStudio/screenDocument.ts instead — a direct ' +
  'write never reaches the log, so undo replays a different screen than the one ' +
  'on stage.'

/** `x.props` / `x.children` / … — the document field a write is going through, if any. */
function documentFieldOf(node: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(node) && DOCUMENT_FIELDS.has(node.name.text)) {
    return node.name.text
  }
  return undefined
}

/** The document field an assignment/delete target writes into, if any. */
function writtenField(target: ts.Expression): string | undefined {
  // `node.props = {}` / `node.children = []`
  const direct = documentFieldOf(target)
  if (direct) return direct
  // `node.props['variant'] = 'brand'` / `node.children[0] = child`
  if (ts.isElementAccessExpression(target)) return documentFieldOf(target.expression)
  // `node.props.variant = 'brand'`
  if (ts.isPropertyAccessExpression(target)) return documentFieldOf(target.expression)
  return undefined
}

export function findDocumentMutations(sourceText: string, filePath: string): BoundaryViolation[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const violations: BoundaryViolation[] = []

  function report(node: ts.Node, what: string): void {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    violations.push({ line: line + 1, message: `${what} ${DISPATCH_INSTEAD}` })
  }

  function visit(node: ts.Node): void {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const field = writtenField(node.left)
      if (field) report(node, `assignment through '.${field}'`)
    } else if (ts.isDeleteExpression(node)) {
      const field = writtenField(node.expression)
      if (field) report(node, `delete through '.${field}'`)
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      MUTATING_ARRAY_METHODS.has(node.expression.name.text)
    ) {
      const field = documentFieldOf(node.expression.expression)
      if (field) report(node, `'${node.expression.name.text}()' on '.${field}'`)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

/**
 * design-studio T2.7 / AD-4. Only `designStudio/dsAdapter/` may know which
 * design system is installed.
 *
 * This is the rule the whole module's long-term value rests on: DS-R12 promises
 * that swapping the DS is configuration, not a rewrite, and that promise is only
 * worth anything while `@awesome.me/webawesome` appears in exactly one folder.
 * An import from the Inspector or the exporter is one line, works immediately,
 * and quietly converts "change a config value" into "audit the codebase" — with
 * nothing failing until someone actually tries the swap.
 *
 * Deliberately blunt: the specifier is the package, in any form (subpath,
 * type-only, dynamic), from any file outside `dsAdapter/`.
 */
const DS_PACKAGES = ['@awesome.me/webawesome', '@fortawesome/fontawesome-free']

const DS_ADAPTER_DIR = `designStudio${sep}dsAdapter${sep}`

function isDesignSystemPackage(specifier: string): boolean {
  return DS_PACKAGES.some((name) => specifier === name || specifier.startsWith(`${name}/`))
}

export function findDesignSystemImports(sourceText: string, filePath: string): BoundaryViolation[] {
  const normalized = filePath.split(/[\\/]/).join(sep)
  if (normalized.includes(DS_ADAPTER_DIR)) return []

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const violations: BoundaryViolation[] = []

  function check(node: ts.Node, specifier: string): void {
    if (!isDesignSystemPackage(specifier)) return
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    violations.push({
      line: line + 1,
      message:
        `imports the design system package ('${specifier}') outside ` +
        `designStudio/dsAdapter/ (AD-4). Ask the DesignSystemAdapter port instead — ` +
        `catalog() for what exists, validate() for what is allowed. A direct import ` +
        `is what turns "swap the DS in config" (DS-R12) back into a rewrite.`
    })
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      check(node, node.moduleSpecifier.text)
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      check(node, node.moduleSpecifier.text)
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      check(node, node.arguments[0].text)
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

  // voice-prompt / VP-R5.1. Reusability decided after the fact is a refactor;
  // decided up front it is free — and this is the sensor that keeps it free.
  // `useDictation` takes a `DictationTarget` precisely so the chat composer is
  // one caller rather than the owner, so an import of `chat/` from inside
  // `dictation/` is the exact regression that would make wiring the next field
  // ("Perguntar à base", a commit message, search) a rewrite instead of a
  // wiring change. The cross-process rules above already cover `src/main`.
  it('src/renderer/src/dictation/** does not import from chat/', () => {
    const dictationDir = resolve(__dirname, '..', 'renderer', 'src', 'dictation')
    const files = collectSourceFiles(dictationDir)
    expect(files.length).toBeGreaterThan(0)

    const offenders = files.flatMap((absolutePath) => {
      const source = readFileSync(absolutePath, 'utf-8')
      const matches = [...source.matchAll(/from\s+'([^']*\/chat\/[^']*)'/g)]
      return matches.map((match) => `${relative(dictationDir, absolutePath)} → ${match[1]}`)
    })

    expect(offenders).toEqual([])
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

/**
 * design-studio T1.7 / AD-2. `screenDocument.ts` owns the only mutation of a
 * `ScreenDocument`; every other file in the module goes through a `Command`.
 */
describe('the screen document is only mutated by its reducer', () => {
  it('flags a direct assignment to .props', () => {
    const violations = findDocumentMutations(
      `node.props = { variant: 'brand' }`,
      'src/renderer/src/designStudio/Inspector.tsx'
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain("assignment through '.props'")
    expect(violations[0].message).toContain('applyCommand()')
  })

  it('flags a keyed write into .props', () => {
    expect(
      findDocumentMutations(
        `selected.props['variant'] = value`,
        'src/renderer/src/designStudio/Inspector.tsx'
      )
    ).toHaveLength(1)
    expect(
      findDocumentMutations(
        `selected.props.variant = value`,
        'src/renderer/src/designStudio/Inspector.tsx'
      )
    ).toHaveLength(1)
  })

  it('flags a compound assignment as well as a plain one', () => {
    expect(
      findDocumentMutations(`doc.root.tag += '-x'`, 'src/main/designStudio/exportBundle.ts')
    ).toHaveLength(1)
  })

  it('flags delete on a document field', () => {
    const violations = findDocumentMutations(
      `delete node.props['variant']`,
      'src/renderer/src/designStudio/Inspector.tsx'
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain("delete through '.props'")
  })

  it('flags a mutating array method on .children', () => {
    const violations = findDocumentMutations(
      `parent.children.push(created)`,
      'src/renderer/src/designStudio/ComponentTree.tsx'
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain("'push()' on '.children'")
    expect(
      findDocumentMutations(
        `parent.children.splice(index, 1)`,
        'src/renderer/src/designStudio/ComponentTree.tsx'
      )
    ).toHaveLength(1)
  })

  it('flags a write to .root and a reparent through .slot', () => {
    expect(
      findDocumentMutations(`doc.root = null`, 'src/main/designStudio/designStudioService.ts')
    ).toHaveLength(1)
    expect(
      findDocumentMutations(
        `node.slot = 'footer'`,
        'src/renderer/src/designStudio/ComponentTree.tsx'
      )
    ).toHaveLength(1)
  })

  it('leaves reads, rebuilds and non-mutating array methods alone', () => {
    const violations = findDocumentMutations(
      `const next = { ...node, props: { ...node.props, variant: 'brand' } }
       const ids = node.children.map((child) => child.id)
       const kept = node.children.filter((child) => child.id !== id)
       const tag = node.tag
       dispatch({ type: 'SetProp', componentId: node.id, key: 'variant', value: 'brand' })`,
      'src/renderer/src/designStudio/Inspector.tsx'
    )
    expect(violations).toEqual([])
  })

  it('leaves same-named fields on unrelated objects that are not document writes alone', () => {
    const violations = findDocumentMutations(
      `const label = catalog.components[0].tag
       count += 1`,
      'src/renderer/src/designStudio/ScreenList.tsx'
    )
    expect(violations).toEqual([])
  })

  it('no design-studio file outside screenDocument.ts mutates the document', () => {
    const packageRoot = resolve(__dirname, '..', '..')
    const roots = [
      join(packageRoot, 'src', 'main', 'designStudio'),
      join(packageRoot, 'src', 'renderer', 'src', 'designStudio'),
      join(packageRoot, 'src', 'preview')
    ].filter((dir) => existsSync(dir))
    // Phase 1 only ships the main-side module; the renderer surfaces and the
    // in-frame receiver join this scan as they land.
    expect(roots.length).toBeGreaterThan(0)

    const files = roots
      .flatMap((dir) => collectSourceFiles(dir))
      // The reducer is the one place a document write belongs (AD-2).
      .filter((file) => !file.endsWith(`${sep}screenDocument.ts`))
    expect(files.length).toBeGreaterThan(0)

    const allViolations = files.flatMap((absolutePath) => {
      const filePath = relative(packageRoot, absolutePath)
      return findDocumentMutations(readFileSync(absolutePath, 'utf-8'), filePath).map(
        (v) => `${filePath}:${v.line} — ${v.message}`
      )
    })

    expect(allViolations).toEqual([])
  })
})

/**
 * design-studio T2.7 / AD-4. `dsAdapter/` is the only folder that may name the
 * design system package.
 */
describe('only dsAdapter/ knows which design system is installed', () => {
  it('flags a value import of the DS package from a renderer surface', () => {
    const violations = findDesignSystemImports(
      `import '@awesome.me/webawesome/dist/components/button/button.js'`,
      'src/renderer/src/designStudio/Inspector.tsx'
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('DesignSystemAdapter port')
  })

  it('flags a type-only import and a dynamic one just as hard', () => {
    expect(
      findDesignSystemImports(
        `import type { WaButton } from '@awesome.me/webawesome'`,
        'src/main/designStudio/exportBundle.ts'
      )
    ).toHaveLength(1)
    expect(
      findDesignSystemImports(
        `const wa = await import('@awesome.me/webawesome')`,
        'src/main/designStudio/exportBundle.ts'
      )
    ).toHaveLength(1)
    expect(
      findDesignSystemImports(
        `export { registerIconLibrary } from '@awesome.me/webawesome'`,
        'src/preview/receiver.ts'
      )
    ).toHaveLength(1)
  })

  it('flags the icon package too — it is the same coupling by another name', () => {
    expect(
      findDesignSystemImports(
        `import '@fortawesome/fontawesome-free/css/all.css'`,
        'src/renderer/src/designStudio/StagePane.tsx'
      )
    ).toHaveLength(1)
  })

  it('allows it inside dsAdapter/, including that folder’s tests', () => {
    expect(
      findDesignSystemImports(
        `import { registerIconLibrary } from '@awesome.me/webawesome'`,
        'src/main/designStudio/dsAdapter/webAwesomeAdapter.ts'
      )
    ).toEqual([])
    expect(
      findDesignSystemImports(
        `import '@awesome.me/webawesome'`,
        'src/main/designStudio/dsAdapter/webAwesomeAdapter.test.ts'
      )
    ).toEqual([])
  })

  it('leaves other packages and a similarly named one alone', () => {
    expect(
      findDesignSystemImports(
        `import { Button } from '@hive/design-system'
         import x from '@awesome.me/webawesome-extras'`,
        'src/renderer/src/designStudio/Inspector.tsx'
      )
    ).toEqual([])
  })

  it('no file outside dsAdapter/ imports the design system package', () => {
    const packageRoot = resolve(__dirname, '..', '..')
    const files = collectSourceFiles(join(packageRoot, 'src'))
    expect(files.length).toBeGreaterThan(0)

    const allViolations = files.flatMap((absolutePath) => {
      const filePath = relative(packageRoot, absolutePath)
      return findDesignSystemImports(readFileSync(absolutePath, 'utf-8'), filePath).map(
        (v) => `${filePath}:${v.line} — ${v.message}`
      )
    })

    expect(allViolations).toEqual([])
  })
})
