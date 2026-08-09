/**
 * Design Studio (M18) — T2.1 runner. Freezes the derived component catalog
 * into `resources/design-system-web-awesome/catalog.json` (D-DS-5).
 *
 * The transform itself lives in `src/main/designStudio/dsAdapter/catalogBuild.ts`
 * so it can be tested against the real installed manifest. This script only
 * feeds it the manifest and writes the result; it transpiles that one TS file
 * in memory with esbuild (already a dependency for the T2.2 bundle) rather than
 * keeping a second copy of the logic in JS — two copies is exactly how a
 * "derived" catalog quietly becomes a hand-written one.
 *
 * Run: `npm run build:ds-catalog`
 */
import { transformSync } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const dsRoot = join(packageRoot, 'node_modules', '@awesome.me', 'webawesome')
const outDir = join(packageRoot, 'resources', 'design-system-web-awesome')

const source = readFileSync(
  join(packageRoot, 'src', 'main', 'designStudio', 'dsAdapter', 'catalogBuild.ts'),
  'utf-8'
)
const { code } = transformSync(source, { loader: 'ts', format: 'esm' })
const { buildCatalog } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
)

const cem = JSON.parse(readFileSync(join(dsRoot, 'dist', 'custom-elements.json'), 'utf-8'))
const { version } = JSON.parse(readFileSync(join(dsRoot, 'package.json'), 'utf-8'))
const catalog = buildCatalog(cem, version)

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`)

console.log(
  `[ds-catalog] ${catalog.components.length} components from ${catalog.dsId}@${catalog.version}`
)
