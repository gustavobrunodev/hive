import fs from 'node:fs'
import path from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import {
  test,
  expect,
  launchSeededApp,
  waitForWorkUI,
  type SeededWorkspace
} from './fixtures/workspace'
import { openSidebar } from './fixtures/sidebar'
import {
  activeDesignPage,
  designRow,
  goToPage,
  openDesignStudio,
  seedHiveConversations,
  seedModuleConversation
} from './fixtures/designStudio'

/**
 * Design Studio — the module inside the Hive (task A), in the real Electron app.
 *
 * Everything here is a claim only the real layout, the real Electron or the
 * real restart can answer: scroll positions, computed styles, the keyboard's
 * focus order, and what survives closing the app. The component suites
 * (`WorkUI.test.ts`, `designStudio/*.test.ts`) own the copy and the structure.
 *
 * Lote 1 wrote this file. C7a and C8b sweep the pages this lote built — the
 * navigation and the five page frames — and later lotes add their own pages to
 * the scene tables below (folha da Dor, Leitura, Gráficos, the chat field).
 */

const YEAR = new Date().getFullYear()

/** The picker's label for each theme, to click the right entry. */
const THEME_LABEL = { dark: 'Escuro', light: 'Claro' } as const
type ModuleTheme = keyof typeof THEME_LABEL

/** Through the real picker — setting `data-theme` by hand leaves React's theme behind (contrast.spec.ts). */
async function setTheme(window: Page, theme: ModuleTheme): Promise<void> {
  const current = await window.evaluate(
    () => document.documentElement.getAttribute('data-theme') ?? 'dark'
  )
  if (current === theme) return
  await window.getByRole('button', { name: /^Escolha do tema/ }).click()
  await window.getByRole('menuitemradio', { name: new RegExp(`^${THEME_LABEL[theme]}`) }).click()
  await expect(window.locator(`:root[data-theme="${theme}"]`)).toHaveCount(1)
  await window.keyboard.press('Escape')
}

/** Launches against `seeded` and waits for the work UI, sidebar open on Chat & Cowork. */
async function launch(
  seeded: SeededWorkspace
): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await launchSeededApp(seeded)
  const window = await app.firstWindow()
  await waitForWorkUI(window)
  await openSidebar(window, 'chat')
  return { app, window }
}

/** Two demands in this year's R2 and one in last year's R1 — two years, so one of them starts folded. */
function seedInitiatives(seeded: SeededWorkspace): void {
  const current = path.join(seeded.workspace, 'docs', 'iniciativas', 'R2', 'portal-de-cobranca')
  fs.mkdirSync(current, { recursive: true })
  fs.writeFileSync(
    path.join(current, 'iniciativa.json'),
    JSON.stringify({ title: 'Portal de Cobrança', year: YEAR, release: 'R2' })
  )
  const legacy = path.join(seeded.workspace, 'docs', 'iniciativas', 'R1', 'portal-legado')
  fs.mkdirSync(legacy, { recursive: true })
  fs.writeFileSync(
    path.join(legacy, 'iniciativa.json'),
    JSON.stringify({ title: 'Portal legado', year: YEAR - 1, release: 'R1' })
  )
}

