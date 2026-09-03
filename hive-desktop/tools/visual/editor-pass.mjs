// Companion to tools/visual/boot.mjs — the visual + functional pass for the
// file editor: syntax colouring, the numbered gutter, the current-line wash,
// the per-line change marks, the full-width markdown preview and the
// edit ⇄ preview scroll carry (which now lands the caret, not just the
// scrollbar).
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/editor-pass.mjs
//
// Screenshots land in `.playwright-mcp/editor-<state>-<theme>.png`.
//
// The HEAD baseline is driven here rather than left to `boot.mjs`, whose
// `fileAtHead` answers with an empty string — which makes *every* line an
// addition and paints the gutter as one solid green rail. That is a true
// rendering of a false state, and it hides the thing the marks exist for:
// telling the two or three lines you touched from the rest of the file.
async (page) => {
  const shots = '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const THEMES = ['dark', 'light', 'hive']

  const MD = [
    '# Especificação do produto',
    '',
    'Este documento descreve **o que** o Hive precisa entregar e *por quê*. Ele é lido por PMs, tech leads e designers que não abrem um terminal — veja [o roadmap](https://x.dev).',
    '',
    '## Contexto',
    '',
    ...Array.from(
      { length: 8 },
      (_, i) =>
        `Parágrafo ${i + 1}: uma frase razoavelmente longa para que a coluna precise quebrar a linha em mais de uma altura de texto e o teste de rolagem valha alguma coisa.\n`
    ),
    '## Critérios de aceite',
    '',
    '- [x] O editor colore o arquivo pela própria gramática',
    '- [x] As linhas são numeradas e a linha do cursor fica marcada',
    '- [ ] A prévia ocupa a largura do painel',
    '- [ ] A rolagem sobrevive à troca de modo',
    '',
    '| Item | Estado |',
    '| --- | --- |',
    '| Editor | pronto |',
    '| Prévia | pronto |',
    '',
    '## Exemplo',
    '',
    '```ts',
    "const modelo = { id: 'opus', contexto: 200_000 } // o padrão",
    '```',
    '',
    '## Encerramento',
    '',
    'Última linha do documento, para que o fim seja reconhecível.'
  ].join('\n')

  // The same file as it is at HEAD: one line missing (an addition), one line
  // different (a modification), one line that used to be there and is not (a
  // deletion boundary). Three marks, one of each, on a file that is otherwise
  // unchanged — which is what a real edit looks like.
  const HEAD = MD.split('\n')
    .filter((line) => !line.startsWith('- [x] As linhas'))
    .map((line) => (line.startsWith('## Contexto') ? '## Panorama' : line))
    .concat([])
  HEAD.splice(HEAD.indexOf('## Exemplo'), 0, 'Um parágrafo que foi removido.', '')

  const TS = [
    '// Detecta o motor que a CLI vai usar de fato.',
    "import { readFile } from 'node:fs/promises'",
    '',
    'export interface Motor {',
    '  id: string',
    '  contexto: number',
    '  padrao?: boolean',
    '}',
    '',
    'export async function detectar(caminho: string): Promise<Motor[]> {',
    "  const bruto = await readFile(caminho, 'utf8')",
    '  const dados = JSON.parse(bruto) as { modelos?: Motor[] }',
    '  return (dados.modelos ?? []).filter((m) => m.contexto > 0)',
    '}'
  ].join('\n')

  const seed = () =>
    page.evaluate(
      ({ MD, TS, HEAD }) => {
        window.hive.readFile = (_root, path) =>
          Promise.resolve(path.endsWith('.ts') ? TS : path.endsWith('.md') ? MD : 'texto simples\n')
        window.hive.git.fileAtHead = (_root, path) =>
          Promise.resolve(path.endsWith('.md') ? HEAD : TS)
      },
      { MD, TS, HEAD: HEAD.join('\n') }
    )

  const open = async (name) => {
    await page.getByRole('treeitem', { name: new RegExp(name.replace('.', '\\.')) }).first().click()
    await page.waitForTimeout(800)
  }

  const results = []

  for (const theme of THEMES) {
    await page.reload()
    await page.waitForTimeout(1400)
    await seed()
    if (theme !== 'dark') {
      await page.locator('[aria-label^="Aparência (atual:"]').click()
      await page.waitForTimeout(200)
      await page.getByRole('menuitemradio', { name: theme === 'light' ? /Claro/ : /Hive/ }).click()
      await page.waitForTimeout(400)
    }

    // ── 1. A TypeScript file: colours + numbers ───────────────────────────
    await page.getByRole('treeitem', { name: /^src/ }).first().click()
    await page.waitForTimeout(400)
    await open('index.ts')
    await page.locator('.wb-viewer').screenshot({ path: `${shots}/editor-ts-${theme}.png` })

    // ── 2. Markdown, with the caret parked on a heading ───────────────────
    await open('README.md')
    await page.locator('.hds-editor-input').click()
    await page.evaluate(() => {
      const field = document.querySelector('.hds-editor-input')
      const at = field.value.indexOf('## Critérios')
      field.setSelectionRange(at, at)
      field.scrollTop = 0
      document.dispatchEvent(new Event('selectionchange'))
    })
    await page.waitForTimeout(300)
    // Scroll the caret's line into view so the wash is in the picture.
    await page.evaluate(() => {
      const field = document.querySelector('.hds-editor-input')
      const line = document.querySelector('.hds-editor-line[data-current]')
      field.scrollTop = Math.max(line.offsetTop - 120, 0)
      field.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await page.waitForTimeout(250)
    await page.locator('.wb-viewer').screenshot({ path: `${shots}/editor-md-${theme}.png` })

    const marks = await page.evaluate(() => {
      const counts = {}
      for (const node of document.querySelectorAll('.hds-editor-line[data-mark]')) {
        counts[node.dataset.mark] = (counts[node.dataset.mark] ?? 0) + 1
      }
      const line = document.querySelector('.hds-editor-line[data-current]')
      const wash = document.querySelector('.hds-editor-wash')
      return {
        counts,
        current: line?.textContent.slice(0, 30) ?? null,
        // The wash covers the caret's line and nothing else, at its full
        // wrapped height.
        washOnLine:
          Math.abs(wash.getBoundingClientRect().top - line.getBoundingClientRect().top) < 1 &&
          Math.abs(wash.getBoundingClientRect().height - line.getBoundingClientRect().height) < 1
      }
    })

    // ── 3. Carry: edit → preview ──────────────────────────────────────────
    const leftAt = await page.evaluate(() => {
      const field = document.querySelector('.hds-editor-input')
      field.scrollTop = Math.round((field.scrollHeight - field.clientHeight) * 0.5)
      field.dispatchEvent(new Event('scroll', { bubbles: true }))
      const blocks = [...document.querySelectorAll('.hds-editor-line')]
      const at = blocks.findIndex((n) => n.offsetTop + n.offsetHeight > field.scrollTop)
      return { line: at + 1, text: blocks[at].textContent.slice(0, 34) }
    })
    await page.waitForTimeout(200)
    await page.getByRole('radio', { name: 'Visualizar' }).click()
    await page.waitForTimeout(700)
    const preview = await page.evaluate(() => {
      const scroller = document.querySelector('.wb-viewer-scroll')
      const doc = document.querySelector('.wb-md-doc')
      const origin = scroller.getBoundingClientRect().top - scroller.scrollTop
      const atTop = [...scroller.querySelectorAll('[data-line]')]
        .map((n) => ({
          line: Number(n.dataset.line),
          top: Math.round(n.getBoundingClientRect().top - origin),
          text: n.textContent.slice(0, 34)
        }))
        .filter((a) => a.top >= scroller.scrollTop - 6 && a.top < scroller.scrollTop + 90)
      return {
        fillsPane: doc.clientWidth === scroller.clientWidth,
        paneWidth: scroller.clientWidth,
        landedOn: atTop[0] ?? null
      }
    })
    await page.locator('.wb-viewer').screenshot({ path: `${shots}/editor-preview-${theme}.png` })

    // ── 4. Carry back: the caret lands where the reader was ───────────────
    // A target that is actually reachable: past the bottom of the scroll range
    // the browser clamps, and the probe would then measure its own mistake.
    const readAt = await page.evaluate(() => {
      const scroller = document.querySelector('.wb-viewer-scroll')
      const max = scroller.scrollHeight - scroller.clientHeight
      const origin = scroller.getBoundingClientRect().top - scroller.scrollTop
      const reachable = [...scroller.querySelectorAll('[data-line]')]
        .map((n) => ({
          line: Number(n.dataset.line),
          top: Math.round(n.getBoundingClientRect().top - origin),
          text: n.textContent.slice(0, 34)
        }))
        .filter((a) => a.top > 0 && a.top <= max)
      const pick = reachable[reachable.length - 1]
      scroller.scrollTop = pick.top
      return pick
    })
    await page.waitForTimeout(250)
    await page.getByRole('radio', { name: 'Editar' }).click()
    await page.waitForTimeout(700)
    const returned = await page.evaluate(() => {
      const field = document.querySelector('.hds-editor-input')
      const blocks = [...document.querySelectorAll('.hds-editor-line')]
      const at = blocks.findIndex((n) => n.offsetTop + n.offsetHeight > field.scrollTop)
      return {
        topLine: at + 1,
        caretLine: field.value.slice(0, field.selectionStart).split('\n').length,
        focused: document.activeElement === field,
        currentIsCaretLine:
          document.querySelector('.hds-editor-line[data-current]') === blocks[at]
      }
    })
    await page.locator('.wb-viewer').screenshot({ path: `${shots}/editor-return-${theme}.png` })

    results.push({
      theme,
      marks,
      carry: {
        leftAt,
        landedOn: preview.landedOn,
        exact: preview.landedOn?.line === leftAt.line,
        fillsPane: preview.fillsPane,
        paneWidth: preview.paneWidth
      },
      back: {
        readAt,
        returned,
        exact: returned.topLine === readAt.line && returned.caretLine === readAt.line
      }
    })
  }

  const verdict = results.every(
    (r) =>
      r.marks.washOnLine &&
      Object.keys(r.marks.counts).length === 3 &&
      r.carry.exact &&
      r.carry.fillsPane &&
      r.back.exact &&
      r.back.returned.focused &&
      r.back.returned.currentIsCaretLine
  )
    ? 'PASS'
    : 'FAIL'
  return { verdict, results }
}
