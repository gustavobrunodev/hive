import fs from 'node:fs'
import path from 'node:path'
import { test, expect, launchSeededApp, waitForWorkUI } from './fixtures/workspace'
import { armScriptedAgent } from './fixtures/scriptedAgent'

// Agent Change Review (M11) E2E — ACR-R9.4 and P1-018.
//
// This spec's original scope note said the pending set's *capture* could not be
// driven deterministically here, "no agent CLI is installed", so only the empty
// state was reachable and the on-disk round-trip lived in reviewService.test.ts
// alone. The scripted-agent seam (R-06, src/main/e2eAgentSeam.ts) retires that
// premise: a real turn now writes real files under a real turn checkpoint, so
// accept/reject is asserted here through the whole stack — IPC, shadow git,
// panel — with the **disk** as the witness. The unit-level round-trip stays;
// this is the deliberate defence-in-depth of R-08, not duplication.
//
// Seeding/launch come from the shared fixture (P0-001/R-16): one workspace and
// one userData per case. The hand-rolled boot this file used to carry — which
// clicked "Continuar mesmo assim", i.e. drove the gate's ERROR path — is gone.

/** Sends one composer turn and waits for the agent's reply to land. */
async function sendTurn(window: import('@playwright/test').Page, text: string): Promise<void> {
  await window.getByPlaceholder('Escreva uma mensagem…').fill(text)
  await window.getByRole('button', { name: 'Enviar' }).click()
}