test.describe('Design Studio — entrada e navegação do módulo', () => {
  test('C3b: entering and leaving the module keeps the conversation list scroll and the expanded release', async ({
    seeded
  }) => {
    seedHiveConversations(seeded, 12)
    seedInitiatives(seeded)
    const { app, window } = await launch(seeded)
    try {
      // A window short enough that twelve rows overflow their list — the
      // claim is about a scroller, so it needs one that actually scrolls.
      await app.evaluate(({ BrowserWindow }) => {
        const main = BrowserWindow.getAllWindows()[0]
        main.unmaximize()
        main.setSize(1280, 720)
      })
      const list = window.locator('.wb-chatside .wb-history-list')
      await expect(window.getByText('Conversa do Hive 12')).toBeAttached({ timeout: 15_000 })
      const extent = await list.evaluate((el) => ({
        scroll: el.scrollHeight,
        client: el.clientHeight
      }))
      expect(
        extent.scroll,
        'the conversation list must overflow for this to mean anything'
      ).toBeGreaterThan(extent.client + 40)

      // Last year starts folded; unfolding it is the state a remount would lose.
      const previousYear = window.getByRole('treeitem', { name: new RegExp(`^${YEAR - 1}`) })
      await previousYear.click()
      const release = window.getByRole('treeitem', { name: /^R1/ })
      await expect(release).toHaveAttribute('aria-expanded', 'true')

      const target = Math.min(120, extent.scroll - extent.client)
      await list.evaluate((el, top) => {
        el.scrollTop = top
      }, target)
      const before = await list.evaluate((el) => el.scrollTop)
      expect(before).toBeGreaterThan(0)

      await designRow(window).click()
      await expect.poll(() => activeDesignPage(window)).toBe('inicio')
      await designRow(window).click()
      await expect.poll(() => activeDesignPage(window)).toBeNull()

      const after = await list.evaluate((el) => el.scrollTop)
      expect(Math.abs(after - before)).toBeLessThanOrEqual(1)
      await expect(previousYear).toHaveAttribute('aria-expanded', 'true')
      await expect(release).toHaveAttribute('aria-expanded', 'true')
    } finally {
      await app.close()
    }
  })

  test('C5b: closing and reopening the Hive with the module in front reopens on the module home', async ({
    seeded
  }) => {
    const first = await launch(seeded)
    await openDesignStudio(first.window)
    // Elsewhere in the module first: the restart must land on the home, not
    // wherever the module was left (criterion 5 — and no route is persisted).
    await goToPage(first.window, 'Dores')
    await expect.poll(() => activeDesignPage(first.window)).toBe('dores')
    await expect
      .poll(() => first.window.evaluate(() => window.localStorage.getItem('hive.workspaceSession')))
      .toContain('"workView":"design"')
    await first.app.close()

    const second = await launchSeededApp(seeded)
    try {
      const window = await second.firstWindow()
      await window.locator('.wb-navbar').waitFor({ state: 'visible', timeout: 45_000 })
      await expect.poll(() => activeDesignPage(window), { timeout: 15_000 }).toBe('inicio')
      await expect(
        window.locator('.wb-work-layer[data-view="design"][data-active] [data-page="inicio"] h1')
      ).toBeVisible()
      await expect(designRow(window)).toHaveAttribute('aria-current', 'true')
    } finally {
      await second.close()
    }
  })

  /**
   * C7a, over what lote 1 built: the entry row, the module's navigation and the
   * page frames. Each page row of `PAGE_SCENES` is swept for its own controls;
   * lote 1's frames carry none yet, so their rows assert that nothing on them
   * is out of reach. Lotes 2 and 3 add the folha da Dor, Leitura, Gráficos and
   * the chat field to this table, with the segmented control's and the weekly
   * line's arrow keys.
   */
  test('C7a: every module control is reachable by Tab, shows a focus indicator, and answers Enter and Space', async ({
    seeded
  }) => {
    seedModuleConversation(seeded, 'Câmbio', 'Por que o estorno não avisa o cliente?', 4)
    seedModuleConversation(seeded, 'Pix', 'Compare as três Fontes', 90)
    const { app, window } = await launch(seeded)
    try {
      // The entry row: Enter and Space are the native button's, in the real app.
      // Reached by Tab from "+ Novo", as a keyboard user gets there — a
      // programmatic focus after the pointer's last click would not count as
      // keyboard focus, and `:focus-visible` would rightly stay off.
      const row = designRow(window)
      await window.getByRole('button', { name: 'Novo — iniciar uma nova conversa' }).focus()
      await window.keyboard.press('Tab')
      await expect(row).toBeFocused()
      expect(await hasFocusIndicator(window)).toBe(true)
      await window.keyboard.press('Enter')
      await expect.poll(() => activeDesignPage(window)).toBe('inicio')
      await window.keyboard.press('Space')
      await expect.poll(() => activeDesignPage(window)).toBeNull()
      await window.keyboard.press('Enter')
      await expect.poll(() => activeDesignPage(window)).toBe('inicio')
      await expect(window.locator('.ds-recente')).toHaveCount(2)

      // The navigation: Tab from the entry row reaches every control in it.
      await designRow(window).focus()
      const nav = await tabSweep(window, '.ds-nav')
      expect(nav.expected.length).toBe(5) // Início, Dores, Relatórios + two Recentes rows
      expect(nav.reached).toEqual(nav.expected)
      expect(nav.withoutIndicator).toEqual([])

      // …and every one of them answers both keys.
      const unanswered = await keyActivation(window, '.ds-nav')
      expect(unanswered).toEqual([])

      for (const scene of PAGE_SCENES) {
        await scene.go(window)
        await expect.poll(() => activeDesignPage(window)).toBe(scene.page)
        await designRow(window).focus()
        const sweep = await tabSweep(
          window,
          `.wb-work-layer[data-view="design"] [data-page="${scene.page}"][data-active]`
        )
        expect(sweep.reached, `${scene.page}: controls Tab never reached`).toEqual(sweep.expected)
        expect(sweep.withoutIndicator, `${scene.page}: focus with no indicator`).toEqual([])
      }
    } finally {
      await app.close()
    }
  })

  /**
   * C8b — the prototype's own orange and fonts appear nowhere the module paints,
   * in either theme, on any page this lote built. Lotes 2 and 3 add their pages
   * (and the folha, the menus and Gráficos) to `PAGE_SCENES`.
   */
  test('C8b: no computed style in the module carries the prototype orange, Geist or Bricolage Grotesque', async ({
    seeded
  }) => {
    seedModuleConversation(seeded, 'Câmbio', 'Por que o estorno não avisa o cliente?', 4)
    const { app, window } = await launch(seeded)
    try {
      for (const theme of ['light', 'dark'] as const) {
        await setTheme(window, theme)
        await openDesignStudio(window)
        for (const scene of PAGE_SCENES) {
          await scene.go(window)
          await expect.poll(() => activeDesignPage(window)).toBe(scene.page)
          const report = await prototypeLeaks(window)
          expect(report.scanned, `${theme}/${scene.page}: nothing was scanned`).toBeGreaterThan(20)
          expect(report.leaks, `${theme}/${scene.page}`).toEqual([])
        }
      }
    } finally {
      await app.close()
    }
  })
})

