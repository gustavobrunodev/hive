import { test, expect } from './fixtures/workspace'
import { checkContrast, WCAG_AA_LARGE, WCAG_AA_NORMAL } from '../src/renderer/src/ui/contrast'
import type { Page } from '@playwright/test'
import { THEMES, type Theme } from '../src/renderer/src/ui/theme'

/**
 * P0-010 (test-design-qa.md, risk R-05 — BUS, score 6).
 *
 * The class that recurred in M12 **and** M12.1 and was caught both times by a
 * human eye: text under the WCAG AA floor, measured at 3.93:1 and 3.46:1 in the
 * light theme. `src/renderer/src/ui/contrast.ts` already does the maths; what
 * was missing was a gate and a sweep. This is both.
 *
 * Measured on real rendered pixels in the real app, not on declarations —
 * `docs/visual-validation.md` is explicit about why: anything built with
 * `color-mix()` comes back from `getComputedStyle()` in a form a naive parser
 * reads as near-black, and it once produced confident nonsense (1.1:1 dark,
 * 13:1 light for the same declaration).
 *
 * All three themes, every time. Half the recorded contrast defects appeared in
 * only one of the two that existed then, and `hive` — the brand's bordo ledger
 * — is the newest and least-looked-at of the three.
 */

interface Sample {
  label: string
  color: string
  background: string
  /** px, to pick the AA floor: large text is allowed 3:1. */
  fontSize: number
  bold: boolean
}

/**
 * Reads foreground/background off every visible text node in the window.
 *
 * Two things make this trustworthy rather than a parser exercise:
 *   - the background is resolved by walking up the ancestor chain until an
 *     opaque paint is found, because the nearest element is usually
 *     `transparent` and comparing text against `transparent` is meaningless;
 *   - every color is normalised through a canvas `fillStyle` round-trip, which
 *     makes the browser itself convert whatever it returns (`oklch(...)`,
 *     `color(srgb ...)`, `lab(...)`) into a plain `rgb()`/hex the probe parses.
 *     Without this the sweep would silently "not measure" the entire palette,
 *     since every token in this app is authored in oklch.
 */
async function sampleTextContrast(window: Page): Promise<Sample[]> {
  return window.evaluate(() => {
    // Real pixels, not string parsing. A 1x1 canvas lets the BROWSER do both
    // the color-space conversion and the alpha compositing: every token here is
    // authored in oklch, Chromium hands `getComputedStyle` back oklch/oklab
    // verbatim, and several surfaces paint translucent layers over their
    // parent. Parsing those strings is how you get confident nonsense; painting
    // them and reading the bytes is how you get what the user sees.
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D

    /** Paints `layers` bottom-up over opaque white and returns the resulting hex. */
    const composite = (layers: string[]): string => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 1, 1)
      for (const layer of layers) {
        ctx.fillStyle = layer
        ctx.fillRect(0, 0, 1, 1)
      }
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      const hex = (n: number): string => n.toString(16).padStart(2, '0')
      return `#${hex(r)}${hex(g)}${hex(b)}`
    }

    /**
     * Every background paint between the element and the root, outermost
     * first, so they can be composited in paint order. Stops at the first
     * fully-opaque layer — nothing below it is visible.
     */
    const backgroundLayers = (element: Element): string[] => {
      const layers: string[] = []
      let node: Element | null = element
      while (node) {
        const bg = getComputedStyle(node).backgroundColor
        if (bg && bg !== 'transparent' && !/\/\s*0\s*\)$/.test(bg) && !/,\s*0\s*\)$/.test(bg)) {
          layers.unshift(bg)
          // An opaque layer hides everything underneath it.
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = '#000000'
          ctx.fillRect(0, 0, 1, 1)
          ctx.fillStyle = bg
          ctx.fillRect(0, 0, 1, 1)
          const onBlack = ctx.getImageData(0, 0, 1, 1).data
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, 1, 1)
          ctx.fillStyle = bg
          ctx.fillRect(0, 0, 1, 1)
          const onWhite = ctx.getImageData(0, 0, 1, 1).data
          const opaque =
            onBlack[0] === onWhite[0] && onBlack[1] === onWhite[1] && onBlack[2] === onWhite[2]
          if (opaque) break
        }
        node = node.parentElement
      }
      return layers
    }

    const out: {
      label: string
      color: string
      background: string
      fontSize: number
      bold: boolean
    }[] = []
    const seen = new Set<string>()

    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      // Only elements that paint their own text.
      const ownText = Array.from(element.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent ?? '').trim())
        .join(' ')
        .trim()
      if (ownText.length === 0) continue

      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.opacity === '0') continue
      // Decorative glyphs carry no information; the a11y tree hides them.
      if (element.closest('[aria-hidden="true"]')) continue

      const background = composite(backgroundLayers(element))
      // The text itself can be translucent — composite it over its own
      // background so the ratio reflects the painted glyph, not the token.
      const color = composite([...backgroundLayers(element), style.color])

      const fontSize = parseFloat(style.fontSize) || 16
      const weight = Number(style.fontWeight) || 400
      const label = `${element.tagName.toLowerCase()}.${element.className || '—'}: ${ownText.slice(0, 40)}`

      const key = `${color}|${background}|${fontSize}|${weight >= 700}`
      if (seen.has(key)) continue
      seen.add(key)

      out.push({ label, color, background, fontSize, bold: weight >= 700 })
    }
    return out
  })
}

