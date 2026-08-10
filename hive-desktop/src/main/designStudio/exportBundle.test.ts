import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { exportScreen, screenSlug } from './exportBundle'
import type { DesignSystemAdapter } from './dsAdapter/types'
import {
  createWebAwesomeAdapter,
  loadWebAwesomeAssets,
  loadWebAwesomeCatalog
} from './dsAdapter/webAwesomeAdapter'
import type { ScreenDocument, ScreenNode } from './types'

/**
 * design-studio T7.2 — DS-R14 AC-1/2.
 *
 * Two claims live here. The first is that the exporter is a *writer*: the bytes
 * on disk are exactly what the adapter produced, so there is no second markup
 * path for the Preview to drift from (AD-6). The second is that a Tela's title
 * — free prose out of a UX Spec — can never decide where the file lands.
 *
 * "Opens with the network off and matches the Preview" is the other half of
 * this task and cannot be asserted in jsdom: it needs a real browser, real
 * custom-element upgrades and a real network probe. That proof is
 * `e2e/design-studio-export.spec.ts`.
 */

const resourcesRoot = resolve(__dirname, '..', '..', '..', 'resources')

function node(id: string, tag: string, extra: Partial<ScreenNode> = {}): ScreenNode {
  return { id, tag, props: {}, children: [], ...extra }
}

function screen(title: string, root: ScreenNode | null = node('n1', 'wa-card')): ScreenDocument {
  return { screenId: 'login', title, root }
}

/** The real adapter — the export must be provably the artifact the app ships. */
function realAdapter(): DesignSystemAdapter {
  return createWebAwesomeAdapter(loadWebAwesomeCatalog(resourcesRoot), () =>
    loadWebAwesomeAssets(resourcesRoot)
  )
}

function withTempDir<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'hive-export-'))
  try {
    return run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('exportScreen writes the adapter’s document, byte for byte', () => {
  it('writes exactly what renderToStaticHtml returned', () => {
    withTempDir((dir) => {
      const adapter = realAdapter()
      const document = screen('Login')
      const result = exportScreen(adapter, document, dir)

      expect(readFileSync(result.file, 'utf-8')).toBe(adapter.renderToStaticHtml(document))
      expect(result).toEqual({ screenId: 'login', title: 'Login', file: join(dir, 'login.html') })
    })
  })

  it('produces a file that carries the bundle, the stylesheet and no URL to fetch', () => {
    withTempDir((dir) => {
      const html = readFileSync(exportScreen(realAdapter(), screen('Login'), dir).file, 'utf-8')

      // DS-R14 AC-1: everything inline. A `src`/`href` on a script or a
      // stylesheet would be the one request that breaks the artifact offline.
      expect(html).not.toMatch(/<script[^>]*\ssrc=/i)
      expect(html).not.toMatch(/<link[^>]*\shref=/i)
      expect(html).toContain('customElements.define')
      // The theme's own CSS made it in, not just the tree.
      expect(html).toContain('--wa-color-brand-fill-loud')
      expect(html.length).toBeGreaterThan(900_000)
    })
  })

  it('creates the output directory when it does not exist yet', () => {
    withTempDir((dir) => {
      const nested = join(dir, 'bundles', 'v1')
      const result = exportScreen(realAdapter(), screen('Login'), nested)
      expect(dirname(result.file)).toBe(nested)
      expect(readdirSync(nested)).toEqual(['login.html'])
    })
  })

  it('leaves no temp file behind', () => {
    withTempDir((dir) => {
      exportScreen(realAdapter(), screen('Login'), dir)
      expect(readdirSync(dir)).toEqual(['login.html'])
    })
  })

  it('writes nothing at all when the adapter refuses the Screen', () => {
    withTempDir((dir) => {
      expect(() =>
        exportScreen(realAdapter(), screen('Login', node('n1', 'wa-nao-existe')), dir)
      ).toThrow(/wa-nao-existe/)
      expect(readdirSync(dir)).toEqual([])
    })
  })

  it('honours an explicit file name — how a batch keeps two same-titled Telas apart', () => {
    withTempDir((dir) => {
      const result = exportScreen(realAdapter(), screen('Login'), dir, 'login-2.html')
      expect(result.file).toBe(join(dir, 'login-2.html'))
      expect(readdirSync(dir)).toEqual(['login-2.html'])
    })
  })
})

describe('the title decides the name and never the location', () => {
  it('slugs accents and punctuation out of a Tela title', () => {
    expect(screenSlug(screen('Cadastro de Usuário'))).toBe('cadastro-de-usuario')
    expect(screenSlug(screen('Login / Acesso'))).toBe('login-acesso')
    expect(screenSlug(screen('  Sucesso!  '))).toBe('sucesso')
  })

  it('cannot escape the output directory', () => {
    withTempDir((dir) => {
      const document: ScreenDocument = {
        screenId: 'x',
        title: '../../etc/passwd',
        root: node('n1', 'wa-card')
      }
      expect(screenSlug(document)).toBe('etc-passwd')
      const result = exportScreen(realAdapter(), document, dir)
      expect(result.file).toBe(join(dir, 'etc-passwd.html'))
      expect(readdirSync(dir)).toEqual(['etc-passwd.html'])
    })
  })

  it('falls back to the screenId, then to a constant, when the title yields nothing', () => {
    expect(screenSlug({ screenId: 'tela-2', title: '···', root: null })).toBe('tela-2')
    expect(screenSlug({ screenId: '···', title: '', root: null })).toBe('tela')
  })

  it('bounds the length of a very long title', () => {
    const slug = screenSlug(screen('a'.repeat(200)))
    expect(slug).toHaveLength(60)
  })
})
