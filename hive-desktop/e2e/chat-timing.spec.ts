import { test, expect, launchSeededApp, waitForWorkUI } from './fixtures/workspace'
import { armScriptedAgent } from './fixtures/scriptedAgent'

/**
 * chat-timing / chat-queue / session-usage, in the real Electron app.
 *
 * The unit suites already pin the arithmetic and the reducers. What only a
 * real launch shows is the chain those readouts hang off: a stand-in binary
 * printing real `--output-format stream-json` lines → `cliAdapterCore`'s
 * parser → the `usage` event → IPC → the composer's meter. Every layer between
 * the CLI's stdout and the pixel is production code here, and a mistake in any
 * of them (a field renamed on the wire, an event the preload drops) is
 * invisible to a jsdom test that hands the renderer a hand-written event.
 */

test.describe('execution timing, queue and context (app real)', () => {
  // Numbers chosen so every readout is unambiguous on screen: 74 800 prompt
  // tokens of a 200 000 window is 37%, and no other figure here rounds to it.
  const USAGE = {
    input_tokens: 800,
    cache_read_input_tokens: 60_000,
    cache_creation_input_tokens: 14_000,
    output_tokens: 1_200,
    total_cost_usd: 0.09,
    duration_ms: 24_180,
    duration_api_ms: 21_902
  }

  test('@p1 um turno concluído mostra o recibo e a janela de contexto da sessão', async ({
    seeded
  }) => {
    const agent = armScriptedAgent(seeded, {
      chunks: ['Vou escrever o documento.', ' Pronto.'],
      writes: [{ path: 'docs/NOTA.md', content: '# Nota\n' }],
      // The step has to actually take time for its clock to say anything —
      // the rail deliberately shows nothing under a second.
      writeDelayMs: 1_600,
      usage: USAGE
    })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await window.getByPlaceholder('Escreva uma mensagem…').fill('escreva uma nota')
    await window.getByRole('button', { name: 'Enviar' }).click()

    // The receipt: the turn's own accounting, off the CLI's `result` line.
    await expect(window.locator('.wb-turn-meter').first()).toContainText('Concluído em', {
      timeout: 30_000
    })
    await expect(window.locator('.wb-turn-meter').first()).toContainText('1,2 mil tokens gerados')
    await expect(window.locator('.wb-turn-meter').first()).toContainText('US$ 0,09')

    // The step that produced the file carries its own clock, measured off the
    // real event stream rather than reported by the CLI.
    await expect(window.locator('.wb-activity-time').first()).toBeVisible()
    await expect(window.locator('.wb-activity-time').first()).toHaveText(/^\d+s$/)

    // 800 + 60 000 + 14 000 of 200 000 — output excluded, because it only
    // joins the context on the NEXT request.
    const meter = window.locator('.wb-ctx-meter')
    await expect(meter).toContainText('37%')

    await meter.click()
    const sheet = window.locator('.wb-ctx-sheet')
    await expect(sheet).toContainText('Contexto da sessão')
    await expect(sheet).toContainText('74,8 mil')
    await expect(sheet).toContainText('de 200 mil')
    await expect(sheet).toContainText('Reaproveitado do cache')
    // Session totals, and the CLI's own API time alongside our wall-clock.
    await expect(sheet).toContainText('Tempo de API')
    await expect(sheet).toContainText('claude-opus-5')

    await app.close()
  })

  test('@p1 uma mensagem escrita durante o turno entra na fila e sai quando ele termina', async ({
    seeded
  }) => {
    // Two turns' worth of script: the stand-in re-reads it per spawn, so the
    // queued message runs the same canned turn. `delayMs` keeps the first one
    // in flight long enough to type behind it.
    const agent = armScriptedAgent(seeded, {
      chunks: ['Trabalhando…'],
      delayMs: 1_500
    })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await window.getByPlaceholder('Escreva uma mensagem…').fill('primeira pergunta')
    await window.getByRole('button', { name: 'Enviar' }).click()

    // While it runs the composer stays open, and its primary control promises
    // the queue instead of an immediate send.
    const busy = window.getByPlaceholder('Escreva a próxima mensagem — ela entra na fila…')
    await expect(busy).toBeVisible({ timeout: 30_000 })
    await expect(window.getByRole('button', { name: 'Interromper a resposta do agente' })).toBeVisible()

    await busy.fill('segunda pergunta')
    await window.getByRole('button', { name: 'Enfileirar mensagem' }).click()

    await expect(window.locator('.wb-queue')).toContainText('1 mensagem na fila')
    await expect(window.locator('.wb-queue')).toContainText('segunda pergunta')

    // Nothing was sent while the first turn was in flight…
    expect(agent.invocations().filter((entry) => entry.kind === 'turn')).toHaveLength(1)

    // …and when it finishes, the head goes out on its own, into the same
    // conversation, resuming the same CLI session.
    await expect(window.locator('.wb-queue')).toHaveCount(0, { timeout: 30_000 })
    await expect
      .poll(() => agent.invocations().filter((entry) => entry.kind === 'turn').length, {
        timeout: 30_000
      })
      .toBe(2)
    const turns = agent.invocations().filter((entry) => entry.kind === 'turn')
    expect(turns[1].prompt).toBe('segunda pergunta')
    expect(turns[1].argv).toContain('--resume')

    await app.close()
  })

  // Firing queued messages into a session the user just interrupted is the
  // opposite of what pressing Stop meant.
  test('@p1 interromper o turno pausa a fila em vez de despejá-la', async ({ seeded }) => {
    const agent = armScriptedAgent(seeded, {
      chunks: ['Comecei a responder'],
      hang: true
    })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await window.getByPlaceholder('Escreva uma mensagem…').fill('faça algo demorado')
    await window.getByRole('button', { name: 'Enviar' }).click()
    await expect(window.getByText('Comecei a responder')).toBeVisible({ timeout: 30_000 })

    await window
      .getByPlaceholder('Escreva a próxima mensagem — ela entra na fila…')
      .fill('e depois isso')
    await window.getByRole('button', { name: 'Enfileirar mensagem' }).click()
    await expect(window.locator('.wb-queue')).toContainText('1 mensagem na fila')

    await window.getByRole('button', { name: 'Interromper a resposta do agente' }).click()

    // Held, not drained and not discarded — the message is still on screen,
    // and one control releases it.
    await expect(window.locator('.wb-queue')).toContainText('Fila pausada', { timeout: 20_000 })
    await expect(window.locator('.wb-queue')).toContainText('e depois isso')
    expect(agent.invocations().filter((entry) => entry.kind === 'turn')).toHaveLength(1)

    await window.getByRole('button', { name: 'Retomar' }).click()
    await expect
      .poll(() => agent.invocations().filter((entry) => entry.kind === 'turn').length, {
        timeout: 30_000
      })
      .toBe(2)

    // The released turn hangs too (same script), and a live child keeps the
    // app from closing — stop it before tearing down.
    await window.getByRole('button', { name: 'Interromper a resposta do agente' }).click()
    await expect(window.getByRole('button', { name: 'Enviar' })).toBeVisible({ timeout: 20_000 })

    await app.close()
  })
})
