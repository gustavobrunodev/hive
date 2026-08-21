import { test, expect, launchSeededApp, waitForWorkUI } from './fixtures/workspace'
import { armScriptedAgent } from './fixtures/scriptedAgent'
import { checkContrast, WCAG_AA_LARGE, WCAG_AA_NORMAL } from '../src/renderer/src/ui/contrast'
import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
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
async function sampleTextContrast(window: Page, rootSelector = 'body'): Promise<Sample[]> {
  return window.evaluate((rootSelector) => {
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

    // Scoped on purpose: the sampler dedupes by (color, background, size,
    // weight), so a surface built from the same tokens as the shell around it
    // contributes nothing to a whole-window sweep — its text is measured, but
    // under the shell's label. Sweeping a subtree is what makes "this surface
    // was covered" a claim the test can actually make (design-studio T7.6).
    const root = document.querySelector(rootSelector) ?? document.body
    for (const element of Array.from(root.querySelectorAll('*'))) {
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
  }, rootSelector)
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
 * The Aparência menu itself. `setTheme` above opens it and immediately closes
 * it again, so the sweep of the work UI has never once measured the surface it
 * uses to get there — the M16 rule ("an on-demand surface joins the sweep in
 * the same commit"), applied to the one menu this whole spec depends on.
 *
 * It is worth its own test rather than a line in the main sweep because its
 * rows sit on `--selected-bg`, a tint: the checked option's name and hint are
 * measured against the accent wash over the menu surface, not against the menu
 * surface, and that is the exact composition this project has got wrong three
 * times (see the token lessons in docs/visual-validation.md).
 */
for (const theme of THEMES) {
  test(`@p0 @a11y the Aparência menu meets WCAG AA in the ${theme} theme`, async ({ hiveApp }) => {
    const { window } = hiveApp

    await setTheme(window, theme)
    await freezeMotion(window)

    await window.getByRole('button', { name: /^Aparência/ }).click()
    await window.locator('.wb-theme-menu').waitFor({ state: 'visible' })

    const menu = await sampleTextContrast(window, '.wb-theme-menu')
    // Not a raw count: the sampler dedupes by (color, background, size,
    // weight), so the two unchecked rows collapse into one sample each and a
    // number here would be asserting the deduper's arithmetic. What has to be
    // true is that **both roles** were measured — the option name and the hint
    // under it — which is what proves the menu had actually rendered.
    const roles = menu.map((sample) => sample.label).join('\n')
    expect(roles, `Aparência menu samples in ${theme}:\n${roles}`).toContain('wb-theme-option-name')
    expect(roles, `Aparência menu samples in ${theme}:\n${roles}`).toContain('wb-theme-option-hint')
    expect(
      failuresIn(menu),
      `contrast failures in ${theme}, Aparência menu:\n${failuresIn(menu).join('\n')}`
    ).toEqual([])

    // The check mark is a meaningful non-text indicator — it is the only thing
    // on the row that says "this is the current theme" — so it owes 3:1, and
    // against the tint it sits on rather than against the bare menu surface.
    //
    // The layer walk has to go all the way up. A first version took the row's
    // background plus its parent's and stopped: the parent is the radio group,
    // which paints nothing, so the white the canvas starts on bled through and
    // the *dark* theme reported the mark sitting on `#f8ece7`. Any probe that
    // stops before the first opaque layer is measuring a surface that is not
    // on screen.
    const mark = await window.evaluate(() => {
      const el = document.querySelector<SVGElement>(
        '.wb-theme-menu [data-state="checked"] .hds-dropdown-menu-item-check svg'
      )
      if (!el) return null
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
      const paint = (layers: string[]): string => {
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
      // Outermost first, so `paint` composites them in real paint order.
      //
      // No early exit on "the first opaque layer", deliberately. Detecting
      // opacity by string is the trap this repo has now hit twice: the app's
      // tints are authored in `oklch(... / 14%)` and `color-mix`, neither of
      // which `getComputedStyle` serializes as `rgba(…, 0.14)` — so an
      // `rgba`-shaped test read the translucent selection tint as opaque,
      // stopped there, and reported the *dark* theme's check mark sitting on
      // `#f8ece7` (coral over the canvas's own white). Collecting every layer
      // costs nothing: an opaque one painted mid-stack resets the canvas,
      // which is exactly what it does on screen.
      const layers: string[] = []
      for (let node: Element | null = el.parentElement; node; node = node.parentElement) {
        const bg = getComputedStyle(node).backgroundColor
        if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') continue
        layers.unshift(bg)
      }
      return {
        color: paint([...layers, getComputedStyle(el).color]),
        background: paint(layers)
      }
    })

    expect(mark, 'the checked row has no selection mark').not.toBeNull()
    if (mark) {
      const { ratio } = checkContrast(mark.color, mark.background)
      expect(
        ratio ?? 0,
        `${theme}: the Aparência check mark ${mark.color} on ${mark.background}`
      ).toBeGreaterThanOrEqual(WCAG_AA_LARGE)
    }

    await window.keyboard.press('Escape')
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

    // The profile sheet. voice-settings (M25) turned it into a drill-down, so
    // the index is now its own measurable surface — five rows carrying live
    // values — and the two-set summary is one click deeper.
    await window.getByRole('button', { name: 'Abrir configurações de perfil' }).click()
    await window.locator('.wb-pnav-list').waitFor({ state: 'visible' })

    const indexSamples = await sampleTextContrast(window)
    expect(indexSamples.length).toBeGreaterThan(5)
    expect(
      failuresIn(indexSamples),
      `contrast failures in ${theme}, profile index:\n${failuresIn(indexSamples).join('\n')}`
    ).toEqual([])

    await window.locator('button.wb-pnav-row[data-scope="shortcuts"]').click()
    await window.locator('.wb-profile-shortcut-sets').waitFor({ state: 'visible' })

    const profileSamples = await sampleTextContrast(window)
    // A lower floor than the index above, and deliberately so: the sampler
    // deduplicates by (colour, background, size, weight), and this detail is
    // eight text runs drawn from five distinct token combinations (L-DS-6).
    // "Did the surface open?" is asserted by the `waitFor` a line up, which
    // fails with a timeout rather than with a quiet zero; this only guards the
    // case where everything present is `aria-hidden` and the sweep skips it.
    expect(profileSamples.length).toBeGreaterThan(0)
    expect(
      failuresIn(profileSamples),
      `contrast failures in ${theme}, profile shortcuts:\n${failuresIn(profileSamples).join('\n')}`
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
    // voice-settings (M25): one drill-down deep — the sheet opens on its index.
    await window.locator('button.wb-pnav-row[data-scope="agents"]').click()
    await window.locator('.wb-agent-scan').waitFor({ state: 'visible' })

    const samples = await sampleTextContrast(window)
    expect(samples.length).toBeGreaterThan(5)
    expect(
      failuresIn(samples),
      `contrast failures in ${theme}, agent picker:\n${failuresIn(samples).join('\n')}`
    ).toEqual([])
  })
}

/**
 * voice-settings (M25). "Voz e transcrição" is the profile's newest scope and
 * the home of the one setting shared by both surfaces that transcribe. Three
 * things on it are unusual enough to be worth a real-app sweep rather than
 * only the mocked one in `tools/visual/profile-voice-pass.mjs`:
 *
 * - the **hardware readout**, whose figures come from the actual probe on the
 *   machine running the suite (a fixture cannot prove the real `app.getGPUInfo`
 *   path renders at all);
 * - the **radio rows**, which sit on `--selected-bg` when checked — the accent
 *   tint that has produced a contrast failure in three previous milestones;
 * - the **downloadable catalog**, expanded here, whose rows carry a `--muted`
 *   size figure against the same surface.
 *
 * Nothing is downloaded: the sweep opens the disclosure and measures it. The
 * `Baixar` buttons reach the network on click, which a contrast assertion has
 * no business doing.
 */
for (const theme of THEMES) {
  test(`@p0 @a11y the transcription-model scope meets WCAG AA in the ${theme} theme`, async ({
    hiveApp
  }) => {
    const { window } = hiveApp

    await setTheme(window, theme)
    await freezeMotion(window)

    await window.getByRole('button', { name: 'Abrir configurações de perfil' }).click()
    await window.locator('button.wb-pnav-row[data-scope="voice"]').click()
    await window.locator('.wb-mdl-list').waitFor({ state: 'visible' })

    const chooserSamples = await sampleTextContrast(window)
    expect(chooserSamples.length).toBeGreaterThan(5)
    expect(
      failuresIn(chooserSamples),
      `contrast failures in ${theme}, model chooser:\n${failuresIn(chooserSamples).join('\n')}`
    ).toEqual([])

    await window.locator('.wb-cat-toggle').click()
    await window.locator('.wb-cat-rows').waitFor({ state: 'visible' })

    const catalogSamples = await sampleTextContrast(window)
    expect(
      failuresIn(catalogSamples),
      `contrast failures in ${theme}, model catalog:\n${failuresIn(catalogSamples).join('\n')}`
    ).toEqual([])
  })
}

/**
 * design-studio (DS-R18, T7.6). The Bancada is a tab in the viewer pane, so an
 * idle work UI never contains it — same reason the four surfaces above needed
 * their own tests. It is opened from the palette over a seeded UX Spec, and
 * swept in the band the tab actually opens in: the viewer pane is ~44% of the
 * window, which is the *narrowest* of §3.8's three, so the Telas are in the
 * toolbar and the Árvore is one drawer away.
 *
 * The Preview itself is deliberately out of scope here: its contents come from
 * the design system inside a sandboxed frame, and this sweep measures the app's
 * own chrome. `tools/visual/design-studio.mjs` covers the states this cannot
 * reach without an agent (a turn in flight, a failed turn, the export report).
 */
const STUDIO_SPEC_PATH = 'docs/ux-spec.md'

for (const theme of THEMES) {
  test(`@p0 @a11y the Design Studio meets WCAG AA in the ${theme} theme`, async ({
    seeded,
    hiveApp
  }) => {
    const { window } = hiveApp
    fs.mkdirSync(path.join(seeded.workspace, 'docs'), { recursive: true })
    fs.writeFileSync(
      path.join(seeded.workspace, STUDIO_SPEC_PATH),
      '# Spec de UX\n\n## Tela — Login\n\nEntrar.\n\n## Tela — Cadastro\n\nCriar conta.\n',
      'utf-8'
    )

    await setTheme(window, theme)

    await window.keyboard.press('Control+p')
    await window.getByLabel(`Abrir ${STUDIO_SPEC_PATH} no Design Studio`).click()
    // The palette is a modal, and a modal `aria-hidden`s the rest of the app
    // while it is up. The sweep skips anything under `aria-hidden` on purpose
    // (decorative glyphs), so sampling before the palette has finished closing
    // measures the palette and reports the Studio as covered — a green that
    // means nothing. Wait for it to be gone.
    await expect(window.locator('[role="dialog"]')).toHaveCount(0)
    await window.locator('.wb-dstudio').waitFor({ state: 'visible', timeout: 30_000 })
    await window.locator('.wb-dstudio-bench').waitFor({ state: 'visible' })
    await freezeMotion(window)

    const stage = await sampleTextContrast(window, '.wb-dstudio')
    expect(stage.length).toBeGreaterThan(2)
    expect(
      failuresIn(stage),
      `contrast failures in ${theme}, Design Studio stage:\n${failuresIn(stage).join('\n')}`
    ).toEqual([])

    // The Árvore and the Inspetor, which in this band are behind a drawer —
    // the surfaces a sweep of the resting tab would never see (the M16 rule).
    await window.getByRole('button', { name: 'Abrir a Árvore' }).click()
    await window.locator('.wb-dstudio-drawer').waitFor({ state: 'visible' })
    const tree = await sampleTextContrast(window, '.wb-dstudio-drawer')
    expect(tree.length).toBeGreaterThan(1)
    expect(
      failuresIn(tree),
      `contrast failures in ${theme}, Árvore drawer:\n${failuresIn(tree).join('\n')}`
    ).toEqual([])
    await window.keyboard.press('Escape')

    await window.getByRole('button', { name: 'Abrir o Inspetor' }).click()
    await window.locator('.wb-dstudio-drawer').waitFor({ state: 'visible' })
    const inspector = await sampleTextContrast(window, '.wb-dstudio-drawer')
    expect(inspector.length).toBeGreaterThan(1)
    expect(
      failuresIn(inspector),
      `contrast failures in ${theme}, Inspetor drawer:\n${failuresIn(inspector).join('\n')}`
    ).toEqual([])
    await window.keyboard.press('Escape')

    // The export picker: a dialog, so it is the most likely of the three to
    // carry a defect all the way to a user.
    await window.getByRole('button', { name: 'Exportar' }).click()
    await window.locator('.wb-dstudio-export-dialog').waitFor({ state: 'visible' })
    const exportPicker = await sampleTextContrast(window, '.wb-dstudio-export-dialog')
    expect(exportPicker.length).toBeGreaterThan(2)
    expect(
      failuresIn(exportPicker),
      `contrast failures in ${theme}, export picker:\n${failuresIn(exportPicker).join('\n')}`
    ).toEqual([])
  })
}

/**
 * mcp-visibility. Three surfaces that the sweep at the top of this file cannot
 * reach, each for its own reason, and each one added here in the commit that
 * created it — the M16 corollary in `docs/visual-validation.md`, learned from
 * two `AgentPicker` failures that survived from M9 precisely by not being here.
 *
 *  - **the transcript's handshake row** exists only inside a turn, and only
 *    when the CLI reported a roster. So a turn is really run, through the
 *    stand-in CLI, with `mcp_servers` on its init line: the parse under test is
 *    `readMcpRoster`, and a fixture that handed the renderer a ready-made
 *    roster would prove nothing about it.
 *  - **the status bar's roster card** is hover/focus-only.
 *  - **the console's roster strip** is inside a dock that starts closed.
 *
 * One server is deliberately `failed`. Its tint, its ink and its dot are the
 * loudest colours this feature introduces and the ones most likely to fail a
 * floor — and they only render when something is actually broken.
 */
for (const theme of THEMES) {
  test(`@p0 @a11y the MCP roster surfaces meet WCAG AA in the ${theme} theme`, async ({
    seeded
  }) => {
    const agent = armScriptedAgent(seeded, {
      chunks: ['Vou usar o Playwright.'],
      mcpServers: [
        { name: 'playwright', status: 'connected' },
        { name: 'pencil', status: 'connected' },
        { name: 'quebrado', status: 'failed' }
      ],
      mcpTools: [
        'mcp__playwright__browser_navigate',
        'mcp__playwright__browser_take_screenshot',
        'mcp__pencil__execute'
      ]
    })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)
    await setTheme(window, theme)

    await window
      .getByPlaceholder(/Escreva/)
      .first()
      .fill('use o playwright')
    await window.getByRole('button', { name: 'Enviar' }).click()

    // The row only exists if the roster survived the whole path: the CLI's
    // stdout, `readMcpRoster`, the `mcp` event, IPC, and the turn's timeline.
    await window.locator('.wb-mcpturn').waitFor({ state: 'visible', timeout: 30_000 })
    await freezeMotion(window)

    const turnRow = await sampleTextContrast(window, '.wb-mcpturn')
    expect(turnRow.length).toBeGreaterThan(1)
    expect(
      failuresIn(turnRow),
      `contrast failures in ${theme}, MCP handshake row:\n${failuresIn(turnRow).join('\n')}`
    ).toEqual([])

    // The status bar's roster card — focus, not hover, so the keyboard path is
    // the one measured.
    await window.locator('.wb-status-mcp').focus()
    await window.locator('.wb-status-mcp-card-list').waitFor({ state: 'visible' })
    const card = await sampleTextContrast(window, '.wb-status-mcp-card')
    expect(card.length).toBeGreaterThan(2)
    expect(
      failuresIn(card),
      `contrast failures in ${theme}, MCP roster card:\n${failuresIn(card).join('\n')}`
    ).toEqual([])

    // The console's strip, which is present whether or not any log line is.
    await window.keyboard.press('Control+Shift+M')
    await window.locator('.wb-mcplog-strip').waitFor({ state: 'visible' })
    const strip = await sampleTextContrast(window, '.wb-mcplog-strip')
    expect(strip.length).toBeGreaterThan(1)
    expect(
      failuresIn(strip),
      `contrast failures in ${theme}, MCP roster strip:\n${failuresIn(strip).join('\n')}`
    ).toEqual([])

    // The dots carry state redundantly with the words beside them, but they are
    // still meaningful non-text and owe 3:1.
    //
    // Resolved by painting a pixel rather than read off `getComputedStyle`:
    // these dots are `--success`/`--danger`, which are authored in `oklch()`
    // and come back verbatim. `checkContrast`'s parser returns "could not
    // measure" for that — which this assertion would have read as a ratio of
    // zero and failed on, and a laxer one would have read as a pass. Painting
    // resolves any colour syntax the browser accepts
    // (docs/visual-validation.md, M15).
    const dots = await window.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const resolve = (value: string): string => {
        if (ctx === null) return value
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000'
        ctx.fillStyle = value
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
        return `rgb(${r}, ${g}, ${b})`
      }
      const read = (selector: string): [string, string] | null => {
        const node = document.querySelector(selector)
        if (node === null) return null
        const background = getComputedStyle(node.parentElement ?? node).backgroundColor
        return [resolve(getComputedStyle(node).backgroundColor), resolve(background)]
      }
      return {
        connected: read('.wb-mcplog-pill[data-state="connected"] .wb-mcplog-pill-dot'),
        failed: read('.wb-mcplog-pill[data-state="failed"] .wb-mcplog-pill-dot')
      }
    })
    // A selector that stopped matching would skip silently and pass vacuously.
    expect(Object.values(dots).filter((pair) => pair !== null).length).toBe(2)
    for (const [name, pair] of Object.entries(dots)) {
      if (pair === null) continue
      const result = checkContrast(pair[0], pair[1])
      expect(
        result.ratio ?? 0,
        `MCP ${name} dot in ${theme}: ${pair[0]} on ${pair[1]}`
      ).toBeGreaterThanOrEqual(WCAG_AA_LARGE)
    }

    await app.close()
  })
}

/**
 * Text selection (`::selection`) — the one paint job no other sweep in this
 * file can see.
 *
 * Every test above measures a *resting* surface. Selection is a state the user
 * puts a surface into, and the DS shipped one global rule
 * (`background: var(--accent)`) for all of them — so on the one surface that is
 * itself `--accent`, the user's own chat bubble, dragging across your message
 * painted coral on coral. Measured: `rgb(204,121,88)` on both sides, a ratio of
 * 1.00:1. Nothing about that is visible in a screenshot of the resting state,
 * in a unit test, or in the CSS, which reads perfectly sensibly.
 *
 * Two floors, because a selection has two jobs (and only the second one caught
 * this bug):
 *   - the selected text must stay readable on the highlight (4.5:1);
 *   - the highlight must be distinguishable from the surface it lands on
 *     (3:1, the non-text floor) — otherwise there is no selection to read.
 *
 * The pair is read off the originating element, never off `:root`: `::selection`
 * resolves `var()` against the element it applies to, and per-surface overrides
 * of `--selection-bg`/`--selection-ink` are the entire mechanism under test.
 * Reading the root would measure the default three times and report a pass.
 */
for (const theme of THEMES) {
  test(`@p0 @a11y text selection meets WCAG AA in the ${theme} theme`, async ({ seeded }) => {
    const agent = armScriptedAgent(seeded, { chunks: ['Claro, começo pelo escopo do PRD.'] })
    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)
    await setTheme(window, theme)

    // A real turn, because two of the four surfaces (the user's bubble and the
    // agent's reply) do not exist until a message has been exchanged.
    await window
      .getByPlaceholder(/Escreva/)
      .first()
      .fill('preciso de um PRD para pagamentos recorrentes')
    await window.getByRole('button', { name: 'Enviar' }).click()
    await window
      .locator('.hds-chat-message-user .hds-chat-message-bubble')
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
    await window.locator('.wb-chat-md').first().waitFor({ state: 'visible', timeout: 30_000 })
    await freezeMotion(window)

    const SURFACES: Array<{ key: string; selector: string }> = [
      { key: 'a mensagem do usuário', selector: '.hds-chat-message-user .hds-chat-message-bubble' },
      { key: 'a resposta do agente', selector: '.wb-chat-md' },
      { key: 'o compositor', selector: '.hds-prompt-input textarea' },
      { key: 'uma linha da árvore', selector: '.wb-tree-row-content .hds-tree-label-text' }
    ]

    const measured = await window.evaluate((surfaces) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const paint = (value: string): string | null => {
        if (ctx === null || value === '' || value === 'transparent') return null
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000'
        ctx.fillStyle = value
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        // Composited over white/black is wrong for a translucent value, so the
        // alpha is returned and the caller composites over the real backdrop.
        return `rgba(${r}, ${g}, ${b}, ${a / 255})`
      }
      return surfaces.map(({ key, selector }) => {
        const node = document.querySelector(selector)
        if (node === null) return { key, selector, missing: true as const }
        const style = getComputedStyle(node)
        // Walk up to the nearest opaque paint — the element itself is usually
        // transparent, and a highlight measured against `transparent` is
        // meaningless.
        let backdrop = 'rgb(255, 255, 255)'
        for (let el: Element | null = node; el; el = el.parentElement) {
          const painted = getComputedStyle(el).backgroundColor
          if (painted && painted !== 'transparent' && !/,\s*0\s*\)$/.test(painted)) {
            backdrop = painted
            break
          }
        }
        return {
          key,
          selector,
          missing: false as const,
          highlight: paint(style.getPropertyValue('--selection-bg').trim()),
          ink: paint(style.getPropertyValue('--selection-ink').trim()),
          backdrop: paint(backdrop)
        }
      })
    }, SURFACES)

    // A surface that stopped existing would skip silently and pass vacuously —
    // exactly the failure mode this whole file was written against.
    expect(
      measured.filter((m) => m.missing).map((m) => m.selector),
      `selection surfaces missing in ${theme}`
    ).toEqual([])

    for (const surface of measured) {
      if (surface.missing) continue
      const { key, highlight, ink, backdrop } = surface
      expect(highlight, `${key}: --selection-bg did not resolve in ${theme}`).not.toBeNull()
      expect(ink, `${key}: --selection-ink did not resolve in ${theme}`).not.toBeNull()
      if (highlight === null || ink === null || backdrop === null) continue

      const onSurface = checkContrast(highlight, backdrop)
      expect(
        onSurface.ratio ?? 0,
        `${key} in ${theme}: the highlight ${highlight} is indistinguishable from ${backdrop} —` +
          ' selecting the text would change nothing on screen'
      ).toBeGreaterThanOrEqual(WCAG_AA_LARGE)

      const onHighlight = checkContrast(ink, highlight)
      expect(
        onHighlight.ratio ?? 0,
        `${key} in ${theme}: selected text ${ink} on ${highlight}`
      ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
    }

    await app.close()
  })
}
