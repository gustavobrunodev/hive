import {
  test,
  expect,
  launchSeededApp,
  patchSeededConfig,
  waitForWorkUI
} from './fixtures/workspace'
import { armScriptedAgent } from './fixtures/scriptedAgent'

// P2-005 (AG-R) — the agent switcher, across conversations.
//
// `AgentSwitcher.test.ts` covers the control against props: it renders the
// pool, reports the pick, and turns into a badge when told it is locked. What
// no unit test can show is that the pick actually *routes* — that choosing
// "GitHub Copilot" makes the app spawn `copilot` and not `claude`. The pick is
// only meaningful if the binary changes, and the binary is chosen four layers
// below the dropdown (conversation state → AgentService's pool → the registry's
// adapter → the spawn).
//
// The scripted seam (R-06) stands in for all three CLIs at once and records
// which real binary each spawn replaced, so the assertion lands on what the app
// executed rather than on which menu item looks selected.
//
// The lock matters for the same reason: a CLI `--resume` handle is
// agent-specific, so switching mid-conversation would silently break memory.
// The product's answer is per-conversation binding — which is only true if a
// NEW conversation is free to pick again.

/** Both agents enabled, so the switcher has a pool to offer. */
const TWO_AGENTS = { agent: 'claude-cli', agents: ['claude-cli', 'github-copilot'] }

test.describe('agent switching across conversations (P2-005)', () => {
  test('@p2 escolher um agente decide qual binário o turno executa, e então trava', async ({
    seeded
  }) => {
    patchSeededConfig(seeded, TWO_AGENTS)
    const agent = armScriptedAgent(seeded, { chunks: ['Respondendo pelo Copilot.'] })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    // A fresh conversation offers the pick.
    const switcher = window.getByRole('button', { name: /^Agente da conversa: / })
    await expect(switcher).toBeVisible({ timeout: 20_000 })
    await switcher.click()
    await window.getByRole('menuitemradio', { name: 'Usar GitHub Copilot nesta conversa' }).click()

    await window.getByPlaceholder('Escreva uma mensagem…').fill('quem está respondendo?')
    await window.getByRole('button', { name: 'Enviar' }).click()
    await expect(window.getByText('Respondendo pelo Copilot.')).toBeVisible({ timeout: 30_000 })

    // The pick routed: the turn ran the Copilot binary. Recorded by the
    // stand-in and read back from disk — the dropdown's own state could show
    // "GitHub Copilot" while the spawn still went to `claude`, and that is
    // precisely the bug this case exists to catch.
    const turns = agent.invocations().filter((entry) => entry.kind === 'turn')
    expect(turns).toHaveLength(1)
    expect(turns[0].command).toBe('copilot')

    // Started conversation: the control is now a non-interactive badge, so the
    // agent-specific `--resume` handle cannot be orphaned mid-thread.
    await expect(window.getByRole('button', { name: /^Agente da conversa: / })).toHaveCount(0)
    await expect(window.getByLabel(/^Esta conversa está no agente GitHub Copilot\./)).toBeVisible()

    await app.close()
  })

  test('@p2 uma nova conversa destrava o switcher e pode escolher outro agente', async ({
    seeded
  }) => {
    patchSeededConfig(seeded, TWO_AGENTS)
    const agent = armScriptedAgent(seeded, { chunks: ['ok'] })

    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    // Conversation 1 → Copilot.
    await window.getByRole('button', { name: /^Agente da conversa: / }).click()
    await window.getByRole('menuitemradio', { name: 'Usar GitHub Copilot nesta conversa' }).click()
    await window.getByPlaceholder('Escreva uma mensagem…').fill('primeira conversa')
    await window.getByRole('button', { name: 'Enviar' }).click()
    await expect(window.getByLabel(/^Esta conversa está no agente GitHub Copilot\./)).toBeVisible({
      timeout: 30_000
    })

    // A new conversation is a new binding — the lock was per-conversation, not
    // a one-way door for the app.
    await window.getByRole('button', { name: 'Nova conversa' }).click()
    const switcher = window.getByRole('button', { name: /^Agente da conversa: / })
    await expect(switcher).toBeVisible({ timeout: 20_000 })

    await switcher.click()
    await window.getByRole('menuitemradio', { name: 'Usar Claude Code nesta conversa' }).click()
    await window.getByPlaceholder('Escreva uma mensagem…').fill('segunda conversa')
    await window.getByRole('button', { name: 'Enviar' }).click()
    await expect(window.getByLabel(/^Esta conversa está no agente Claude Code\./)).toBeVisible({
      timeout: 30_000
    })

    // Two turns, two different binaries, in order: the conversations really are
    // bound to their own agent rather than to one app-wide setting.
    await expect
      .poll(
        () =>
          agent
            .invocations()
            .filter((entry) => entry.kind === 'turn')
            .map((e) => e.command),
        { timeout: 20_000 }
      )
      .toEqual(['copilot', 'claude'])

    await app.close()
  })
})
