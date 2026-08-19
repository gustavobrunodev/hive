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
    const rows = window.locator('.hds-radio-card')
    await expect(rows.first()).toBeVisible({ timeout: 20_000 })
    expect(await rows.count()).toBeGreaterThan(1) // "Automático" + at least one real shell

    // Pick bash — present on every machine this suite runs on, and the one
    // family the Claude adapter binds natively (`CLAUDE_CODE_SHELL`). By role
    // and name, not by `aria-label`: the card names its radio through
    // `aria-labelledby` (a `<label>` around Radix's `role="radio"` button
    // names nothing), and a stale attribute selector matches silently.
    const bash = window.getByRole('radio', { name: 'Bash', exact: true })
    const target = (await bash.count()) > 0 ? 'Bash' : 'sh'
    await window.getByRole('radio', { name: target, exact: true }).first().click()

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
    if (target === 'Bash') {
      // Honoured outright: launched in bash, and the CLI told to use that bash.
      expect(shellEnv?.CLAUDE_CODE_SHELL).toBe(shellEnv?.SHELL)
    } else {
      // `sh` is not something `CLAUDE_CODE_SHELL` accepts, so the launch is
      // still `sh` while the CLI's own commands are pinned to a bash or zsh
      // this machine really has — named, not left to the CLI's own scan.
      expect(shellEnv?.CLAUDE_CODE_SHELL).toMatch(/(bash|zsh)$/)
    }

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

    // "Automático" is not "no shell" — it is a real shell on this machine, and
    // one the agents can actually execute in. On POSIX that is normally the
    // login shell; where the login shell is `sh`-family the resolution moves
    // to a bash or zsh instead, because `CLAUDE_CODE_SHELL` accepts nothing
    // else (verified against the real binary) and a default that guarantees a
    // fallback is the Windows bug this feature was reopened for.
    const turns = agent.invocations().filter((entry) => entry.kind === 'turn')
    const shell = turns[0].shellEnv?.SHELL ?? ''
    expect(shell).not.toBe('')
    const bound = turns[0].shellEnv?.CLAUDE_CODE_SHELL
    if (/(bash|zsh)$/.test(shell)) {
      // Launched in it, and the CLI told to use it: no substitution at all.
      expect(bound).toBe(shell)
    } else {
      // Launched in the login shell, commands pinned to a bash/zsh that exists.
      expect(bound).toMatch(/(bash|zsh)$/)
    }
    // POSIX never touches the Windows PowerShell switch.
    expect(turns[0].shellEnv?.CLAUDE_CODE_USE_POWERSHELL_TOOL).toBeNull()

    await window.getByRole('button', { name: 'Abrir configurações de perfil' }).click()
    await expect(window.locator('.hds-radio-card[data-selected]')).toContainText('Automático', {
      timeout: 20_000
    })

    await app.close()
  })
})