test.describe('agent-change-review E2E (real Electron)', () => {
  test('a view Revisão do agente entra e mostra o estado vazio; sem barra quando limpo', async ({
    hiveApp
  }) => {
    const { window, seeded } = hiveApp

    // The pending set is clean → the ambient review bar is not present.
    await expect(window.locator('.wb-review-bar')).toHaveCount(0)

    // Flip to the "Revisão do agente" activity-bar view (ACR-R2.4).
    await window.getByRole('button', { name: /Revisão do agente/ }).click()

    // The dedicated panel teaches instead of showing a void (ACR-R1.8).
    await expect(window.getByText('Sem mudanças para revisar')).toBeVisible({ timeout: 15_000 })
    await expect(
      window.getByText('Quando o agente editar arquivos', { exact: false })
    ).toBeVisible()

    // The review bridge is exposed on window.hive (ACR-R2.5): a get on the
    // clean workspace returns an empty pending set through real IPC.
    const snapshot = await window.evaluate(
      async (ws) => window.hive.review.get(ws),
      seeded.workspace
    )
    expect(snapshot).toEqual({ changes: [], turns: [] })
  })

  test('@p0 @destructive P1-018 aceitar um arquivo e rejeitar outro, asseverado em disco', async ({
    seeded
  }) => {
    // A file that exists *before* the turn, so the set carries a modification
    // as well as a creation — reject means two different things (restore the
    // pre-turn bytes / remove the file) and both have to be right.
    const readmePath = path.join(seeded.workspace, 'README.md')
    fs.writeFileSync(readmePath, 'linha original\n', 'utf-8')

    const agent = armScriptedAgent(seeded, {
      chunks: ['Editei os dois arquivos.'],
      writes: [
        { path: 'README.md', content: 'linha reescrita pelo agente\n' },
        { path: 'docs/spec.md', content: '# Spec do agente\n' }
      ]
    })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await sendTurn(window, 'reescreva o README e crie docs/spec.md')

    // Both landed optimistically — that is the M11 model: the agent writes, the
    // review decides afterwards.
    const specPath = path.join(seeded.workspace, 'docs', 'spec.md')
    await expect.poll(() => fs.existsSync(specPath), { timeout: 30_000 }).toBe(true)

    // The ambient bar counts the pending set (ACR-R2.3).
    await expect(window.locator('.wb-review-bar')).toContainText('2 mudanças pendentes', {
      timeout: 20_000
    })

    await window.getByRole('button', { name: /Revisão do agente/ }).click()

    // --- Accept the modification: the agent's bytes stay ---------------------
    // Clicks are aimed at the panel: the same per-file control exists in the
    // chat's change card by design (ACR-R2.5, one decision from four surfaces),
    // so an unscoped locator is a strict-mode violation rather than a defect.
    // The assertions that follow stay window-wide on purpose — a decided file
    // has to leave *every* surface at once.
    const rail = window.getByTestId('rail')
    await rail.getByRole('button', { name: 'Aceitar README.md' }).click()
    await expect(window.getByRole('button', { name: 'Aceitar README.md' })).toHaveCount(0, {
      timeout: 15_000
    })
    expect(fs.readFileSync(readmePath, 'utf-8')).toBe('linha reescrita pelo agente\n')

    // --- Reject the creation: the file goes away ----------------------------
    await rail.getByRole('button', { name: 'Rejeitar docs/spec.md' }).click()
    await expect.poll(() => fs.existsSync(specPath), { timeout: 15_000 }).toBe(false)
    // The accepted half is untouched by the rejection of its neighbour — the
    // exact interaction P0-005 pins at hunk level, here at file level.
    expect(fs.readFileSync(readmePath, 'utf-8')).toBe('linha reescrita pelo agente\n')

    // Set emptied → the ambient bar retires itself.
    await expect(window.locator('.wb-review-bar')).toHaveCount(0, { timeout: 15_000 })

    await app.close()
  })

  /**
   * The card belongs to the conversation that asked for the turn.
   *
   * The pending set is per workspace — the agent's bytes are on disk and every
   * conversation shares that disk — and the chat used to render every turn's
   * card in whatever conversation happened to be open. Measured: a review asked
   * for in one conversation showed up, pending and actionable, at the bottom of
   * the next one, with nothing saying where it came from.
   *
   * Two turns, two conversations, two files, driven against the real main
   * process: the scope has to hold end to end (`TurnMark.conversationId` +
   * `review:attachTurn`), not only in the renderer's own filter.
   */
  test('@p0 a revisão de um turno fica na conversa que a pediu', async ({ seeded }) => {
    const agent = armScriptedAgent(seeded, {
      chunks: ['Registrei a rodada na memória da sala.'],
      writes: [{ path: 'memoria/rodada.md', content: '# Rodada\n' }]
    })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    // --- conversation 1 ------------------------------------------------------
    await sendTurn(window, 'reúna o time e registre a rodada')
    await expect(window.locator('.wb-change-card')).toContainText('rodada.md', { timeout: 30_000 })

    // --- conversation 2: its own turn, its own file --------------------------
    agent.rearm({
      chunks: ['Iniciando o brainstorm.'],
      writes: [{ path: 'docs/brief.md', content: '# Brief\n' }]
    })
    await window.getByRole('button', { name: 'Nova conversa' }).click()
    await sendTurn(window, 'faça um brainstorm')
    await expect(window.locator('.wb-change-card')).toContainText('brief.md', { timeout: 30_000 })

    // The regression: exactly one card here, and it is not conversation 1's.
    await expect(window.locator('.wb-change-card')).toHaveCount(1)
    await expect(window.locator('.wb-change-card')).not.toContainText('rodada.md')

    // Scoping the card is not hiding the work: the ambient bar still counts the
    // workspace's whole pending set…
    await expect(window.locator('.wb-review-bar')).toContainText('2 mudanças pendentes', {
      timeout: 20_000
    })
    // …and the history list points back at the conversation still holding one.
    await window.getByRole('button', { name: 'Histórico de conversas' }).click()
    await expect(window.locator('.wb-history-review').first()).toContainText('1 pendente', {
      timeout: 15_000
    })

    await app.close()
  })

  test('@p0 @destructive P1-018 rejeitar o set inteiro devolve todos os arquivos ao pré-turno', async ({
    seeded
  }) => {
    const readmePath = path.join(seeded.workspace, 'README.md')
    fs.writeFileSync(readmePath, 'linha original\n', 'utf-8')

    const agent = armScriptedAgent(seeded, {
      chunks: ['Mexi em tudo.'],
      writes: [
        { path: 'README.md', content: 'reescrito\n' },
        { path: 'docs/spec.md', content: '# Spec\n' }
      ]
    })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await sendTurn(window, 'mexa nos dois arquivos')

    const specPath = path.join(seeded.workspace, 'docs', 'spec.md')
    await expect.poll(() => fs.existsSync(specPath), { timeout: 30_000 }).toBe(true)
    await expect(window.locator('.wb-review-bar')).toContainText('2 mudanças pendentes', {
      timeout: 20_000
    })

    // The one destructive modal in the module (G4): it names what it will undo
    // and asks before doing it.
    await window.locator('.wb-review-bar').getByRole('button', { name: 'Rejeitar tudo' }).click()
    await expect(window.getByText('Rejeitar todas as mudanças?')).toBeVisible()
    await window.getByRole('button', { name: 'Rejeitar tudo', exact: true }).last().click()

    // Disk is the witness: the pre-turn bytes are back and the created file is gone.
    await expect
      .poll(() => fs.readFileSync(readmePath, 'utf-8'), { timeout: 20_000 })
      .toBe('linha original\n')
    expect(fs.existsSync(specPath)).toBe(false)
    await expect(window.locator('.wb-review-bar')).toHaveCount(0, { timeout: 15_000 })

    await app.close()
  })
})
