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
  dataRoot,
  designRow,
  goToPage,
  openDesignStudio,
  seedHiveConversations,
  seedModuleConversation,
  seedProduto,
  skillRelatorioText,
  todayLocal
} from './fixtures/designStudio'
import { armScriptedAgent } from './fixtures/scriptedAgent'

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
    seedProduto(seeded, 'Câmbio')
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
        const region =
          scene.region ??
          `.wb-work-layer[data-view="design"] [data-page="${scene.page}"][data-active]`
        // A modal traps focus: the sweep starts inside it, never on the sidebar.
        if (!scene.region) await designRow(window).focus()
        const sweep = await tabSweep(window, region)
        // Lote 1's frames (Início, Conversa) carry no control of their own yet.
        if (!['inicio', 'conversa'].includes(scene.page)) {
          expect(sweep.expected.length, `${scene.name}: nothing to reach`).toBeGreaterThan(0)
        }
        expect(sweep.reached, `${scene.name}: controls Tab never reached`).toEqual(sweep.expected)
        expect(sweep.withoutIndicator, `${scene.name}: focus with no indicator`).toEqual([])
        expect(
          await inertKeyActivation(window, region),
          `${scene.name}: a button ignored a key`
        ).toEqual([])
        await scene.leave?.(window)
      }

      // The arrows: the segmented controls move their selection, and the
      // weekly line steps week by week (Home and End to its ends).
      await goToPage(window, 'Dores')
      const produto = window.getByRole('radiogroup', { name: 'Produto' })
      await produto.getByRole('radio', { name: 'Câmbio' }).focus()
      await window.keyboard.press('ArrowRight')
      await expect(produto.getByRole('radio', { name: 'Extrato' })).toHaveAttribute(
        'aria-checked',
        'true'
      )
      await expect(produto.getByRole('radio', { name: 'Extrato' })).toBeFocused()
      await window.keyboard.press('ArrowLeft')
      await expect(produto.getByRole('radio', { name: 'Câmbio' })).toHaveAttribute(
        'aria-checked',
        'true'
      )

      await openLeitura(window, 'Likert', 'Câmbio')
      const vistas = activeLayer(window).getByRole('radiogroup', { name: 'Visão do Relatório' })
      // The Gráficos scene left this Relatório on its charts: back to the text first.
      await vistas.getByRole('radio', { name: 'Leitura' }).click()
      await vistas.getByRole('radio', { name: 'Leitura' }).focus()
      await window.keyboard.press('ArrowRight')
      await expect(vistas.getByRole('radio', { name: 'Gráficos' })).toHaveAttribute(
        'aria-checked',
        'true'
      )
      const periodo = activeLayer(window).getByRole('radiogroup', { name: 'Período' })
      await periodo.getByRole('radio', { name: '90 dias' }).focus()
      await window.keyboard.press('ArrowRight')
      await expect(periodo.getByRole('radio', { name: '60 dias' })).toHaveAttribute(
        'aria-checked',
        'true'
      )
      await window.keyboard.press('ArrowLeft')

      const linha = activeLayer(window).getByRole('slider')
      await linha.focus()
      const ultima = await linha.getAttribute('aria-valuetext')
      await window.keyboard.press('ArrowLeft')
      const penultima = await linha.getAttribute('aria-valuetext')
      expect(penultima).not.toBe(ultima)
      await expect(activeLayer(window).locator('.hds-chart-sr')).toHaveText(penultima as string)
      await window.keyboard.press('Home')
      expect(await linha.getAttribute('aria-valuenow')).toBe('0')
      await window.keyboard.press('End')
      expect(await linha.getAttribute('aria-valuetext')).toBe(ultima)
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
    seedProduto(seeded, 'Câmbio')
    const { app, window } = await launch(seeded)
    try {
      for (const theme of ['light', 'dark'] as const) {
        await setTheme(window, theme)
        await openDesignStudio(window)
        for (const scene of PAGE_SCENES) {
          await scene.go(window)
          await expect.poll(() => activeDesignPage(window)).toBe(scene.page)
          const report = await prototypeLeaks(window)
          expect(report.scanned, `${theme}/${scene.name}: nothing was scanned`).toBeGreaterThan(20)
          expect(report.leaks, `${theme}/${scene.name}`).toEqual([])
          await scene.leave?.(window)
        }
      }
    } finally {
      await app.close()
    }
  })
})

