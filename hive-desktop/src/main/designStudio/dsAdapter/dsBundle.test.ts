import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'

/**
 * design-studio T2.2 — DS-R14, R-2.
 *
 * P-4 (measured): the package's own `dist/webawesome.js` is a 1.3 KB barrel
 * that re-exports from `dist/chunks/*` and registers nothing. Inlining *that*
 * into an exported Bundle would produce an HTML that reviews fine and renders
 * an empty page on the user's machine — the failure R-2 exists to prevent.
 *
 * So the assertions here are about the built artifact, not about the build
 * script: one file, small enough to embed in every exported Screen, and with
 * nothing left in it that the browser would have to fetch.
 */

const bundleDir = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'resources',
  'design-system-web-awesome'
)
const ONE_MB = 1024 * 1024

function read(file: string): string {
  return readFileSync(join(bundleDir, file), 'utf-8')
}

describe('the committed Design System bundle', () => {
  it('is one JS file and one stylesheet', () => {
    const files = readdirSync(bundleDir).sort()
    expect(files.filter((file) => file.endsWith('.js'))).toEqual(['webawesome.js'])
    expect(files.filter((file) => file.endsWith('.css'))).toEqual(['webawesome.css'])
    // No sibling assets: anything emitted next to the bundle would be a second
    // file the exported HTML cannot carry.
    expect(files).toEqual(['catalog.json', 'webawesome.css', 'webawesome.js'])
  })

  it('measures under 1 MB, script and stylesheet together', () => {
    const js = statSync(join(bundleDir, 'webawesome.js')).size
    const css = statSync(join(bundleDir, 'webawesome.css')).size
    expect(js).toBeGreaterThan(100 * 1024) // not the 1.3 KB barrel (P-4)
    expect(js + css).toBeLessThanOrEqual(ONE_MB)
  })

  it('defines the components rather than re-exporting them', () => {
    const js = read('webawesome.js')
    expect(js).toContain('customElements.define')
    const tags = new Set([...js.matchAll(/"(wa-[a-z][a-z-]*)"/g)].map((match) => match[1]))
    const catalog = JSON.parse(read('catalog.json')) as { components: { tag: string }[] }
    const missing = catalog.components
      .map((component) => component.tag)
      .filter((tag) => !tags.has(tag))
    expect(missing).toEqual([])
  })

  it('has no module specifier left to resolve — it is self-contained', () => {
    const js = read('webawesome.js')
    const specifiers = [
      ...js.matchAll(
        /(?:^|[;}\s])(?:import|export)\s*(?:\{[^}]*\}\s*from|\*\s*as\s+\w+\s*from)?\s*["']([^"']+)["']/g
      )
    ].map((match) => match[1])
    expect(specifiers).toEqual([])
    expect([...js.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)]).toEqual([])
  })

  it('has no stylesheet asset the browser would have to fetch', () => {
    const css = read('webawesome.css')
    expect(css.length).toBeGreaterThan(0)
    // Every @import must have been flattened away by the build.
    expect(css).not.toContain('@import')
    const remote = [...css.matchAll(/url\(\s*['"]?((?:https?:)?\/\/[^)'"]+)/g)].map((m) => m[1])
    expect(remote).toEqual([])
  })
})
