// The 2026-09-13 round: the context window as a ring, and the `@` picker that
// stopped being eight rows long. Run AFTER tools/visual/boot.mjs.
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/round-2026-09-13.mjs
//
// This is a PROBE, not only a screenshot pass: the mention defect was invisible
// to the eye (the menu looked right — it was simply missing rows), so the
// assertions here read the DOM. It proves, in the built app:
//
//   1. the list holds every match, not a page of eight
//   2. exactly eight rows fit the port, and the rest are reachable by wheel
//   3. ArrowDown past the eighth row moves the highlight to the ninth and
//      scrolls it into view (it used to wrap back to the first)
//   4. the highlighted row is rendered wherever the highlight is, including
//      the very last match — windowed rendering's one real failure mode
//
// Theme is a constant INSIDE the function: this file is handed to the MCP tool
// as an expression, so a `const` at module top level breaks the parse.
async (page) => {
  const OUT = '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))

  // A workspace big enough that the old cap was doing visible damage: 60
  // matches for one query, at several depths.
  await page.evaluate(() => {
    const files = ['README.md', 'package.json', 'src/main/index.ts', 'src/renderer/app.tsx']
    for (let i = 0; i < 60; i += 1) {
      const dir = ['docs', 'docs/pesquisa', 'docs/historias', 'stories'][i % 4]
      files.push(`${dir}/prd-${String(i).padStart(2, '0')}-especificacao.md`)
    }
    window.hive.listFiles = () => Promise.resolve(files)
  })

  const composer = page.getByPlaceholder('Escreva uma mensagem…')
  await composer.click()
  await composer.fill('')
  await composer.type('veja @prd', { delay: 10 })
  await page.waitForTimeout(400)

  const menu = page.locator('.wb-mention-menu')
  const list = page.locator('.wb-mention-scroll')

  const readList = async () =>
    await page.evaluate(() => {
      const ul = document.querySelector('.wb-mention-scroll')
      if (!ul) return null
      const rows = [...ul.querySelectorAll('[role="option"]')]
      const active = ul.querySelector('[data-active]')
      const rowRect = rows[0]?.getBoundingClientRect()
      const portRect = ul.getBoundingClientRect()
      return {
        setSize: Number(rows[0]?.getAttribute('aria-setsize') ?? 0),
        rendered: rows.length,
        firstPos: Number(rows[0]?.getAttribute('aria-posinset') ?? 0),
        lastPos: Number(rows.at(-1)?.getAttribute('aria-posinset') ?? 0),
        rowHeight: rowRect ? Math.round(rowRect.height) : 0,
        portHeight: Math.round(portRect.height),
        scrollHeight: ul.scrollHeight,
        scrollTop: Math.round(ul.scrollTop),
        activeLabel: active?.getAttribute('aria-label') ?? null,
        activePos: active ? Number(active.getAttribute('aria-posinset')) : null,
        // Is the highlighted row actually inside the visible port?
        activeVisible: active
          ? active.getBoundingClientRect().top >= portRect.top - 1 &&
            active.getBoundingClientRect().bottom <= portRect.bottom + 1
          : null,
        header: document.querySelector('.wb-mention-count')?.textContent ?? null,
        maskBelow: ul.getAttribute('data-more-below') !== null,
        maxHeightHonoured: ul.clientHeight <= 260
      }
    })

  const results = []
  const assert = (name, ok, detail) => results.push({ name, ok: Boolean(ok), detail })

  // 1 — every match is in the list.
  const opened = await readList()
  assert('60 matches are all in the list (was: a page of 8)', opened.setSize === 60, opened.setSize)
  assert('header states the match count', /60/.test(opened.header ?? ''), opened.header)
  assert(
    'only the rows near the port are rendered',
    opened.rendered < 30 && opened.rendered >= 8,
    opened.rendered
  )
  assert(
    'the scrollbar reflects all 60 rows, not the rendered slice',
    Math.abs(opened.scrollHeight - 60 * opened.rowHeight) <= 2,
    { scrollHeight: opened.scrollHeight, rows: 60, rowHeight: opened.rowHeight }
  )
  assert(
    'exactly eight rows fit the port',
    Math.round(opened.portHeight / opened.rowHeight) === 8,
    { portHeight: opened.portHeight, rowHeight: opened.rowHeight }
  )
  assert('a fade says there is more below', opened.maskBelow, opened.maskBelow)
  // The spacer is padding, and `box-sizing: border-box` means a box can never
  // be shorter than its own padding: with both on one element the port simply
  // ignored `max-height` and drew the whole list (1536px measured).
  assert(
    'the port honours its own max-height (padding does not inflate it)',
    opened.maxHeightHonoured,
    opened.portHeight
  )

  await page.screenshot({
    path: `${OUT}/mention-full-${theme}.png`,
    clip: await menu.boundingBox()
  })

  // 2 — nine ArrowDowns: the ninth row, not the first.
  for (let i = 0; i < 9; i += 1) await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(250)
  const arrowed = await readList()
  assert('ArrowDown past the eighth reaches the ninth (was: wrapped to 1)', arrowed.activePos === 10, arrowed.activePos)
  assert('and the port followed it', arrowed.scrollTop > 0, arrowed.scrollTop)
  assert('the highlighted row is on screen', arrowed.activeVisible, arrowed.activeVisible)

  await page.screenshot({
    path: `${OUT}/mention-arrowed-${theme}.png`,
    clip: await menu.boundingBox()
  })

  // 3 — the wheel reaches the bottom, and the last row still renders.
  await list.hover()
  await page.mouse.wheel(0, 4000)
  await page.waitForTimeout(300)
  const scrolled = await readList()
  assert(
    'the wheel reaches the end of the match set',
    scrolled.lastPos === 60,
    { lastPos: scrolled.lastPos }
  )

  await page.screenshot({
    path: `${OUT}/mention-bottom-${theme}.png`,
    clip: await menu.boundingBox()
  })

  // 4 — the last match is selectable, which is the whole user-visible promise.
  const lastRow = page.locator('[role="option"]').last()
  const lastPath = await lastRow.getAttribute('aria-label')
  await lastRow.dispatchEvent('mousedown')
  await page.waitForTimeout(250)
  const value = await composer.inputValue()
  assert('the last match commits into the composer', value.includes(lastPath), { value, lastPath })

  return { theme, results }
}