/**
 * The module pages and surfaces the scene tables sweep, and how to reach each.
 * Lote 1 wrote the first four; lote 2 added Dores with its Relatórios in
 * place, the folha da Dor (a modal: swept inside itself, closed on leaving),
 * the Leitura and the Gráficos. Lote 3 adds the chat field and its menus.
 */
interface PageScene {
  name: string
  page: string
  go: (window: Page) => Promise<void>
  /** The region swept, when it is not the page's own layer (a modal portalled out of it). */
  region?: string
  leave?: (window: Page) => Promise<void>
}

const PAGE_SCENES: PageScene[] = [
  { name: 'Início', page: 'inicio', go: (window) => goToPage(window, 'Início') },
  {
    name: 'Dores',
    page: 'dores',
    go: async (window) => {
      await goToPage(window, 'Dores')
      await expect(activeLayer(window).locator('.hds-note').first()).toBeVisible()
    }
  },
  {
    name: 'folha da Dor',
    page: 'dores',
    region: '.ds-folha',
    go: async (window) => {
      await goToPage(window, 'Dores')
      await activeLayer(window).locator('.hds-note').first().click()
      await expect(window.getByRole('dialog')).toBeVisible()
      // Sweep from the dialog's own first stop, as the focus trap leaves it.
      await window.locator('.ds-folha .ds-icon-btn').focus()
      await window.keyboard.press('Shift+Tab')
    },
    leave: async (window) => {
      await window.keyboard.press('Escape')
      await expect(window.getByRole('dialog')).toHaveCount(0)
    }
  },
  { name: 'Relatórios', page: 'relatorios', go: (window) => goToPage(window, 'Relatórios') },
  { name: 'Leitura', page: 'relatorio', go: (window) => openLeitura(window, 'Likert', 'Câmbio') },
  {
    name: 'Gráficos',
    page: 'relatorio',
    go: async (window) => {
      await openLeitura(window, 'Likert', 'Câmbio')
      await activeLayer(window).getByRole('radio', { name: 'Gráficos' }).click()
      await expect(activeLayer(window).getByRole('slider')).toBeVisible()
    }
  },
  {
    name: 'Conversa',
    page: 'conversa',
    go: async (window) => {
      await window.locator('.ds-recente').first().click()
    }
  }
]

/** The module page on screen. */
function activeLayer(window: Page): ReturnType<Page['locator']> {
  return window.locator('.wb-work-layer[data-view="design"] [data-page][data-active]')
}

/** Opens a Relatório's Leitura from Relatórios, the way a person does. */
async function openLeitura(window: Page, fonte: string, produto: string): Promise<void> {
  await goToPage(window, 'Relatórios')
  await activeLayer(window)
    .getByRole('button', { name: `Abrir o Relatório de ${fonte} de ${produto}` })
    .click()
  await expect.poll(() => activeDesignPage(window)).toBe('relatorio')
  await expect(activeLayer(window).locator('.ds-leitura, .ds-graficos')).toBeVisible()
}

/**
 * Each button in the region, focused and pressed with Enter, then Space,
 * recording whether the browser turned the key into the button's click — with
 * the click stopped at the button, so no page navigates or dialog opens in the
 * middle of the sweep. Returns the ones that ignored a key.
 */
