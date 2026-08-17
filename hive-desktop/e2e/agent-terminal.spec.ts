import fs from 'node:fs'
import path from 'node:path'
import { test, expect, launchSeededApp, waitForWorkUI } from './fixtures/workspace'
import { armScriptedAgent } from './fixtures/scriptedAgent'

// agent-terminal (M20, AT-R1/AT-R2/AT-R3/AT-R4).
//
// The unit suites cover each piece against fakes: detection over a fabricated
// filesystem, the quoting table, the service's join, the picker's props. What
// none of them can show is the property the feature actually promises — that a
// terminal picked in the sheet is the terminal the next turn *runs inside*,
// with everything in between real: the detector reading this machine, the
// config file on disk, the process runner's shell wrap, and the adapter's
// environment binding.
//
// The last one is also the regression that would hurt most and hide best: the
// turn is spawned through a shell now, and a quoting or exit-code mistake there
// doesn't raise anything — it just makes replies stop arriving.
test.describe('the terminal the agent runs in (M20)', () => {
  test('@p1 picking a terminal persists it and the next turn runs inside it', async ({
    seeded
  }) => {
    const agent = armScriptedAgent(seeded, { chunks: ['Rodei no terminal escolhido.'] })
    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await window.getByRole('button', { name: 'Abrir configurações de perfil' }).click()

    // AT-R1: the list is this machine's, not a fixed menu. Every row carries
    // the absolute path detection found, and POSIX always has at least `sh`.
    const rows = window.locator('.wb-shell-row')
    await expect(rows.first()).toBeVisible({ timeout: 20_000 })
    const paths = await window.locator('.wb-shell-row[data-selected] , .wb-shell-row').count()
    expect(paths).toBeGreaterThan(1) // "Automático" + at least one real shell

    // Pick bash — present on every machine this suite runs on, and the one
    // family the Claude adapter binds natively (`CLAUDE_CODE_SHELL`).
    const bash = window.locator('[aria-label="Bash"]')
    const target = (await bash.count()) > 0 ? 'Bash' : 'sh'
    await window.locator(`[aria-label="${target}"]`).first().click()

    // AT-R2: it is on disk, by id, right away — not on close, not on restart.
    const configPath = path.join(seeded.userData, 'config.json')
    await expect
      .poll(
        () =>
          (JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { agentShell?: string | null })
            .agentShell,
        { timeout: 10_000 }
      )
      .toBe(target === 'Bash' ? 'bash' : 'sh')

    await window.keyboard.press('Escape')

    // AT-R3: the turn still completes. Everything about the reply arriving
    // depends on the shell wrap being transparent — the arguments surviving
    // quoting, stdout staying clean of any rc banner, and the exit code
    // reaching the adapter.
    await window
      .getByPlaceholder(/Escreva/)
      .first()
      .fill('quem está rodando?')
    await window.getByRole('button', { name: 'Enviar' }).click()
    await expect(window.getByText('Rodei no terminal escolhido.')).toBeVisible({ timeout: 30_000 })

    // AT-R4: the choice reached the CLI as its own environment — read back
    // from what the process was actually given, not from what the UI shows.
    const turns = agent.invocations().filter((entry) => entry.kind === 'turn')
    expect(turns).toHaveLength(1)
    const shellEnv = turns[0].shellEnv
    expect(shellEnv?.SHELL).toMatch(/\/(bash|sh)$/)
    expect(shellEnv?.CLAUDE_CODE_SHELL).toBe(target === 'Bash' ? shellEnv?.SHELL : null)

    await app.close()
  })

  test('@p1 automático resolves to this machine’s own shell, and stays selected', async ({
    seeded
  }) => {
    const agent = armScriptedAgent(seeded, { chunks: ['Automático.'] })
    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await window
      .getByPlaceholder(/Escreva/)
      .first()
      .fill('oi')
    await window.getByRole('button', { name: 'Enviar' }).click()
    await expect(window.getByText('Automático.')).toBeVisible({ timeout: 30_000 })

    // "Automático" is not "no shell" — it is *this machine's* shell (AT-R2, and
    // the reason Windows can default to cmd at all). So the turn runs inside
    // the login shell and the adapter binds it, but only where the CLI accepts
    // the binding: `CLAUDE_CODE_SHELL` takes a bash/zsh path and nothing else
    // (verified against the real binary), so an `sh`-family default correctly
    // exports nothing rather than a value the CLI would log and discard.
    const turns = agent.invocations().filter((entry) => entry.kind === 'turn')
    const shell = turns[0].shellEnv?.SHELL ?? ''
    expect(shell).not.toBe('')
    expect(turns[0].shellEnv?.CLAUDE_CODE_SHELL).toBe(/(bash|zsh)$/.test(shell) ? shell : null)
    expect(turns[0].shellEnv?.CLAUDE_CODE_USE_POWERSHELL_TOOL).toBeNull()

    await window.getByRole('button', { name: 'Abrir configurações de perfil' }).click()
    await expect(window.locator('.wb-shell-row[data-selected]')).toContainText('Automático', {
      timeout: 20_000
    })

    await app.close()
  })
})
