import fs from 'node:fs'
import path from 'node:path'
import {
  test,
  expect,
  launchSeededApp,
  patchSeededConfig,
  waitForWorkUI
} from './fixtures/workspace'
import { armScriptedAgent } from './fixtures/scriptedAgent'

// P0-003 (R-06) — the journey that proves the product's thesis: ask the agent
// for a PRD and watch `PRD.md` appear in the explorer. It is the one scenario
// where every layer has to be real at once, so the only thing replaced is the
// agent binary itself (R-06's Dev item, src/main/e2eAgentSeam.ts): the session
// pool, the stream-json parser, the review checkpoint, the IPC bridge, the
// transcript and the explorer's filesystem watcher are all production code
// here. What the assertions land on is the workspace **on disk** — the UI
// showing a row proves the tree refreshed, not that a file exists.

const PRD_BODY = `# PRD — Hive Desktop

## Objetivo do produto

Orquestrar o BMAD com agentes de IA em um app desktop.
`

test.describe('agent turn E2E (jornada da tese)', () => {
  test('@p0 pedir um PRD ao agente faz PRD.md aparecer no explorer', async ({ seeded }) => {
    // The PRD intent belongs to the PM role's action set (`roleCatalog.ts`);
    // the fixture's default role is `dev`, whose pills are dev-story/code-review.
    patchSeededConfig(seeded, { role: 'pm' })

    const agent = armScriptedAgent(seeded, {
      chunks: ['Vou redigir o PRD agora.', ' Pronto — escrevi em `docs/PRD.md`.'],
      writes: [{ path: 'docs/PRD.md', content: PRD_BODY }]
    })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    // The hero pill, not the action rail: both surfaces expose an action named
    // "Criar um PRD", and this is the one the new-conversation journey starts from.
    await window.locator('.wb-pills').getByRole('button', { name: 'Criar um PRD' }).click()

    // --- On disk, first ----------------------------------------------------
    const prdPath = path.join(seeded.workspace, 'docs', 'PRD.md')
    await expect.poll(() => fs.existsSync(prdPath), { timeout: 30_000 }).toBe(true)
    expect(fs.readFileSync(prdPath, 'utf-8')).toBe(PRD_BODY)

    // --- What the app actually asked for -----------------------------------
    // Recorded by the stand-in, read back from disk: one turn, carrying the
    // PRD workflow's own slash command. A pill that launched some *other*
    // workflow would still have produced the file above.
    const turns = agent.invocations().filter((entry) => entry.kind === 'turn')
    expect(turns).toHaveLength(1)
    expect(turns[0].prompt).toBe('/bmad-prd')
    expect(turns[0].command).toBe('claude')
    expect(fs.realpathSync(turns[0].cwd as string)).toBe(fs.realpathSync(seeded.workspace))

    // --- The explorer picked it up on its own ------------------------------
    // No refresh gesture anywhere in this test: the row can only appear via the
    // workspace watcher (FM-R6), which is the half of the thesis the disk
    // assertion cannot see.
    const docsRow = window.locator('[id="hds-tree-item-docs"]')
    await docsRow.waitFor({ state: 'visible', timeout: 20_000 })
    await docsRow.click()
    const prdRow = window.locator('[id="hds-tree-item-docs/PRD.md"]')
    await prdRow.waitFor({ state: 'visible', timeout: 10_000 })

    // --- And it opens ------------------------------------------------------
    await prdRow.click()
    await expect(window.getByLabel('Conteúdo do arquivo')).toHaveValue(PRD_BODY)

    // The agent's reply reached the transcript through the real parser.
    await expect(window.getByText('Pronto — escrevi em')).toBeVisible()

    await app.close()
  })

  // P1-001 (CC-R1) — the Stop button is only worth having if what already
  // arrived survives it. A deliberate interrupt must read as a normal ending,
  // not as a failure: partial output kept, no error surfaced.
  test('@p1 interromper um turno em voo mantém a saída parcial e não vira erro', async ({
    seeded
  }) => {
    const agent = armScriptedAgent(seeded, {
      chunks: ['Comecei a responder', ' e ainda estou escrevendo…'],
      // Streamed, then silence with the process still up: a turn in flight,
      // which is the only state where Stop means anything.
      hang: true
    })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await window.getByPlaceholder('Escreva uma mensagem…').fill('escreva um texto longo')
    await window.getByRole('button', { name: 'Enviar' }).click()

    // Wait for real streamed output, not for a clock — the stop has to land
    // while there is something to lose.
    await expect(window.getByText('e ainda estou escrevendo…')).toBeVisible({ timeout: 30_000 })

    const stop = window.getByRole('button', { name: 'Interromper a resposta do agente' })
    await expect(stop).toBeVisible()
    await stop.click()

    // The composer returns to send mode: the turn really ended.
    await expect(window.getByRole('button', { name: 'Enviar' })).toBeVisible({ timeout: 20_000 })
    // What had arrived is still there…
    await expect(window.getByText('Comecei a responder')).toBeVisible()
    await expect(window.getByText('e ainda estou escrevendo…')).toBeVisible()
    // …and a user-driven stop is not an error (CC-R1.5).
    await expect(window.locator('[role="alert"]')).toHaveCount(0)

    await app.close()
  })

  // P1-022 (confiabilidade) — the unit suites cover each failing boundary on
  // its own (missing CLI, git, network, model). What only a real launch shows
  // is the rule that binds them: a failure ends the turn. The composer coming
  // back is the assertion — "never an infinite spinner" is otherwise a promise
  // nothing measures.
  test('@p1 um turno que falha vira erro legível e devolve o compositor', async ({ seeded }) => {
    const agent = armScriptedAgent(seeded, {
      chunks: ['Comecei…'],
      exitCode: 1,
      stderr: 'credencial ausente'
    })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await window.getByPlaceholder('Escreva uma mensagem…').fill('faça algo')
    await window.getByRole('button', { name: 'Enviar' }).click()

    const alert = window.locator('[role="alert"]')
    await expect(alert).toBeVisible({ timeout: 30_000 })
    // The stderr tail travels into the message — a failure the user can act on,
    // not a shrug.
    await expect(alert).toContainText('credencial ausente')

    // The turn is over: the send control is back, not a spinner that never ends.
    await expect(window.getByRole('button', { name: 'Enviar' })).toBeVisible()
    await expect(
      window.getByRole('button', { name: 'Interromper a resposta do agente' })
    ).toHaveCount(0)

    // Documented asymmetry, pinned rather than corrected: a turn that ERRORS
    // discards what already streamed, while an interrupted one keeps it
    // (CC-R1.3, the case above). `handleAgentEvent`'s `error` branch sets the
    // message and clears the bubble without settling the turn, so the text is
    // gone from the pane and from the persisted history. No requirement covers
    // the error path — CC-R1.3 is scoped to the interrupt — so this is a
    // product question (report, don't redesign), and this assertion is what
    // will fail loudly on the day someone answers it.
    await expect(window.getByText('Comecei…')).toHaveCount(0)

    await app.close()
  })
})
