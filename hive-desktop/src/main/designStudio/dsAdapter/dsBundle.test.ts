import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { localIconKeys } from './iconLibrary'

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

  /**
   * T2.6 / R-1. Comments are stripped first: the embedded SVGs and the bundle's
   * legal comment both carry the Font Awesome attribution CC BY 4.0 requires,
   * and removing that would trade one compliance problem for another. What must
   * not survive is a *reachable* URL — a string any code path could fetch.
   */
  it('has no fontawesome.com URL any code path could reach', () => {
    for (const file of ['webawesome.js', 'webawesome.css']) {
      const code = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
      expect([...code.matchAll(/[^\s"'`)]*fontawesome\.com[^\s"'`)]*/g)].map((m) => m[0])).toEqual(
        []
      )
    }
    // The attribution itself is still there — and so is the sentinel that
    // replaced the vendor's CDN base, proving the rewrite ran.
    expect(read('webawesome.js')).toContain('Font Awesome Free')
    expect(read('webawesome.js')).toContain('wa-icon-cdn-disabled')
  })

  it('carries an inline SVG for every icon the local library declares (T2.6)', () => {
    const js = read('webawesome.js')
    expect(js).toContain('registerIconLibrary')
    const missing = localIconKeys().filter((key) => !js.includes(`"${key}":`))
    expect(missing).toEqual([])
    // Real markup, not an empty placeholder: `wa-icon` has something to render
    // with the network off.
    const house = /"solid\/house":\s*(['"])([\s\S]*?)\1/.exec(js)
    expect(house?.[2]).toMatch(/^<svg[\s\S]*<\/svg>$/)
    expect(house?.[2]).toContain('<path')
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