/** WCAG's own rule: >=24px, or >=18.66px when bold, is "large text". */
function floorFor(sample: Sample): number {
  const large = sample.fontSize >= 24 || (sample.bold && sample.fontSize >= 18.66)
  return large ? WCAG_AA_LARGE : WCAG_AA_NORMAL
}

function failuresIn(samples: Sample[]): string[] {
  const failures: string[] = []
  for (const sample of samples) {
    const floor = floorFor(sample)
    const { ratio, passes } = checkContrast(sample.color, sample.background, floor)
    if (ratio === undefined) {
      // "Could not measure" is not "passed" — but it is also not a contrast
      // defect, so it is surfaced separately rather than failing the gate on a
      // parser gap.
      failures.push(`UNMEASURED (${sample.color} on ${sample.background}) — ${sample.label}`)
      continue
    }
    if (!passes) {
      failures.push(
        `${ratio.toFixed(2)}:1 < ${floor}:1 — ${sample.label} (${sample.color} on ${sample.background})`
      )
    }
  }
  return failures
}

/**
 * Kills every transition and animation before sampling.
 *
 * Colors mid-transition are neither the old value nor the new one, and the
 * theme swap animates: sampling into that window measures a frame no user ever
 * reads and reports it as a contrast defect. The same trick every visual-
 * regression harness uses, and it is why this spec is deterministic.
 */
async function freezeMotion(window: Page): Promise<void> {
  await window.addStyleTag({
    content: `*, *::before, *::after {
      transition: none !important;
      animation: none !important;
      caret-color: transparent !important;
    }`
  })
  // One frame for the cascade to apply.
  await window.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  )
}

/** The picker's pt-BR label for each theme, to click the right menu entry. */
const THEME_OPTION_LABEL = { dark: 'Escuro', light: 'Claro', hive: 'Hive' } as const

/**
 * Switches the app to `theme` through the real picker, and only if it is not
 * already there.
 *
 * Setting `data-theme` on the root by hand looks equivalent and is not: the CSS
 * cascade flips but React's `theme` state does not, so anything colored from JS
 * keeps its old value. That produced two spectacular false positives on the
 * first run of this spec — near-black text reported at 1.16:1 and 1.35:1 in the
 * light theme, which is what a dark-theme foreground looks like sitting on a
 * light-theme surface. Drive the affordance the user drives.
 */
