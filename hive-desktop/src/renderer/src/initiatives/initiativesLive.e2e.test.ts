import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { stageAction } from './initiativeStages'

/**
 * The stage launch's prompt, read by a **real Claude**.
 *
 * The claim under test is the one no fake runner can make: that the sentence
 * `stageAction` builds actually **anchors the agent to the demand's folder**.
 * Every other part of the feature is decided in this process and covered by the
 * unit suites — but "does a model, handed this sentence, go and read
 * `docs/iniciativas/R2/portal-de-cobranca/` instead of the workspace root" is a
 * fact about a model reading a sentence, and the only way to know it is to ask
 * one.
 *
 * It matters because the failure is silent and expensive. BMAD writing to its
 * own default output location means the artifacts land where the tracker will
 * never see them: the plan keeps reporting "pendente" over work that was done,
 * the context tree stays empty, and nothing on screen says why.
 *
 * ## Why it spawns the CLI itself instead of going through `claudeCliAdapter`
 *
 * Because it cannot import it: `main` and `renderer` are separate bundles and a
 * value import across that line is a boundary violation with no exception
 * (`moduleBoundaries.test.ts`), and `stageAction` — the actual subject — lives
 * here. The adapter's own live behaviour is already covered by
 * `main/claudeLive.e2e.test.ts`; what is left for this file is the sentence,
 * and the minimum apparatus for that is a real model reading it. The flags
 * mirror the adapter's (`-p`, `--model`, `--effort`, `--permission-mode
 * acceptEdits`) minus the streaming ones, which only shape how the answer
 * arrives.
 *
 * One small `haiku` turn on the low effort. Excluded from `npm run test` (it is
 * an `*.e2e.test.ts`); run with `npm run test:e2e` on a machine with `claude`
 * installed and logged in.
 */
const AVAILABLE = process.env.HIVE_SKIP_CLAUDE_LIVE !== '1'

const run = promisify(execFile)

/** The path shape the renderer really builds — `initiativePath('R2', slug)`. */
const FOLDER = 'docs/iniciativas/R2/portal-de-cobranca'

describe.skipIf(!AVAILABLE)('initiative stage launch — against the real Claude CLI', () => {
  it('sends the agent into the demand folder rather than the workspace root', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'hive-initiative-'))
    mkdirSync(join(workspace, FOLDER), { recursive: true })

    // The stage's skill has to actually exist in the workspace, and this test
    // is where that was learned: `-p` resolves a leading `/name` as a COMMAND
    // LOOKUP, and an unknown one aborts the whole turn with
    // `unknown command: /bmad-architecture` — the sentence after it is never
    // read. A Hive workspace is provisioned with BMAD (all eight stage skills
    // verified present in a real install), so a bare temp directory was the
    // unrealistic half, not the launch. Provisioning the one skill under test
    // keeps this about the sentence.
    const skill = join(workspace, '.claude', 'skills', 'bmad-architecture')
    mkdirSync(skill, { recursive: true })
    writeFileSync(
      join(skill, 'SKILL.md'),
      [
        '---',
        'name: bmad-architecture',
        'description: Produce the architecture for a feature.',
        '---',
        '',
        'Leia os artefatos existentes antes de propor qualquer arquitetura.',
        ''
      ].join('\n')
    )

    // Two PRDs, one word apart. A run that ignores the folder and picks up the
    // root's `prd.md` answers `jabuticaba`; only a run that went where the
    // prompt sent it answers `carambola`. A single file could not tell those
    // apart — the agent would find the right one by having nowhere else to look.
    writeFileSync(join(workspace, 'prd.md'), '# PRD\n\nA palavra-chave deste PRD é jabuticaba.\n')
    writeFileSync(
      join(workspace, FOLDER, 'prd.md'),
      '# PRD — Portal de Cobrança\n\nA palavra-chave deste PRD é carambola.\n'
    )

    // The real launch, verbatim: the same `RoleAction` the rail's
    // "Iniciar Arquitetura" hands to the chat.
    const action = stageAction('bmad-architecture', 'Portal de Cobrança', FOLDER)
    const { stdout } = await run(
      'claude',
      [
        '-p',
        `${action.command.prompt} Antes de escrever qualquer coisa, leia o PRD que existir e responda SÓ com a palavra-chave dele.`,
        '--model',
        'haiku',
        '--effort',
        'low',
        '--permission-mode',
        'acceptEdits'
      ],
      { cwd: workspace, timeout: 240_000, maxBuffer: 8 * 1024 * 1024 }
    )

    const reply = stdout.toLowerCase()
    expect(reply).toContain('carambola')
    expect(reply).not.toContain('jabuticaba')
  }, 300_000)
})
