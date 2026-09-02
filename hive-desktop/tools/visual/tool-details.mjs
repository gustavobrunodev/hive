// Visual-pass scenario for agent-tool-details — what a step was called with,
// and what it answered, disclosed under its own row.
//
// Run AFTER tools/visual/boot.mjs:
//   run_code_unsafe --filename tools/visual/tool-details.mjs
//
// Drives one settled turn and one live turn far enough that every state the
// panel can be in is on screen at once: a shell command with its real output,
// a failing command whose result IS the error, a search with a capped result,
// an MCP call with arguments this build has no translation for, a tool that
// answered with nothing, a step still running (skeleton), and an edit whose
// diff and call sit in the same disclosure.
//
// Theme is chosen by editing the constant below and is switched through the
// REAL topbar control, never localStorage — the boot init script rewrites that
// key on every navigation, so a probe that sets it measures its own default
// three times (docs/visual-validation.md).
//   theme: 'dark' | 'light' | 'hive'
async (page) => {
  const theme = 'dark'

  if (theme !== 'dark') {
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    await page.getByRole('menuitemradio', { name: { light: 'Claro', hive: 'Hive' }[theme] }).click()
    await page.waitForTimeout(250)
  }

  const type = async (text) => {
    const box = page.locator('textarea').first()
    await box.click()
    await box.fill(text)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(180)
  }

  const emit = (events) =>
    page.evaluate((list) => {
      for (const event of list) window.__agentEvent(event)
    }, events)

  const p = (key, value, block) => (block ? { key, value, block: true } : { key, value })
  const out = (text, over = {}) => ({
    text,
    lines: text === '' ? 0 : text.split('\n').length,
    ...over
  })

  // --- turn 1: settled — a command that passed, a search, an MCP call -------
  await type('Roda o gate e me diz se dá pra abrir o PR')

  await emit([
    { type: 'token', text: 'Rodo o gate completo antes de responder.\n\n' },
    {
      type: 'tool',
      name: 'Bash',
      detail: 'npm run verify',
      toolId: 'b1',
      phase: 'start',
      params: [
        p('command', 'source ~/.nvm/nvm.sh && nvm use 22.22.1 && npm run verify', true),
        p('description', 'roda typecheck + lint + testes'),
        p('timeout', '600000')
      ]
    }
  ])
  await page.waitForTimeout(1400)
  await emit([
    {
      type: 'tool',
      name: '',
      toolId: 'b1',
      phase: 'end',
      ok: true,
      output: out(
        [
          '> @gustavobrunodev/hive-desktop@0.1.0 verify',
          '> npm run typecheck && npm run lint && npm run test:coverage',
          '',
          '✓ typecheck:node',
          '✓ typecheck:web',
          '✓ lint — 0 erros, 45 avisos',
          '',
          ' Test Files  237 passed (237)',
          '      Tests  4111 passed (4111)',
          '   Duration  49.72s'
        ].join('\n')
      )
    },
    { type: 'token', text: 'Verde. Confiro se alguém ainda chama a API antiga:\n\n' },
    {
      type: 'tool',
      name: 'Grep',
      detail: 'whisper\\.(transcribe|load)',
      toolId: 'g1',
      phase: 'start',
      params: [
        p('pattern', 'whisper\\.(transcribe|load)'),
        p('path', 'src'),
        p('output_mode', 'content'),
        p('-n', 'true')
      ]
    }
  ])
  await page.waitForTimeout(900)
  await emit([
    {
      type: 'tool',
      name: '',
      toolId: 'g1',
      phase: 'end',
      ok: true,
      output: out(
        Array.from(
          { length: 26 },
          (_, i) => `src/renderer/src/voice/legacy-${i + 1}.ts:${12 + i * 3}:  whisper.transcribe(`
        ).join('\n'),
        { truncated: 1840 }
      )
    },
    {
      type: 'tool',
      name: 'mcp__playwright__browser_click',
      detail: 'Abrir o painel de voz',
      toolId: 'm1',
      phase: 'start',
      params: [p('element', 'Abrir o painel de voz'), p('ref', 'e142'), p('doubleClick', 'false')]
    }
  ])
  await page.waitForTimeout(800)
  await emit([
    { type: 'tool', name: '', toolId: 'm1', phase: 'end', ok: true, output: out('') },
    {
      type: 'token',
      text: 'O gate está verde e nada mais chama a API antiga — dá pra abrir o PR.'
    },
    {
      type: 'usage',
      final: true,
      usage: {
        inputTokens: 1_240,
        cacheReadTokens: 58_900,
        cacheCreationTokens: 12_100,
        outputTokens: 940,
        model: 'claude-opus-5',
        costUsd: 0.0611,
        durationMs: 62_400,
        apiDurationMs: 21_800
      }
    },
    { type: 'done' }
  ])
  await page.waitForTimeout(400)

  // --- turn 2: live — a failure, an edit, and a step still running ----------
  await type('Sobe o app pra eu ver')
  await emit([
    { type: 'token', text: 'Subindo o app em modo dev.\n\n' },
    {
      type: 'tool',
      name: 'Bash',
      detail: 'npm run dev',
      toolId: 'b2',
      phase: 'start',
      params: [p('command', 'npm run dev', true), p('run_in_background', 'true')]
    }
  ])
  await page.waitForTimeout(1200)
  await emit([
    {
      type: 'tool',
      name: '',
      toolId: 'b2',
      phase: 'end',
      ok: false,
      output: out(
        [
          'npm ERR! code ELIFECYCLE',
          'npm ERR! errno 1',
          '',
          'Error: EADDRINUSE: address already in use 127.0.0.1:5173',
          '    at Server.setupListenHandle [as _listen2] (node:net:1897:16)',
          '    at listenInCluster (node:net:1945:12)'
        ].join('\n')
      )
    },
    { type: 'token', text: 'A porta 5173 já está ocupada. Movo o dev server para a 5174:\n\n' },
    {
      type: 'tool',
      name: 'Edit',
      detail: '/ws/electron.vite.config.ts',
      toolId: 'e1',
      phase: 'start',
      filePath: '/ws/electron.vite.config.ts',
      params: [p('file_path', '/ws/electron.vite.config.ts')],
      patch: {
        op: 'edit',
        path: '/ws/electron.vite.config.ts',
        adds: 1,
        dels: 1,
        anchored: true,
        hunks: [
          {
            lines: [
              { type: 'ctx', text: '  renderer: {', no: 27 },
              { type: 'ctx', text: '    server: {', no: 28 },
              {
                type: 'del',
                text: '      port: 5173',
                no: 29,
                spans: [
                  { text: '      port: ', changed: false },
                  { text: '5173', changed: true }
                ]
              },
              {
                type: 'add',
                text: '      port: 5174',
                no: 29,
                spans: [
                  { text: '      port: ', changed: false },
                  { text: '5174', changed: true }
                ]
              },
              { type: 'ctx', text: '    },', no: 30 }
            ]
          }
        ]
      }
    }
  ])
  await page.waitForTimeout(900)
  await emit([
    {
      type: 'tool',
      name: '',
      toolId: 'e1',
      phase: 'end',
      ok: true,
      output: out('The file /ws/electron.vite.config.ts has been updated.')
    },
    // Left running on purpose: this is the state the panel shows as a skeleton.
    {
      type: 'tool',
      name: 'Bash',
      detail: 'npm run dev',
      toolId: 'b3',
      phase: 'start',
      params: [p('command', 'npm run dev', true), p('run_in_background', 'true')]
    }
  ])
  await page.waitForTimeout(600)

  // Open every closed row, so one screenshot carries every state at once.
  await page.evaluate(() => {
    for (const button of document.querySelectorAll('.wb-activity-open[aria-expanded="false"]')) {
      button.click()
    }
  })
  await page.waitForTimeout(600)
}
