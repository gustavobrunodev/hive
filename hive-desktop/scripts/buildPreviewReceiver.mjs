/**
 * Design Studio (M18) — T3.4. Bundles the in-frame receiver into
 * `resources/design-studio-preview/receiver.js`.
 *
 * It gets its own build step, and its own artifact, for the same reason the DS
 * bundle does: what the session shell loads must be one same-origin file under
 * `script-src 'self'`, with no import map and no resolution at runtime. It is
 * committed (like `webawesome.js`) so what ships is what was reviewed — and so
 * the T3.4 guard can assert `innerHTML` is absent from the *bundle*, which is
 * the only place a dependency could have reintroduced it.
 *
 * Run: `npm run build:preview-receiver`
 */
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(packageRoot, 'resources', 'design-studio-preview', 'receiver.js')

await build({
  entryPoints: [join(packageRoot, 'src', 'preview', 'index.ts')],
  bundle: true,
  format: 'esm',
  minify: true,
  // Electron's Chromium — no transpilation the runtime doesn't need.
  target: 'chrome120',
  absWorkingDir: packageRoot,
  logLevel: 'warning',
  outfile
})

console.log(`[preview-receiver] receiver.js — ${(statSync(outfile).size / 1024).toFixed(1)} KB`)
