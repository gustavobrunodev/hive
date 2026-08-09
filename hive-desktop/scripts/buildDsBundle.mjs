/**
 * Design Studio (M18) — T2.2. Builds the self-contained Design System bundle
 * into `resources/design-system-web-awesome/`.
 *
 * Why a build step at all (P-4, measured 2026-08-09): the package's
 * `dist/webawesome.js` is a **1.3 KB barrel** that re-exports from
 * `dist/chunks/*` and registers no components. Inlining that file into an
 * exported Bundle would produce an HTML that looks right in the repo and
 * renders nothing on the user's machine. DS-R14 ("zero rede") therefore needs
 * one flattened artifact, produced here and committed (D-DS-5) so what ships is
 * what was reviewed.
 *
 * Output: one ESM file (`webawesome.js`) that defines all 70 custom elements
 * and re-exports the core utilities the in-frame receiver needs, plus one
 * stylesheet (`webawesome.css`) with the theme and native styles flattened and
 * every asset already a `data:` URI.
 *
 * Run: `npm run build:ds-bundle`
 */
import { build } from 'esbuild'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const dsRoot = join(packageRoot, 'node_modules', '@awesome.me', 'webawesome')
const outDir = join(packageRoot, 'resources', 'design-system-web-awesome')

/** Every component the package publishes — the catalog's tags and this list are the same 70. */
export function componentEntryPoints(componentsDir) {
  return readdirSync(componentsDir)
    .filter((name) => statSync(join(componentsDir, name)).isDirectory())
    .sort()
    .map((name) => `@awesome.me/webawesome/dist/components/${name}/${name}.js`)
}

const imports = componentEntryPoints(join(dsRoot, 'dist', 'components'))
const entry = [
  ...imports.map((specifier) => `import '${specifier}'`),
  // The core utilities travel with the components so the receiver and the
  // exported Bundle have exactly one script to load (`registerIconLibrary` is
  // what T2.6 needs to keep icons off the network).
  `export * from '@awesome.me/webawesome'`
].join('\n')

const shared = {
  bundle: true,
  format: 'esm',
  minify: true,
  legalComments: 'eof',
  // Electron's Chromium — no transpilation the runtime doesn't need.
  target: 'chrome120',
  absWorkingDir: packageRoot,
  logLevel: 'warning'
}

await build({
  ...shared,
  stdin: { contents: entry, resolveDir: packageRoot, sourcefile: 'ds-bundle-entry.js', loader: 'js' },
  outfile: join(outDir, 'webawesome.js')
})

await build({
  ...shared,
  entryPoints: [join(dsRoot, 'dist', 'styles', 'webawesome.css')],
  // Anything the CSS still points at would be a network request at open time,
  // so assets are inlined rather than emitted as siblings.
  loader: { '.svg': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl' },
  outfile: join(outDir, 'webawesome.css')
})

for (const file of ['webawesome.js', 'webawesome.css']) {
  console.log(`[ds-bundle] ${file} — ${(statSync(join(outDir, file)).size / 1024).toFixed(1)} KB`)
}
