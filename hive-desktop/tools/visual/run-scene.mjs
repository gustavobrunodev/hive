// Runs the visual-pass snippets **without** the Playwright MCP.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   node tools/visual/run-scene.mjs <scene.mjs> [more-scenes…]
//
// Why it exists: the MCP's browser is a *single* profile
// (`~/.cache/ms-playwright-mcp/mcp-chrome-…`), so a second Claude session
// holding it locks every other one out with "Browser is already in use" — a
// recurring block recorded in `docs/visual-validation.md`. This launches its
// own headless Chromium against the same served build and feeds each file the
// same `page` the MCP would, so every existing probe and scene file runs
// unchanged.
//
// Each file is a bare `async (page) => { … }` expression (the shape
// `browser_run_code_unsafe --filename` takes), which is why they are `eval`ed
// rather than imported: they are not modules and have no export.
//
// `boot.mjs` always runs first — it is the harness that plants `window.hive`.
// Scenes are run in order, in one page, and whatever each returns is printed.
import { readFileSync } from 'fs'
import { chromium } from 'playwright'

// Scenes read `globalThis.HIVE_THEME` (and friends) the way they do under the
// MCP; here they come from the environment so one command can sweep a theme.
for (const key of [
  'HIVE_THEME',
  'HIVE_SIDEBAR',
  'HIVE_SIDEBAR_OPEN',
  'HIVE_AUDIO_DIR',
  'HIVE_WANT_LIGHT',
  'HIVE_NO_BMAD'
]) {
  if (process.env[key] !== undefined) globalThis[key] = process.env[key]
}

const scenes = process.argv.slice(2)
if (scenes.length === 0) {
  console.error('usage: node tools/visual/run-scene.mjs <scene.mjs> [more…]')
  process.exit(1)
}

/** One snippet file → the function it is. */
function load(path) {
  // eslint-disable-next-line no-eval
  return eval(readFileSync(path, 'utf8'))
}

const browser = await chromium.launch({
  // WSL has no GPU worth the trouble, and the pass measures paint, not frames.
  args: ['--enable-unsafe-swiftshader', '--force-color-profile=srgb']
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (error) => console.error('[pageerror]', error.message))

try {
  console.log('--- boot ---')
  console.log(await load('tools/visual/boot.mjs')(page))
  for (const scene of scenes) {
    console.log(`--- ${scene} ---`)
    const result = await load(scene)(page)
    console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
  }
} finally {
  await browser.close()
}