/** The module pages this lote can reach, and how. The Relatório page has no way in until lote 2's links. */
const PAGE_SCENES: Array<{ page: string; go: (window: Page) => Promise<void> }> = [
  { page: 'inicio', go: (window) => goToPage(window, 'Início') },
  { page: 'dores', go: (window) => goToPage(window, 'Dores') },
  { page: 'relatorios', go: (window) => goToPage(window, 'Relatórios') },
  {
    page: 'conversa',
    go: async (window) => {
      await window.locator('.ds-recente').first().click()
    }
  }
]

/** Whether the focused element paints a focus indicator: an outline, or a ring drawn with box-shadow. */
async function hasFocusIndicator(window: Page): Promise<boolean> {
  return window.evaluate(() => {
    const el = document.activeElement
    if (!el) return false
    const style = getComputedStyle(el)
    return style.outlineStyle !== 'none' || style.boxShadow !== 'none'
  })
}

/**
 * Presses Tab from wherever focus is, up to 60 times, and reports which of the
 * region's visible controls it landed on — and any it landed on with no focus
 * indicator. Controls are tagged first so identity survives re-renders.
 */
async function tabSweep(
  window: Page,
  region: string
): Promise<{ expected: string[]; reached: string[]; withoutIndicator: string[] }> {
  const expected = await window.evaluate((selector) => {
    const root = document.querySelector(selector)
    if (!root) return []
    const candidates = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="tab"], [role="menuitem"], [role="slider"]'
      )
    )
    const visible = candidates.filter((el) => {
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        !(el as HTMLButtonElement).disabled
      )
    })
    visible.forEach((el, index) => el.setAttribute('data-c7a', `${selector}#${index}`))
    return visible.map((el) => el.getAttribute('data-c7a') as string)
  }, region)

  const reached = new Set<string>()
  const withoutIndicator: string[] = []
  for (let step = 0; step < 60; step += 1) {
    await window.keyboard.press('Tab')
    const focused = await window.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      const style = getComputedStyle(el)
      return {
        id: el.getAttribute('data-c7a'),
        label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
        indicator: style.outlineStyle !== 'none' || style.boxShadow !== 'none'
      }
    })
    // Tags from an earlier sweep stay on the page; only this region's count.
    if (focused?.id?.startsWith(`${region}#`)) {
      if (!reached.has(focused.id) && !focused.indicator) withoutIndicator.push(focused.label)
      reached.add(focused.id)
    }
  }
  return { expected: [...expected].sort(), reached: [...reached].sort(), withoutIndicator }
}

