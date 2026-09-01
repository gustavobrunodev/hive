// Visual + functional pass for live dictation (VP-R2.9) — the "transcreve
// enquanto eu falo" half of this change.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/live-dictation-pass.mjs
//
// It arms the dictation E2E seam (`e2eDictationSeam.ts`) — a stand-in
// microphone and transcriber — and then drives real audio *ticks* into the real
// segmenter. Everything above capture is production code: the segmenter, the
// live pass, the preview run, the queue, the join, the composer backdrop.
//
// What it proves, and could not be proven any other way:
//   1. text lands in the composer **while the phrase is still being spoken** —
//      before any silence, and long before the 9 s segment ceiling;
//   2. it is marked as provisional (`.wb-composer-preview`), not as arrived;
//   3. the segment's own text **replaces** it rather than doubling it, and the
//      mark goes away when it does.
//
// The seam has to be armed by an init script + a real navigation: Chat builds
// its engine in a `useMemo` at mount, so a global planted afterwards is read by
// nobody. Same reason the agent-picker probe reloads (docs/visual-validation.md).
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'

  await page.addInitScript(() => {
    window.__hiveDictationE2E = { transcript: 'estou falando agora', ticks: [], levels: [] }
    /** Feeds `ms` of audio at `rms` into every registered tick listener. */
    window.__speak = (ms, rms) => {
      const harness = window.__hiveDictationE2E
      const TICK = 512 // 32 ms at 16 kHz — the real worklet cadence
      for (let elapsed = 0; elapsed < ms; elapsed += 32) {
        const tick = { rms, samples: new Float32Array(TICK).fill(rms) }
        for (const listener of [...harness.ticks]) listener(tick)
      }
    }
    /** What the stand-in transcriber answers from now on. */
    window.__saySo = (text) => {
      window.__hiveDictationE2E.transcript = text
    }
  })

  await page.goto(`http://localhost:8123/index.html?theme=${theme}`)
  await page.waitForTimeout(1200)

  const composer = page.getByPlaceholder('Escreva uma mensagem…')
  await composer.fill('revisa o ')
  await page.getByRole('button', { name: 'Ditar' }).click()
  await page.waitForTimeout(200)

  // The room first (seeds the noise floor), then a second of speech: under the
  // 2 s `minSpeechMs` that lets a pause cut, so the segmenter has produced
  // nothing at all. Anything in the field at this point is the live pass.
  await page.evaluate(() => window.__speak(100, 0.002))
  await page.evaluate(() => window.__speak(1200, 0.4))
  await page.waitForTimeout(400)

  const midPhrase = await page.evaluate(() => ({
    value: document.querySelector('.hds-prompt-input-textarea')?.value ?? '',
    previewRuns: [...document.querySelectorAll('.wb-composer-preview')].map((el) => el.textContent),
    freshRuns: [...document.querySelectorAll('.wb-composer-fresh')].map((el) => el.textContent),
    transport: document.querySelector('.wb-dictation-status')?.innerText ?? ''
  }))

  // Measured here, while the run exists: the backdrop is `color: transparent`
  // under the real glyphs, so a rule that forgot `text-decoration-color` draws
  // nothing at all and the provisional run would be indistinguishable from
  // settled text.
  const decoration = await page.evaluate(() => {
    const el = document.querySelector('.wb-composer-preview')
    if (!el) return null
    const style = getComputedStyle(el)
    return {
      line: style.textDecorationLine,
      style: style.textDecorationStyle,
      color: style.textDecorationColor
    }
  })

  await page.screenshot({ path: `.playwright-mcp/live-dictation-${theme}-1-provisional.png` })

  // The engine changes its mind, as a real one does between a partial pass over
  // an unfinished phrase and a full pass over the finished one. Then the phrase
  // ends: 2.5 s more speech (past `minSpeechMs`) and a real pause.
  await page.evaluate(() => window.__saySo('arquivo de configuração do projeto.'))
  await page.evaluate(() => window.__speak(2500, 0.4))
  await page.evaluate(() => window.__speak(900, 0.002))
  await page.waitForTimeout(600)

  const afterSegment = await page.evaluate(() => ({
    value: document.querySelector('.hds-prompt-input-textarea')?.value ?? '',
    previewRuns: [...document.querySelectorAll('.wb-composer-preview')].map((el) => el.textContent)
  }))

  await page.screenshot({ path: `.playwright-mcp/live-dictation-${theme}-2-committed.png` })

  return { theme, midPhrase, afterSegment, decoration }
}
