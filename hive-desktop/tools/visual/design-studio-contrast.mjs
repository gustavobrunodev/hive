// Sonda de contraste do Design Studio — qualquer tema, inclusive `hive`.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   HIVE_SIDEBAR=chat HIVE_THEME=hive node tools/visual/run-scene.mjs \
//     tools/visual/design-studio-contrast.mjs
//
// O gate da tarefa (C7b, C7c em `e2e/contrast.spec.ts`) mede claro e escuro no
// Electron real. Esta sonda mede o mesmo — texto a 4,5:1 (3:1 grande), ícones e
// marcas de "atual" a 3:1 — no tema que `HIVE_THEME` pedir, para o terceiro
// tema do app, que a tarefa trata como achado e não como critério.
//
// Lições aplicadas: cor resolvida por canvas (os tokens são `oklch()`), fundo
// composto de baixo para cima com TODAS as camadas, tema pelo menu de Aparência.
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'
  const label = { dark: 'Escuro', light: 'Claro', hive: 'Hive' }[theme]
  await page.getByRole('button', { name: /^Escolha do tema/ }).click()
  await page.getByRole('menuitemradio', { name: new RegExp(`^${label}`) }).click()
  await page.keyboard.press('Escape')
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })

  await page.getByRole('tab', { name: /Chat/ }).click()
  const row = page.getByRole('button', { name: /^(Ocultar )?Design Studio$/ })
  if ((await row.getAttribute('aria-current')) !== 'true') await row.click()
  await page.waitForSelector('.wb-work-layer[data-view="design"][data-active]')

  const measure = () =>
    page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const paint = (layers) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 1, 1)
        for (const layer of layers) {
          ctx.fillStyle = layer
          ctx.fillRect(0, 0, 1, 1)
        }
        return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
      }
      const lum = ([r, g, b]) => {
        const c = [r, g, b].map((v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
      }
      const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
        return (x + 0.05) / (y + 0.05)
      }
      const behind = (el, self) => {
        const layers = []
        for (let node = self ? el : el.parentElement; node; node = node.parentElement) {
          const bg = getComputedStyle(node).backgroundColor
          if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') layers.unshift(bg)
        }
        return layers
      }
      const shown = (el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
      }
      const out = []
      const roots = Array.from(document.querySelectorAll('.ds-nav, .wb-work-layer[data-view="design"]'))
      for (const el of roots.flatMap((root) => Array.from(root.querySelectorAll('*')))) {
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join('')
        if (!own || !shown(el) || el.closest('[aria-hidden="true"]')) continue
        const style = getComputedStyle(el)
        const layers = behind(el, true)
        const size = parseFloat(style.fontSize)
        const large = size >= 24 || (Number(style.fontWeight) >= 700 && size >= 18.66)
        const r = ratio(paint([...layers, style.color]), paint(layers))
        out.push({ kind: 'texto', what: `${el.className}: ${own.slice(0, 30)}`, r, floor: large ? 3 : 4.5 })
      }
      const entry = document.querySelector('.wb-sidebar-fixed .wb-nav-item[data-view="design"]')
      for (const svg of [...(entry ? [entry.querySelector('svg')] : []), ...document.querySelectorAll('.ds-nav svg')]) {
        if (!svg || !shown(svg)) continue
        const layers = behind(svg, false)
        const r = ratio(paint([...layers, getComputedStyle(svg).color]), paint(layers))
        const current = svg.closest('[aria-current="true"]') !== null
        out.push({ kind: current ? 'atual' : 'ícone', what: svg.closest('button')?.textContent.trim().slice(0, 30), r, floor: 3 })
      }
      return out
    })

  const report = []
  const sweep = async (scene) => {
    for (const m of await measure()) {
      const verdict = m.r >= m.floor ? '✓' : '✗'
      report.push(`${verdict} ${theme} · ${scene} · ${m.kind} · ${m.r.toFixed(2)}:1 (piso ${m.floor}) — ${m.what}`)
    }
  }
  for (const name of ['Início', 'Dores', 'Relatórios']) {
    await page.locator('.ds-nav').getByRole('button', { name, exact: true }).click()
    await sweep(name)
  }
  await page.locator('.ds-recente').first().click()
  await sweep('Conversa')
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(300)
  await sweep('Conversa, sem lateral')
  const failures = report.filter((line) => line.startsWith('✗'))
  return [`${report.length} medições, ${failures.length} reprovações`, ...failures].join('\n')
}
