// Companion to tools/visual/boot.mjs — the contrast probe for the editor's
// syntax palette (M31), plus the two geometry claims the same round can
// settle: that the rendered markdown really does span the pane at a width
// where the old reading-measure cap used to bite, and that the mirror and the
// field agree on height (they only can if they agree on wrapping).
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/editor-contrast.mjs
//
// Every one of the nine roles is *read text* and takes the 4.5:1 body floor —
// comments and punctuation included. Two lessons are baked in here:
//
//   - **The probe must be blind to nothing.** `getComputedStyle` hands back
//     `oklch()` for these tokens, and a canvas-based parser that silently
//     fails on a colour space it does not know reports "unmeasured" as
//     "passed". Every miss is therefore listed, not swallowed.
//   - **Measure the composited colour, not the declared one.** The mirror's
//     spans sit on the editor's `--bg`, which is a different ground in each of
//     the three themes, so the same token passes on one and can fail on
//     another. All three are swept.
async (page) => {
  const THEMES = ['dark', 'light', 'hive']
  const SAMPLE = [
    '// um comentário que precisa ser legível',
    "import { readFile } from 'node:fs/promises'",
    '',
    'export interface Motor {',
    '  contexto: number',
    '}',
    '',
    'export async function detectar(caminho: string): Promise<Motor[]> {',
    "  const dados = JSON.parse(await readFile(caminho, 'utf8'))",
    '  return dados.modelos ?? []',
    '}'
  ].join('\n')
  // A `.yml` and a `.tsx` between them carry the two roles no TypeScript file
  // shows — `property` (a mapping key, an attribute name) and `type` (a tag, a
  // namespace). A palette entry no sample exercises is a colour nobody
  // measured.
  const YML = ['appId: dev.hive.app', 'files:', "  - 'out/**'", 'nsis:', '  oneClick: false'].join(
    '\n'
  )
  const TSX = [
    "export const Painel = ({ titulo }: { titulo: string }) => (",
    '  <section className="painel" data-aberto>',
    '    <h1>{titulo}</h1>',
    '  </section>',
    ')'
  ].join('\n')

  const MD = [
    '# Um título',
    '',
    'Prosa com **forte**, *ênfase* e [um link](https://x.dev).',
    '',
    ...Array.from({ length: 30 }, (_, i) => `Linha ${i + 1} do corpo do documento.\n`)
  ].join('\n')

  const results = []

  for (const theme of THEMES) {
    await page.reload()
    await page.waitForTimeout(1400)
    await page.evaluate(
      ({ SAMPLE, MD, YML, TSX }) => {
        window.hive.readFile = (_root, path) => {
          if (path.endsWith('.md')) return Promise.resolve(MD)
          if (path.endsWith('.yml')) return Promise.resolve(YML)
          if (path.endsWith('.tsx')) return Promise.resolve(TSX)
          return Promise.resolve(SAMPLE)
        }
      },
      { SAMPLE, MD, YML, TSX }
    )
    if (theme !== 'dark') {
      await page.locator('[aria-label^="Aparência (atual:"]').click()
      await page.waitForTimeout(200)
      await page.getByRole('menuitemradio', { name: theme === 'light' ? /Claro/ : /Hive/ }).click()
      await page.waitForTimeout(400)
    }

    await page.getByRole('treeitem', { name: /^src/ }).first().click()
    await page.waitForTimeout(300)

    const measureOpenFile = () => page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      // Paint-and-read, not parse: the tokens are authored in `oklch()`, and a
      // regex-based parser reports the ones it cannot read as "fine".
      const rgb = (value) => {
        const text = String(value).trim()
        if (text === '' || text === 'transparent') return null
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#010203'
        ctx.fillStyle = text
        if (ctx.fillStyle === '#010203' && text !== '#010203') return null
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        return [d[0], d[1], d[2]]
      }
      const lum = (c) => {
        const [r, g, b] = c.map((ch) => {
          const v = ch / 255
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

      const mirror = document.querySelector('.hds-editor-mirror')
      const ground = rgb(getComputedStyle(document.querySelector('.hds-editor')).backgroundColor)
      const seen = new Map()
      for (const node of mirror.querySelectorAll('[data-role]')) {
        const role = node.getAttribute('data-role')
        if (seen.has(role)) continue
        const fg = rgb(getComputedStyle(node).color)
        seen.set(role, fg === null || ground === null ? null : ratio(fg, ground))
      }
      // Plain (unroled) text takes the same floor and is the baseline the
      // colours are read against.
      const plain = rgb(getComputedStyle(mirror).color)
      seen.set('plain', plain === null || ground === null ? null : ratio(plain, ground))

      const failures = []
      const unmeasured = []
      for (const [role, value] of seen) {
        if (value === null) unmeasured.push(role)
        else if (value < 4.5) failures.push(`${role} → ${value.toFixed(2)}:1`)
      }
      // ── the chrome the numbers and the marks are made of ──────────────
      // The number column is read text and takes the same 4.5:1 floor as the
      // code beside it: `--faint` has failed this exact check twice in this
      // repo, and a number nobody can read is an indent with no meaning.
      const field = document.querySelector('.hds-editor-input')
      const firstLine = mirror.querySelector('.hds-editor-line')
      const numberInk = rgb(getComputedStyle(firstLine, '::before').color)
      const number = numberInk === null || ground === null ? null : ratio(numberInk, ground)
      if (number === null) unmeasured.push('line-number')
      else if (number < 4.5) failures.push(`line-number → ${number.toFixed(2)}:1`)

      // The change bars are the only thing in this pane that says a line
      // differs from HEAD — no label repeats it — so they are indicators and
      // take the 3:1 floor.
      const marks = {}
      for (const kind of ['add', 'modified', 'deleted']) {
        const value = rgb(
          getComputedStyle(document.querySelector('.hds-editor')).getPropertyValue(
            `--editor-mark-${kind}`
          )
        )
        const measured = value === null || ground === null ? null : ratio(value, ground)
        marks[kind] = measured === null ? null : Number(measured.toFixed(2))
        if (measured === null) unmeasured.push(`mark-${kind}`)
        else if (measured < 3) failures.push(`mark-${kind} → ${measured.toFixed(2)}:1`)
      }

      // The current-line wash is not text and has no WCAG floor, but it is
      // useless if it cannot be told from the ground it sits on. Composited by
      // hand, because it is a translucent layer over `--bg`.
      const washStyle = getComputedStyle(document.querySelector('.hds-editor-wash'))
      const washed = rgb(washStyle.backgroundColor)
      const alpha = Number(washStyle.backgroundColor.match(/[\d.]+\s*\)$/)?.[0].replace(')', '')) || 1
      const over =
        washed === null || ground === null
          ? null
          : ground.map((channel, index) => channel * (1 - alpha) + washed[index] * alpha)
      const wash = over === null ? null : ratio(over, ground)
      if (wash === null) unmeasured.push('current-line')

      // The wrapping claim, measured rather than looked at: with the pane this
      // narrow at least one line must have wrapped, and every line's number is
      // pinned to the TOP of its own block — which is the whole reason the
      // mirror is built out of blocks.
      const blocks = [...mirror.querySelectorAll('.hds-editor-line')]
      const row = parseFloat(getComputedStyle(field).lineHeight)
      const wrapped = blocks.filter((node) => node.offsetHeight > row * 1.5).length

      return {
        measured: Object.fromEntries(
          [...seen].map(([role, value]) => [role, value === null ? null : Number(value.toFixed(2))])
        ),
        chrome: {
          number: number === null ? null : Number(number.toFixed(2)),
          marks,
          wash: wash === null ? null : Number(wash.toFixed(2))
        },
        failures,
        unmeasured,
        // The alignment claim: same text, same width, same wrapping ⇒ same
        // height. A mismatch here is colour sitting on the wrong words.
        mirrorMatchesField: mirror.scrollHeight === field.scrollHeight,
        // One block per source line, always — the numbering is off by one for
        // every line below the first miscount, and nothing else shows it.
        lineCount: blocks.length === field.value.split('\n').length,
        wrapped,
        numberAtLineTop: getComputedStyle(firstLine, '::before').top === '0px'
      }
    })

    // One visit per grammar; the roles union across them is what the palette
    // is actually held to.
    const code = {
      measured: {},
      chrome: null,
      failures: [],
      unmeasured: [],
      mirrorMatchesField: true,
      lineCount: true,
      numberAtLineTop: true,
      wrapped: 0
    }
    for (const file of [/index\.ts/, /electron-builder\.yml/, /app\.tsx/, /README\.md/]) {
      await page.getByRole('treeitem', { name: file }).first().click()
      await page.waitForTimeout(700)
      const round = await measureOpenFile()
      Object.assign(code.measured, round.measured)
      code.chrome = round.chrome
      code.failures.push(...round.failures)
      code.unmeasured.push(...round.unmeasured)
      code.mirrorMatchesField &&= round.mirrorMatchesField
      code.lineCount &&= round.lineCount
      code.numberAtLineTop &&= round.numberAtLineTop
      code.wrapped += round.wrapped
    }
    const covered = Object.keys(code.measured)
    const ROLES = [
      'comment',
      'keyword',
      'string',
      'number',
      'function',
      'type',
      'property',
      'punctuation',
      'heading',
      'strong',
      'emphasis',
      'link'
    ]
    const doc = { covered: covered.sort(), missing: ROLES.filter((r) => !covered.includes(r)) }

    // Wide pane: the reading-measure cap used to bite here and no longer does.
    await page.setViewportSize({ width: 1920, height: 1000 })
    await page.waitForTimeout(400)
    await page.getByRole('radio', { name: /Visualizar/ }).click()
    await page.waitForTimeout(600)
    const width = await page.evaluate(() => {
      const scroller = document.querySelector('.wb-viewer-scroll')
      const rendered = document.querySelector('.wb-md-doc')
      const style = getComputedStyle(rendered)
      return {
        pane: scroller.clientWidth,
        rendered: rendered.clientWidth,
        padding: `${style.paddingLeft} / ${style.paddingRight}`,
        // The old behaviour: capped at 86ch and centred, leaving margins.
        fillsPane: rendered.clientWidth === scroller.clientWidth
      }
    })
    await page.locator('.wb-viewer').screenshot({
      path: `/home/gustavobgt/user-harness/hive/.playwright-mcp/m31-wide-${theme}.png`
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)

    results.push({ theme, code, doc, width })
  }

  const verdict = results.every(
    (r) =>
      r.code.failures.length === 0 &&
      r.code.unmeasured.length === 0 &&
      r.code.mirrorMatchesField &&
      r.code.lineCount &&
      r.code.numberAtLineTop &&
      r.code.wrapped > 0 &&
      r.doc.missing.length === 0 &&
      r.width.fillsPane
  )
    ? 'PASS'
    : 'FAIL'
  return { verdict, results }
}