/**
 * Focuses each button in the region and presses Enter, then Space, recording
 * whether each press reached the button as an activation (a `click`). Returns
 * the labels of the ones that ignored a key.
 */
async function keyActivation(window: Page, region: string): Promise<string[]> {
  const count = await window.locator(`${region} button`).count()
  const unanswered: string[] = []
  for (let index = 0; index < count; index += 1) {
    const button = window.locator(`${region} button`).nth(index)
    const label = (
      (await button.getAttribute('aria-label')) ??
      (await button.textContent()) ??
      ''
    ).trim()
    for (const key of ['Enter', 'Space']) {
      await button.evaluate((el) => {
        ;(window as unknown as { __clicked: boolean }).__clicked = false
        el.addEventListener(
          'click',
          () => {
            ;(window as unknown as { __clicked: boolean }).__clicked = true
          },
          { once: true }
        )
      })
      await button.focus()
      await window.keyboard.press(key)
      const clicked = await window.evaluate(
        () => (window as unknown as { __clicked: boolean }).__clicked
      )
      if (!clicked) unanswered.push(`${label} (${key})`)
    }
  }
  return unanswered
}

/**
 * Every element — and its `::before`/`::after` — inside the module's two
 * regions, checked for the prototype's orange (`#ec7000`, and `#ff7a1a` in its
 * dark theme) and its two fonts. Colours go through a canvas round trip first:
 * the app authors in `oklch()`, and a string compare against `rgb(…)` would
 * never match a colour that is the same paint written differently.
 */
async function prototypeLeaks(window: Page): Promise<{ scanned: number; leaks: string[] }> {
  return window.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
    const hex = (value: string): string | null => {
      if (!value || value === 'none' || value === 'transparent') return null
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000000'
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      if (a === 0) return null
      return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
    }
    const forbiddenColors = new Set(['#ec7000', '#ff7a1a'])
    const forbiddenFonts = ['geist', 'bricolage grotesque']
    const properties = [
      'color',
      'backgroundColor',
      'borderTopColor',
      'borderRightColor',
      'borderBottomColor',
      'borderLeftColor',
      'fill',
      'stroke'
    ] as const

    const roots = Array.from(
      document.querySelectorAll('.ds-nav, .wb-work-layer[data-view="design"]')
    )
    const elements = roots.flatMap((root) => [root, ...Array.from(root.querySelectorAll('*'))])
    const leaks: string[] = []
    let scanned = 0
    for (const element of elements) {
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(element, pseudo)
        scanned += 1
        const where = `${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? '—'}${pseudo ?? ''}`
        for (const property of properties) {
          const raw = style[property]
          if (
            /rgb\(236, 112, 0\)|rgb\(255, 122, 26\)/.test(raw) ||
            forbiddenColors.has(hex(raw) ?? '')
          ) {
            leaks.push(`${where} ${property}: ${raw}`)
          }
        }
        const family = style.fontFamily.toLowerCase()
        if (forbiddenFonts.some((font) => family.includes(font))) {
          leaks.push(`${where} font-family: ${style.fontFamily}`)
        }
      }
    }
    return { scanned, leaks }
  })
}
