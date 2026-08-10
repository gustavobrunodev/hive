// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createElement } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { StagePane } from './StagePane'
import { DEFAULT_VIEWPORT, viewportForPreset } from './viewport'
import { WCAG_AA_NORMAL, checkContrast } from '../ui/contrast'

/**
 * jsdom lays nothing out, so the bench's width is whatever the observer is
 * told. Capturing the callback is not a shortcut around the measurement — it
 * *is* the measurement path the component uses, driven with a known number.
 */
const observers: ResizeObserverCallback[] = []

class ObserverStub {
  constructor(callback: ResizeObserverCallback) {
    observers.push(callback)
  }
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
vi.stubGlobal('ResizeObserver', ObserverStub)

function resizeBench(width: number): void {
  act(() => {
    for (const callback of observers) {
      callback([{ contentRect: { width } } as unknown as ResizeObserverEntry], {} as ResizeObserver)
    }
  })
}

afterEach(() => {
  cleanup()
  observers.length = 0
})

const STYLESHEET = readFileSync(join(__dirname, '../assets/workbench.css'), 'utf-8')
const THEME = readFileSync(join(__dirname, '../assets/theme.css'), 'utf-8')
const DS_TOKENS = readFileSync(
  join(__dirname, '../../../../node_modules/@hive/design-system/dist/ds-bundle.css'),
  'utf-8'
)

/** `selector { declarations }` pairs, with comments removed so a doc block above a rule is not read as part of its selector. */
function rules(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = []
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match = pattern.exec(withoutComments)
  while (match !== null) {
    out.push({ selector: match[1].trim(), body: match[2] })
    match = pattern.exec(withoutComments)
  }
  return out
}

describe('the bench declares no box-shadow (D-DS-9, T4.5)', () => {
  /**
   * `DESIGN.md`'s Flat-Until-It-Floats rule keeps `--shadow-1..3` for portalled
   * surfaces. A device mock-up is the page's subject, not a popover, and the
   * temptation to reach for a shadow here is exactly why this is a test and not
   * a comment: three surface roles already produce the depth, and the day
   * someone adds `box-shadow` to make it "pop" the rule dies silently.
   */
  it('has no shadow on any Studio rule, naming the selector if one appears', () => {
    const offenders = rules(STYLESHEET)
      .filter(
        ({ selector, body }) => selector.includes('wb-dstudio') && /box-shadow\s*:/.test(body)
      )
      .map(({ selector }) => selector)

    expect(offenders).toEqual([])
  })

  it('paints the three surface layers the depth actually comes from (§3.2)', () => {
    const studioRules = new Map(
      rules(STYLESHEET).map(({ selector, body }) => [selector, body] as const)
    )

    expect(studioRules.get('.wb-dstudio-bench')).toContain('background: var(--bg-2)')
    expect(studioRules.get('.wb-dstudio-device')).toContain('background: var(--bg)')
    expect(studioRules.get('.wb-dstudio-device')).toContain('1px solid var(--border-strong)')
    expect(studioRules.get('.wb-dstudio-screen')).toContain('background: var(--surface)')
  })

  it('withdraws the dot grid under a forced palette', () => {
    // Read the whole `@media (forced-colors: active)` block as text: a rule
    // parser that flattens nesting would credit a top-level `display: none`
    // for a rule that only applies inside the media query, and vice versa.
    const start = STYLESHEET.lastIndexOf('@media (forced-colors: active)')
    expect(start).toBeGreaterThan(-1)
    const block = STYLESHEET.slice(start)
    expect(block).toContain('.wb-dstudio-bench-grid')
    expect(block.slice(block.indexOf('.wb-dstudio-bench-grid'))).toContain('display: none')
  })
})

/**
 * Token values, resolved through `var()` chains, for one theme. The three
 * themes are the app's real ones (`theme.css` overrides the DS ledger), and the
 * bench introduces a new background role for text — `--bg-2` — that no earlier
 * surface used, so its pairs have never been measured before.
 */
function tokensFor(theme: 'light' | 'dark' | 'hive'): Map<string, string> {
  const declared = new Map<string, string>()
  const parsed = rules(`${DS_TOKENS}\n${THEME}`).map(({ selector, body }) => ({
    selector: selector.replace(/['"]/g, ''),
    body
  }))
  const collect = (matches: (selector: string) => boolean): void => {
    for (const { selector, body } of parsed) {
      if (!matches(selector)) continue
      for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        declared.set(name, value.trim())
      }
    }
  }
  // Base first, then the theme's overrides — the cascade order the browser
  // applies. Reading them in file order instead would let the DS's light
  // ledger, which is declared last, overwrite the dark theme it precedes.
  collect((selector) => selector === ':root' || selector === ':root:not([data-theme])')
  collect((selector) => selector.includes(`[data-theme=${theme}]`))
  const resolved = new Map<string, string>()
  const resolve = (name: string, seen: Set<string>): string => {
    const value = declared.get(name) ?? ''
    const reference = /^var\((--[\w-]+)\)$/.exec(value)
    if (!reference || seen.has(reference[1])) return value
    seen.add(reference[1])
    return resolve(reference[1], seen)
  }
  for (const name of declared.keys()) resolved.set(name, resolve(name, new Set([name])))
  return resolved
}

describe('the bench clears AA in every theme (DS-R18, T4.5)', () => {
  for (const theme of ['light', 'dark', 'hive'] as const) {
    it(`reads text on the bench and on the screen at AA — ${theme}`, () => {
      const tokens = tokensFor(theme)
      const pairs: [string, string][] = [
        ['--ink', '--bg-2'],
        ['--muted', '--bg-2'],
        ['--ink', '--surface'],
        ['--muted', '--surface']
      ]

      for (const [ink, background] of pairs) {
        const result = checkContrast(
          tokens.get(ink) ?? '',
          tokens.get(background) ?? '',
          WCAG_AA_NORMAL
        )
        expect(
          { theme, pair: `${ink} on ${background}`, ratio: result.ratio, passes: result.passes },
          `${ink} on ${background} (${theme})`
        ).toMatchObject({ passes: true })
      }
    })
  }
})

describe('StagePane — the object on the bench', () => {
  it('stacks bench, device and screen, and hides the grid from the a11y tree', () => {
    render(
      createElement(
        StagePane,
        { viewport: DEFAULT_VIEWPORT },
        createElement('span', null, 'preview')
      )
    )

    const bench = screen.getByLabelText('Palco')
    expect(bench.querySelector('.wb-dstudio-bench-grid')?.getAttribute('aria-hidden')).toBe('true')
    const screenEl = bench.querySelector('.wb-dstudio-device > .wb-dstudio-screen')
    expect(screenEl?.textContent).toBe('preview')
  })

  it('reads the device size and the reduction, in that order', () => {
    render(createElement(StagePane, { viewport: DEFAULT_VIEWPORT }))
    resizeBench(700)

    expect(screen.getByText('1440 × 900 · 44%')).toBeTruthy()
  })

  it('anchors the readout outside the screen, so it is chrome and not content', () => {
    render(createElement(StagePane, { viewport: DEFAULT_VIEWPORT }))

    const readout = screen.getByText('1440 × 900 · 100%')
    expect(readout.closest('.wb-dstudio-screen')).toBeNull()
    expect(readout.closest('.wb-dstudio-bench-content')).toBeTruthy()
  })

  /**
   * The T4.6 verification, at the DOM: a Desktop preset on a 700px bench
   * reduces, and the reduction is on the *container*. Nothing scales the
   * children — which is what leaves the frame reporting the device's real
   * width to the document inside it (D-DS-7).
   */
  it('scales the container and leaves the device untouched on a bench too small for it', () => {
    render(
      createElement(
        StagePane,
        { viewport: DEFAULT_VIEWPORT },
        createElement('iframe', { title: 'frame', style: { width: '1440px' } })
      )
    )
    resizeBench(700)

    const box = document.querySelector('.wb-dstudio-scale') as HTMLElement
    const scale = Number(box.dataset.scale)
    expect(scale).toBeLessThan(1)
    expect(box.style.transform).toBe(`scale(${scale})`)

    const device = document.querySelector('.wb-dstudio-device') as HTMLElement
    expect(device.style.transform).toBe('')
    expect((screen.getByTitle('frame') as HTMLIFrameElement).style.width).toBe('1440px')
  })

  it('reclaims the space the transform does not, so a reduced Preview leaves no gap', () => {
    render(createElement(StagePane, { viewport: DEFAULT_VIEWPORT }))
    resizeBench(700)

    const box = document.querySelector('.wb-dstudio-scale') as HTMLElement
    const scale = Number(box.dataset.scale)
    expect(box.style.marginRight).toBe(`${-1440 * (1 - scale)}px`)
    expect(box.style.marginBottom).toBe(`${-900 * (1 - scale)}px`)
  })

  it('never magnifies: a mobile Tela on a wide bench stays at 100%', () => {
    render(createElement(StagePane, { viewport: viewportForPreset('mobile') }))
    resizeBench(1600)

    expect(screen.getByText('390 × 844 · 100%')).toBeTruthy()
    expect((document.querySelector('.wb-dstudio-scale') as HTMLElement).style.transform).toBe(
      'scale(1)'
    )
  })

  it('animates the transform and nothing else, with a reduced alternative (§3.9)', () => {
    const scaleRule = rules(STYLESHEET).find(({ selector }) => selector === '.wb-dstudio-scale')
    expect(scaleRule?.body).toContain('transition: transform 200ms var(--ease-quart)')

    const reduced = STYLESHEET.slice(STYLESHEET.lastIndexOf('@media (prefers-reduced-motion'))
    expect(reduced).toContain('.wb-dstudio-scale')
    expect(reduced.slice(reduced.indexOf('.wb-dstudio-scale'))).toContain('transition: none')
  })
})