async function inertKeyActivation(window: Page, region: string): Promise<string[]> {
  const buttons = window.locator(`${region} button:not(:disabled)`)
  const count = await buttons.count()
  const unanswered: string[] = []
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index)
    if (!(await button.isVisible())) continue
    const label = (
      (await button.getAttribute('aria-label')) ??
      (await button.textContent()) ??
      ''
    ).trim()
    for (const key of ['Enter', 'Space']) {
      await button.evaluate((el) => {
        const w = window as unknown as { __clicked: boolean }
        w.__clicked = false
        el.addEventListener(
          'click',
          (event) => {
            w.__clicked = true
            event.stopPropagation()
            event.preventDefault()
          },
          { once: true, capture: true }
        )
      })
      await button.focus()
      await window.keyboard.press(key)
      if (!(await window.evaluate(() => (window as unknown as { __clicked: boolean }).__clicked))) {
        unanswered.push(`${label} (${key})`)
      }
    }
  }
  return unanswered
}

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
        !(el as HTMLButtonElement).disabled &&
        // A roving group (the DS segmented control) has one Tab stop; its
        // other options are reached with the arrows, asserted on their own.
        el.getAttribute('tabindex') !== '-1'
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
      document.querySelectorAll(
        '.ds-nav, .wb-work-layer[data-view="design"], .ds-folha, .ds-avisos'
      )
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

/** Sets the window's outer size, unmaximized — the layout checks are at 1440px. */
async function sizeWindow(app: ElectronApplication, width: number, height: number): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      const main = BrowserWindow.getAllWindows()[0]
      main.unmaximize()
      main.setSize(size.width, size.height)
    },
    { width, height }
  )
}

/** A rect, read off the page. */
async function rectOf(locator: ReturnType<Page['locator']>): Promise<{
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return {
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height
    }
  })
}