async function setTheme(window: Page, theme: Theme): Promise<void> {
  const current = await window.evaluate(
    () => document.documentElement.getAttribute('data-theme') ?? 'dark'
  )
  if (current === theme) return
  await window.getByRole('button', { name: /^Aparência/ }).click()
  await window
    .getByRole('menuitemradio', { name: new RegExp(`^${THEME_OPTION_LABEL[theme]}`) })
    .click()
  await expect(window.locator(`:root[data-theme="${theme}"]`)).toHaveCount(1)
}

for (const theme of THEMES) {
  test(`@p0 @a11y work UI text meets WCAG AA in the ${theme} theme`, async ({ hiveApp }) => {
    const { window } = hiveApp

    await setTheme(window, theme)
    await freezeMotion(window)

    const samples = await sampleTextContrast(window)
    // A sweep that measured nothing would pass vacuously — the failure mode
    // that makes a green a11y gate worse than none.
    expect(samples.length).toBeGreaterThan(5)

    expect(
      failuresIn(samples),
      `contrast failures in ${theme}:\n${failuresIn(samples).join('\n')}`
    ).toEqual([])
  })
}

/**
 * voice-prompt (VP-R6.3, VP-R7.4). The sweep above never sees the dictation
 * transport: it only exists while a take is live, and the work UI it samples is
 * idle. So the take is opened first, with the microphone and the transcriber
 * standing in (`e2eDictationSeam.ts` — real audio cannot flow headless, T1),
 * and the sweep then runs with the transport on screen.
 *
 * The pair most likely to fail is checked by name as well as by sweep: the
 * light theme's `--accent` (`--bordo-sensatez`) carrying the frame ring, the
 * record dot and the meter bars, all of which are *meaningful non-text
 * indicators* and owe 3:1 against the composer surface rather than the 4.5:1
 * the text around them owes.
 */
for (const theme of THEMES) {
  test(`@p0 @a11y the dictation transport meets WCAG AA in the ${theme} theme`, async ({
    hiveApp
  }) => {
    const { window } = hiveApp

    await window.addInitScript(() => {
      ;(window as unknown as { __hiveDictationE2E: unknown }).__hiveDictationE2E = {
        transcript: 'arquivo de configuração'
      }
    })
    await window.reload()
    await window.waitForLoadState('domcontentloaded')
    await window.locator('.wb-composer-wrap').waitFor({ state: 'visible', timeout: 60_000 })

    await setTheme(window, theme)
    await freezeMotion(window)

    await window.getByRole('button', { name: 'Ditar' }).click()
    await window.locator('.wb-dictation').waitFor({ state: 'visible' })

    const samples = await sampleTextContrast(window)
    expect(samples.length).toBeGreaterThan(5)
    expect(
      failuresIn(samples),
      `contrast failures in ${theme} with the transport open:\n${failuresIn(samples).join('\n')}`
    ).toEqual([])

    // The non-text indicators, at their own 3:1 floor.
    const indicators = await window.evaluate(() => {
      const surface = document.querySelector('.hds-prompt-input')
      const background = getComputedStyle(surface ?? document.body).backgroundColor
      const read = (
        selector: string,
        property: 'backgroundColor' | 'borderColor'
      ): [string, string] | null => {
        const node = document.querySelector(selector)
        if (node === null) return null
        return [getComputedStyle(node)[property], background]
      }
      return {
        ring: read('.hds-prompt-input[data-highlighted]', 'borderColor'),
        dot: read('.wb-dictation-dot', 'backgroundColor'),
        meter: read('.hds-level-meter-bar', 'backgroundColor')
      }
    })

    for (const [name, pair] of Object.entries(indicators)) {
      if (pair === null) continue
      const result = checkContrast(pair[0], pair[1])
      expect(
        result.ratio ?? 0,
        `${name} in ${theme}: ${pair[0]} on ${pair[1]}`
      ).toBeGreaterThanOrEqual(WCAG_AA_LARGE)
    }
  })
}

