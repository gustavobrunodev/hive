/**
 * Design Studio (M18) — T2.2 + T2.6. Builds the self-contained Design System
 * bundle into `resources/design-system-web-awesome/`.
 *
 * Why a build step at all (P-4, measured 2026-08-09): the package's
 * `dist/webawesome.js` is a **1.3 KB barrel** that re-exports from
 * `dist/chunks/*` and registers no components. Inlining that file into an
 * exported Bundle would produce an HTML that looks right in the repo and
 * renders an empty page on the user's machine. DS-R14 ("zero rede") therefore
 * needs one flattened artifact, produced here and committed (D-DS-5) so what
 * ships is what was reviewed.
 *
 * Two things leave the network out of it (T2.6 / R-1):
 *   - the icon set from `iconLibrary.ts` is inlined and registered as the
 *     `default` library, so `wa-icon` never asks a CDN for an SVG;
 *   - the vendor's CDN base URLs are rewritten out of the sources on the way
 *     in, so no code path can reach `fontawesome.com` even if a future change
 *     bypasses the library registration.
 *
 * Output: one ESM file (`webawesome.js`) that defines all 70 custom elements,
 * registers the local icons, and re-exports the core utilities the in-frame
 * receiver needs, plus one stylesheet (`webawesome.css`).
 *
 * Run: `npm run build:ds-bundle`
 */
import { build, transformSync } from 'esbuild'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const dsRoot = join(packageRoot, 'node_modules', '@awesome.me', 'webawesome')
const faRoot = join(packageRoot, 'node_modules', '@fortawesome', 'fontawesome-free')
const outDir = join(packageRoot, 'resources', 'design-system-web-awesome')

/** Imports a TypeScript module of ours without a compile step of its own. */
async function importTs(relativePath) {
  const source = readFileSync(join(packageRoot, relativePath), 'utf-8')
  const { code } = transformSync(source, { loader: 'ts', format: 'esm' })
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

const iconLibraryPath = 'src/main/designStudio/dsAdapter/iconLibrary.ts'
const { ICON_ATTRIBUTION, localIconKeys } = await importTs(iconLibraryPath)

/** Every component the package publishes — the catalog's tags and this list are the same 70. */
function componentEntryPoints(componentsDir) {
  return readdirSync(componentsDir)
    .filter((name) => statSync(join(componentsDir, name)).isDirectory())
    .sort()
    .map((name) => `@awesome.me/webawesome/dist/components/${name}/${name}.js`)
}

/**
 * The embedded icon set. The per-file attribution comment is dropped (it is
 * ~330 bytes on every icon); the same notice ships once, as a legal comment on
 * the bundle, which is what CC BY 4.0 asks for.
 */
function readIcons() {
  const icons = {}
  for (const key of localIconKeys()) {
    const path = join(faRoot, 'svgs', `${key}.svg`)
    // A missing icon must fail the build, not ship as a hole in the set.
    icons[key] = readFileSync(path, 'utf-8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim()
  }
  return icons
}

const icons = readIcons()
const entry = [
  `/*! ${ICON_ATTRIBUTION} */`,
  ...componentEntryPoints(join(dsRoot, 'dist', 'components')).map(
    (specifier) => `import '${specifier}'`
  ),
  `import { registerIconLibrary } from '@awesome.me/webawesome'`,
  `import { createLocalIconResolver } from './${iconLibraryPath}'`,
  `const HIVE_ICONS = ${JSON.stringify(icons)}`,
  `registerIconLibrary('default', {`,
  `  resolver: createLocalIconResolver(HIVE_ICONS),`,
  `  mutator: (svg) => { if (!svg.hasAttribute('fill')) svg.setAttribute('fill', 'currentColor') }`,
  `})`,
  // The core utilities travel with the components so the receiver and the
  // exported Bundle have exactly one script to load.
  `export * from '@awesome.me/webawesome'`
].join('\n')

/**
 * Rewrites the vendor's icon CDN out of the sources. The registration above
 * already means nothing calls it; this makes that structural rather than a
 * matter of load order, and it is what the T2.6 assertion measures.
 */
const disableIconCdn = {
  name: 'disable-icon-cdn',
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /webawesome[\\/]dist[\\/].*\.js$/ }, (args) => ({
      contents: readFileSync(args.path, 'utf-8').replace(
        /https:\/\/ka-[pf]\.fontawesome\.com/g,
        'about:blank#wa-icon-cdn-disabled'
      ),
      loader: 'js'
    }))
  }
}

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
  stdin: {
    contents: entry,
    resolveDir: packageRoot,
    sourcefile: 'ds-bundle-entry.js',
    loader: 'js'
  },
  plugins: [disableIconCdn],
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
console.log(`[ds-bundle] ${Object.keys(icons).length} icons embedded`)