/** `a` precedes `b` in the document. */
async function precedes(
  a: ReturnType<Page['locator']>,
  b: ReturnType<Page['locator']>
): Promise<boolean> {
  const handle = await b.elementHandle()
  return a.evaluate(
    (first, second) =>
      (first.compareDocumentPosition(second as Node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    handle
  )
}

test.describe('Design Studio — Dados de dor e Relatórios (lote 2)', () => {
  test('C13c: end to end, the stand-in agent writes the file — it lands in <raiz>/Extrato/relatorios/likert, and Dores and Relatórios show it', async ({
    seeded
  }) => {
    const dia = todayLocal()
    const texto = skillRelatorioText('Extrato', 'likert')
    const agent = armScriptedAgent(seeded, {
      sessionId: 'ds-relatorio',
      chunks: ['Relatório gravado.'],
      writes: [{ path: `relatorios/likert/.${dia}-90d.md.parcial`, content: texto }]
    })
    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    try {
      await waitForWorkUI(window)
      await openSidebar(window, 'chat')
      await openDesignStudio(window)
      await goToPage(window, 'Dores')
      await activeLayer(window).getByRole('radio', { name: 'Extrato' }).click()
      await activeLayer(window).getByRole('button', { name: 'Gerar Relatório de Likert' }).click()

      await expect(window.getByText('Relatório de Likert pronto · 8 Dores ranqueadas')).toBeVisible(
        {
          timeout: 30_000
        }
      )
      const pasta = path.join(dataRoot(seeded), 'Extrato', 'relatorios', 'likert')
      expect(fs.readdirSync(pasta).filter((name) => !name.startsWith('.'))).toEqual([
        `${dia}-90d.md`
      ])
      // The turn ran in the Produto's folder, from a prompt that named the skill.
      const turno = agent.invocations().find((entry) => entry.kind === 'turn')
      expect(turno?.cwd).toBe(path.join(dataRoot(seeded), 'Extrato'))
      expect(turno?.prompt).toContain('relatorio-likert')

      // Dores: the Likert column shows the file's notes.
      const likert = activeLayer(window).getByRole('region', { name: 'Likert' })
      await expect(likert.locator('.hds-note').first()).toContainText(
        'Não consigo ver o histórico maior que 90 dias'
      )
      await expect(likert.locator('.hds-note')).toHaveCount(5)
      // Relatórios: the file's highlight.
      await goToPage(window, 'Relatórios')
      await expect(
        activeLayer(window)
          .getByRole('region', { name: /^Extrato/ })
          .getByText('31% das respostas com nota 1 ou 2')
      ).toBeVisible()
    } finally {
      await app.close()
    }
  })

  test('C18e: at 1440px the title and the picker share the header, "Onde dói" sits between it and the columns, the three columns are side by side and each note grid has 2 tracks', async ({
    seeded
  }) => {
    seedProduto(seeded, 'Câmbio')
    const { app, window } = await launch(seeded)
    try {
      await sizeWindow(app, 1440, 900)
      await openDesignStudio(window)
      await goToPage(window, 'Dores')
      const page = activeLayer(window)
      const header = page.locator('header').first()
      await expect(header.getByRole('heading', { level: 1, name: 'Dores de Câmbio' })).toBeVisible()
      await expect(header.getByRole('radiogroup', { name: 'Produto' })).toBeVisible()
      const title = await rectOf(header.getByRole('heading', { level: 1 }))
      const picker = await rectOf(header.getByRole('radiogroup', { name: 'Produto' }))
      expect(picker.left).toBeGreaterThan(title.right)

      const onde = page.getByRole('group', { name: 'Onde dói: telas da jornada' })
      const colunas = page.getByRole('group', { name: 'Dores por Fonte' })
      expect(await precedes(header, onde)).toBe(true)
      expect(await precedes(onde, colunas)).toBe(true)
      expect((await rectOf(onde)).top).toBeGreaterThanOrEqual((await rectOf(header)).bottom)
      expect((await rectOf(colunas)).top).toBeGreaterThanOrEqual((await rectOf(onde)).bottom)

      const rects = await Promise.all(
        ['Likert', 'Voz do Cliente', 'FullStory'].map((fonte) =>
          rectOf(page.getByRole('region', { name: fonte }))
        )
      )
      expect(new Set(rects.map((r) => Math.round(r.top))).size).toBe(1)
      expect(rects[0].left).toBeLessThan(rects[1].left)
      expect(rects[1].left).toBeLessThan(rects[2].left)
      const tracks = await page
        .locator('.ds-notas')
        .evaluateAll((grids) =>
          grids.map((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length)
        )
      expect(tracks).toEqual([2, 2, 2])
    } finally {
      await app.close()
    }
  })

  test('C21f: the folha hugs the right edge at nearly full height; header → chips → facts on one line → summary → Evidências → "Na mesma tela"; the actions sit at its foot, outside the scroller', async ({
    seeded
  }) => {
    seedProduto(seeded, 'Câmbio')
    const { app, window } = await launch(seeded)
    try {
      await sizeWindow(app, 1440, 900)
      await openDesignStudio(window)
      await goToPage(window, 'Dores')
      await activeLayer(window)
        .getByRole('region', { name: 'Voz do Cliente' })
        .locator('.hds-note')
        .first()
        .click()
      const dialog = window.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await window.waitForTimeout(400) // the slide-in settles
      const viewport = await window.evaluate(() => ({ w: innerWidth, h: innerHeight }))
      const box = await rectOf(dialog)
      expect(viewport.w - box.right).toBeLessThanOrEqual(16)
      expect(box.height).toBeGreaterThanOrEqual(viewport.h * 0.9)

      const parts = [
        dialog.locator('.ds-folha-cab'),
        dialog.locator('.ds-folha-chips'),
        dialog.locator('.ds-fatos'),
        dialog.locator('.ds-folha-resumo'),
        dialog.getByRole('region', { name: /^Evidências/ }),
        dialog.getByRole('region', { name: /^Na mesma tela/ })
      ]
      for (let i = 1; i < parts.length; i += 1)
        expect(await precedes(parts[i - 1], parts[i])).toBe(true)
      await expect(
        dialog.locator('.ds-folha-cab').getByRole('button', { name: 'Fechar' })
      ).toBeVisible()
      const fatos = await dialog
        .locator('.ds-fato')
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
      expect(fatos).toHaveLength(3)
      expect(new Set(fatos).size).toBe(1)

      const pe = dialog.locator('.ds-folha-pe')
      const corpo = dialog.locator('.ds-folha-corpo')
      expect(await corpo.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto')
      expect(await pe.evaluate((el) => el.closest('.ds-folha-corpo') === null)).toBe(true)
      await expect(pe.getByRole('button', { name: /Citar no chat/ })).toBeVisible()
      await expect(pe.getByRole('button', { name: /Perguntar ao agente/ })).toBeVisible()
      expect(Math.abs((await rectOf(pe)).bottom - box.bottom)).toBeLessThanOrEqual(1)
    } finally {
      await app.close()
    }
  })

  test('C23: Esc or "Fechar" closes the folha and hands focus back to the note that opened it', async ({
    seeded
  }) => {
    seedProduto(seeded, 'Câmbio')
    const { app, window } = await launch(seeded)
    try {
      await openDesignStudio(window)
      await goToPage(window, 'Dores')
      const notes = activeLayer(window).locator('.hds-note')
      for (const [how, index] of [
        ['Esc', 0],
        ['Fechar', 2]
      ] as const) {
        const nota = notes.nth(index)
        await nota.focus()
        await window.keyboard.press('Enter')
        const dialog = window.getByRole('dialog')
        await expect(dialog).toBeVisible()
        if (how === 'Esc') await window.keyboard.press('Escape')
        else await dialog.getByRole('button', { name: 'Fechar' }).click()
        await expect(dialog).toHaveCount(0)
        await expect(nota, `${how}: focus back on the note`).toBeFocused()
      }
    } finally {
      await app.close()
    }
  })

  test('C25b: every narrative paragraph is at most as wide as 66 "0" in its own font', async ({
    seeded
  }) => {
    seedProduto(seeded, 'Câmbio')
    const { app, window } = await launch(seeded)
    try {
      await sizeWindow(app, 1920, 1080)
      await openDesignStudio(window)
      await openLeitura(window, 'Voz do Cliente', 'Câmbio')
      const medidas = await activeLayer(window)
        .locator('.ds-narrativa p')
        .evaluateAll((paragraphs) =>
          paragraphs.map((p) => {
            const probe = document.createElement('span')
            const style = getComputedStyle(p)
            probe.style.font = style.font
            probe.style.letterSpacing = style.letterSpacing
            probe.style.position = 'absolute'
            probe.style.whiteSpace = 'nowrap'
            probe.textContent = '0'.repeat(66)
            document.body.appendChild(probe)
            const limite = probe.getBoundingClientRect().width
            probe.remove()
            return { largura: p.getBoundingClientRect().width, limite }
          })
        )
      expect(medidas.length).toBeGreaterThanOrEqual(2)
      for (const { largura, limite } of medidas) expect(largura).toBeLessThanOrEqual(limite + 0.5)
    } finally {
      await app.close()
    }
  })

  test('C25d: at 1440px the narrative card and "Dores ranqueadas" sit side by side, "Como foi feito." closes the narrative card, and the switch and "Gerar de novo" sit in a bar between the header and the cards', async ({
    seeded
  }) => {
    seedProduto(seeded, 'Câmbio')
    const { app, window } = await launch(seeded)
    try {
      await sizeWindow(app, 1440, 900)
      await openDesignStudio(window)
      await openLeitura(window, 'Likert', 'Câmbio')
      const page = activeLayer(window)
      const texto = await rectOf(page.locator('.ds-leitura-texto'))
      const ranking = await rectOf(page.locator('.ds-ranking'))
      expect(Math.round(texto.top)).toBe(Math.round(ranking.top))
      expect(texto.left).toBeLessThan(ranking.left)
      expect(
        await page.locator('.ds-leitura-texto').evaluate((card) => {
          const metodo = card.querySelector('.ds-metodo')
          const paragrafos = card.querySelectorAll('.ds-narrativa p')
          const ultimo = paragrafos[paragrafos.length - 1]
          return (
            metodo !== null &&
            card.lastElementChild === metodo &&
            (ultimo.compareDocumentPosition(metodo) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
          )
        })
      ).toBe(true)
      const barra = page.locator('.ds-relatorio-barra')
      await expect(barra.getByRole('radiogroup', { name: 'Visão do Relatório' })).toBeVisible()
      await expect(barra.getByRole('button', { name: /Gerar de novo/ })).toBeVisible()
      const cab = await rectOf(page.locator('.ds-relatorio-cab'))
      const bar = await rectOf(barra)
      expect(bar.top).toBeGreaterThanOrEqual(cab.bottom)
      expect(texto.top).toBeGreaterThanOrEqual(bar.bottom)
    } finally {
      await app.close()
    }
  })

  test('C27b: the Gráficos summary has a computed max-width of 36em', async ({ seeded }) => {
    seedProduto(seeded, 'Câmbio')
    const { app, window } = await launch(seeded)
    try {
      await openDesignStudio(window)
      await openLeitura(window, 'Likert', 'Câmbio')
      await activeLayer(window).getByRole('radio', { name: 'Gráficos' }).click()
      const { maxWidth, fontSize } = await activeLayer(window)
        .locator('.ds-graf-resumo')
        .evaluate((el) => ({
          maxWidth: getComputedStyle(el).maxWidth,
          fontSize: getComputedStyle(el).fontSize
        }))
      expect(parseFloat(maxWidth)).toBeCloseTo(36 * parseFloat(fontSize), 1)
    } finally {
      await app.close()
    }
  })

  test('C27f: filters → summary → the two chart cards → insights; at 1440px bars left of line, insights below at full width', async ({
    seeded
  }) => {
    seedProduto(seeded, 'Câmbio')
    const { app, window } = await launch(seeded)
    try {
      await sizeWindow(app, 1440, 900)
      await openDesignStudio(window)
      await openLeitura(window, 'FullStory', 'Câmbio')
      await activeLayer(window).getByRole('radio', { name: 'Gráficos' }).click()
      const page = activeLayer(window)
      const filtros = page.getByRole('group', { name: 'Filtros dos gráficos' })
      const resumo = page.locator('.ds-graf-resumo')
      const barras = page.locator('[data-chart="barras"]')
      const linha = page.locator('[data-chart="linha"]')
      const insights = page.getByRole('region', { name: 'Insights por categoria' })
      for (const [a, b] of [
        [filtros, resumo],
        [resumo, barras],
        [barras, linha],
        [linha, insights]
      ] as const) {
        expect(await precedes(a, b)).toBe(true)
      }
      const rb = await rectOf(barras)
      const rl = await rectOf(linha)
      expect(Math.round(rb.top)).toBe(Math.round(rl.top))
      expect(rb.left).toBeLessThan(rl.left)
      const ri = await rectOf(insights)
      const container = await rectOf(page.locator('.ds-graficos'))
      expect(ri.top).toBeGreaterThanOrEqual(Math.max(rb.bottom, rl.bottom))
      expect(Math.abs(ri.width - container.width)).toBeLessThanOrEqual(1)
    } finally {
      await app.close()
    }
  })

  test('C30b: in both twin tables the numeric cells are right-aligned in tabular figures', async ({
    seeded
  }) => {
    seedProduto(seeded, 'Câmbio')
    const { app, window } = await launch(seeded)
    try {
      await openDesignStudio(window)
      await openLeitura(window, 'Likert', 'Câmbio')
      await activeLayer(window).getByRole('radio', { name: 'Gráficos' }).click()
      const toggles = activeLayer(window).getByRole('button', { name: 'Ver tabela' })
      await toggles.first().click()
      await activeLayer(window).getByRole('button', { name: 'Ver tabela' }).click()
      const tabelas = activeLayer(window).locator('table.hds-chart-table')
      await expect(tabelas).toHaveCount(2)
      const celulas = await tabelas.locator('.hds-chart-num').evaluateAll((cells) =>
        cells.map((cell) => ({
          align: getComputedStyle(cell).textAlign,
          numeric: getComputedStyle(cell).fontVariantNumeric
        }))
      )
      expect(celulas.length).toBeGreaterThan(10)
      for (const celula of celulas)
        expect(celula).toEqual({ align: 'right', numeric: 'tabular-nums' })
      // The body cells are numbers.
      const corpo = await tabelas.locator('tbody td.hds-chart-num').allTextContents()
      for (const texto of corpo) expect(texto).toMatch(/^[\d.,%]+$/)
    } finally {
      await app.close()
    }
  })
})