/**
 * shortcut-scopes (SS-R5). Neither surface below is on screen in an idle work
 * UI, so the sweep at the top never sees them: the "Personalizar atalhos"
 * picker is a dialog, and the profile is a sheet. Both are opened first and
 * then swept — the same shape as the dictation test above, and the reason it
 * exists: a surface that only appears on demand is exactly where a contrast
 * defect survives to a user.
 *
 * Both scopes of the picker are visited, because they render different
 * previews (hero pills vs. composer chips) with different tints under them.
 */
for (const theme of THEMES) {
  test(`@p0 @a11y the shortcut picker and profile sheet meet WCAG AA in the ${theme} theme`, async ({
    hiveApp
  }) => {
    const { window } = hiveApp

    await setTheme(window, theme)
    await freezeMotion(window)

    // The picker, on the hero set and then on the in-conversation set.
    await window.getByRole('button', { name: 'Personalizar atalhos' }).first().click()
    await window.locator('.wb-sc-dialog').waitFor({ state: 'visible' })
    await window.locator('.wb-sc-stage').waitFor({ state: 'visible' })

    const startSamples = await sampleTextContrast(window)
    expect(startSamples.length).toBeGreaterThan(5)
    expect(
      failuresIn(startSamples),
      `contrast failures in ${theme}, picker on "Para iniciar":\n${failuresIn(startSamples).join('\n')}`
    ).toEqual([])

    await window.getByRole('radio', { name: /Durante a conversa/ }).click()
    const duringSamples = await sampleTextContrast(window)
    expect(
      failuresIn(duringSamples),
      `contrast failures in ${theme}, picker on "Durante a conversa":\n${failuresIn(duringSamples).join('\n')}`
    ).toEqual([])

    await window.getByRole('button', { name: 'Concluído' }).click()
    await expect(window.locator('.wb-sc-dialog')).toHaveCount(0)

    // The profile sheet: the read-only role block and the two-set summary.
    await window.getByRole('button', { name: 'Abrir configurações de perfil' }).click()
    await window.locator('.wb-profile-shortcut-sets').waitFor({ state: 'visible' })

    const profileSamples = await sampleTextContrast(window)
    expect(profileSamples.length).toBeGreaterThan(5)
    expect(
      failuresIn(profileSamples),
      `contrast failures in ${theme}, profile sheet:\n${failuresIn(profileSamples).join('\n')}`
    ).toEqual([])
  })
}

/**
 * agent-onboarding (AO-R5). The agent picker lives inside the profile sheet,
 * so the sweep at the top of this file never sees it — same reason the two
 * surfaces above needed their own test. What is new here is the scan strip and
 * three *different* card shapes in one list: a detected agent (version as
 * evidence), an installable one (command + primary button + quiet docs link),
 * and a vendor-install one (dashed, docs link only).
 *
 * The transient install states — running and failed — are deliberately **not**
 * driven here. Clicking "Instalar" runs a real `npm install -g` on whatever
 * machine runs this suite; a contrast assertion is not worth mutating a global
 * npm prefix and reaching the network for. Those two states are measured
 * instead by `tools/visual/agent-setup.mjs`, which drives them from a mocked
 * bridge across all three themes and needs no npm at all.
 */
for (const theme of THEMES) {
  test(`@p0 @a11y the agent picker meets WCAG AA in the ${theme} theme`, async ({ hiveApp }) => {
    const { window } = hiveApp

    await setTheme(window, theme)
    await freezeMotion(window)

    await window.getByRole('button', { name: 'Abrir configurações de perfil' }).click()
    await window.locator('.wb-agent-scan').waitFor({ state: 'visible' })

    const samples = await sampleTextContrast(window)
    expect(samples.length).toBeGreaterThan(5)
    expect(
      failuresIn(samples),
      `contrast failures in ${theme}, agent picker:\n${failuresIn(samples).join('\n')}`
    ).toEqual([])
  })
}
