// Contrast + light/hive pass for the staged-files tray. Run AFTER
// tools/visual/boot.mjs.
//
// Walks the three themes through the real "Aparência" control (the storage key
// is re-applied by the init script on reload, so the menu is the only honest
// way to switch mid-session) and measures every text carrier the tray adds.
//
// Resolves colours by PAINTING them into a 1×1 canvas and reading the pixel,
// then composites translucent layers over the stack beneath — the two traps
// docs/visual-validation.md records: `color-mix()`/`oklch()` come back from
// getComputedStyle in forms a naive parser reads as near-black, and dividing
// out the alpha of a 10%-opacity tint explodes it to near-white.
async (page) => {
  const OUT = '/home/gustavobgt/user-harness/hive/.playwright-mcp'

  const stage = async () => {
    await page.evaluate(() => {
      window.hive.agent.chooseAttachments = () =>
        Promise.resolve([
          {
            path: '/home/gustavo/Downloads/especificacao-tecnica-plataforma-v3-final.docx',
            name: 'especificacao-tecnica-plataforma-v3-final.docx',
            size: 184320
          },
          {
            path: '/home/gustavo/Downloads/dashboard-metricas.png',
            name: 'dashboard-metricas.png',
            size: 2411724
          },
          { path: '/home/gustavo/Downloads/metricas-q3.xlsx', name: 'metricas-q3.xlsx', size: 51200 }
        ])
    })
    if ((await page.locator('.wb-composer-chip').count()) === 0) {
      await page.getByRole('button', { name: 'Anexar arquivos' }).click()
      await page.getByPlaceholder('Escreva uma mensagem…').fill('compara com a especificação')
    }
    await page.waitForTimeout(300)
  }

  const measure = () =>
    page.evaluate(() => {
      const paint = (css) => {
        const c = document.createElement('canvas')
        c.width = c.height = 1
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = css
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        // NOT premultiply-corrected on purpose: dividing by alpha is the trap.
        return { r, g, b, a: a / 255 }
      }
      const over = (top, bottom) => ({
        r: top.r + (bottom.r - top.r) * (1 - top.a),
        g: top.g + (bottom.g - top.g) * (1 - top.a),
        b: top.b + (bottom.b - top.b) * (1 - top.a),
        a: 1
      })
      // The opaque stack under an element: walk up until a background paints
      // solid, compositing every translucent tint on the way down.
      const backdrop = (el) => {
        const layers = []
        for (let node = el; node; node = node.parentElement) {
          const bg = paint(getComputedStyle(node).backgroundColor)
          if (bg.a === 0) continue
          layers.push(bg)
          if (bg.a === 1) break
        }
        return layers.reduceRight((acc, layer) => (acc ? over(layer, acc) : layer), null)
      }
      const lum = ({ r, g, b }) =>
        [r, g, b]
          .map((v) => v / 255)
          .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
      const ratio = (fg, bg) => {
        const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
        return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100
      }

      const probe = (selector, label) => {
        const el = document.querySelector(selector)
        if (!el) return { label, missing: true }
        const style = getComputedStyle(el)
        // From the element itself: a pill with its own tint is read against
        // THAT tint composited over what is under it, not against the surface
        // two levels up. Measuring the parent was how the restore notice first
        // reported a number that had nothing to do with what was on screen.
        const bg = backdrop(el)
        const fg = over(paint(style.color), bg)
        const size = parseFloat(style.fontSize)
        const bold = parseInt(style.fontWeight, 10) >= 700
        const large = size >= 24 || (bold && size >= 18.66)
        const r = ratio(fg, bg)
        return { label, ratio: r, floor: large ? 3 : 4.5, passes: r >= (large ? 3 : 4.5) }
      }

      return [
        probe('.wb-attach-tray-summary', 'resumo da bandeja'),
        probe('.wb-attach-clear', 'botão Limpar'),
        probe('.wb-attach-restored', 'aviso de rascunho restaurado'),
        probe('.wb-composer-chip .hds-attachment-name', 'nome do arquivo'),
        probe('.wb-composer-chip .hds-attachment-meta', 'meta do arquivo'),
        probe('.wb-composer-chip .hds-attachment-remove', 'X de remover (ícone, piso 3:1)')
      ]
    })

  const report = {}
  for (const [label, theme] of [
    ['dark', 'Escuro Grafite'],
    ['light', 'Claro'],
    ['hive', 'Hive Escuro']
  ]) {
    // A menu left open from a previous step swallows the next click.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    await page.locator('button[aria-label^="Aparência"]').click()
    await page.waitForTimeout(250)
    await page.getByRole('menuitemradio', { name: theme, exact: false }).first().click()
    await page.waitForTimeout(400)
    await stage()

    // The restore notice only exists after a real restore; force one so it can
    // be measured in every theme rather than only where it happened to show.
    await page.evaluate(() => {
      const head = document.querySelector('.wb-attach-tray-head')
      if (head && !head.querySelector('.wb-attach-restored')) {
        const pill = document.createElement('span')
        pill.className = 'wb-attach-restored'
        pill.textContent = 'Rascunho desta conversa'
        head.insertBefore(pill, head.querySelector('.wb-attach-clear'))
      }
    })
    await page.waitForTimeout(150)

    const box = await page.locator('.wb-composer-wrap').boundingBox()
    await page.screenshot({
      path: `${OUT}/tray-${label}.png`,
      clip: { x: box.x - 14, y: box.y - 14, width: box.width + 28, height: box.height + 28 }
    })
    report[label] = await measure()
  }
  return JSON.stringify(report, null, 1)
}
