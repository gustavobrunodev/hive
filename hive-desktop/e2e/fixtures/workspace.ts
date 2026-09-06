import { test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openSidebar } from './sidebar'

// QA infrastructure for the E2E layer (test-design-qa.md, "Infraestrutura de
// QA"). Two problems this file exists to solve, both recorded as risks:
//
//   R-01 — every launch fell into the provisioning gate and shelled out to a
//     real `npx bmad-method install`, so four specs timed out waiting for a
//     work UI they could never reach. The seam (B-1) is in the product
//     (`bmadService.isE2ESeamEnabled`); this fixture is what turns it on and
//     seeds the state the seam requires.
//
//   R-16 — `explorer-editor-ux` shared one workspace across a `describe.serial`
//     block, so a single `beforeAll` failure erased six cases. Here every test
//     gets its own workspace and its own `userData`, torn down after. That is
//     the fix, not a style preference.
//
// Seeding, not mocking: the app really reads `<userData>/config.json` and
// really probes `<ws>/_bmad/_config/manifest.yaml`. Nothing here fakes an app
// boundary — it writes the same bytes a real provisioned install would leave.

/** Where a seeded case's throwaway state lives. */
export interface SeededWorkspace {
  /** Root of the throwaway tree; everything below is inside it. */
  root: string
  /** The workspace the app opens — pre-seeded as provisioned. */
  workspace: string
  /** Electron's `--user-data-dir` for this case, with `config.json` written. */
  userData: string
  /** A directory OUTSIDE the workspace, for import/drag-source scenarios. */
  outside: string
}

export interface SeedOptions {
  /** Short label woven into the temp dir name, to make a leaked dir traceable. */
  label?: string
  /**
   * Seed the second-brain skill marker so that gate's seam engages too
   * (default true — the launch gate has two steps and skipping only the first
   * still parks the app on the second).
   */
  secondBrain?: boolean
  /** Extra `config.json` fields merged over the provisioned defaults. */
  config?: Record<string, unknown>
}

/**
 * Creates a throwaway workspace + `userData` pair seeded to the exact state a
 * completed provisioning leaves behind:
 *
 *   - `<userData>/config.json` with `{ workspacePath, provisioned: true }` —
 *     the shape in `src/main/configStore.ts`. Routes past `WorkspacePicker`
 *     without the native folder dialog, which Playwright cannot drive.
 *   - `<ws>/_bmad/_config/manifest.yaml` — since WS-R3.3, onboarding routes on
 *     this on-disk marker, not on the config flag alone.
 *   - `<ws>/.claude/skills/second-brain/SKILL.md` — the marker
 *     `SecondBrainService.detect()` probes.
 *
 * Caller owns cleanup unless using the `seeded` Playwright fixture below.
 */
export function seedProvisionedWorkspace(options: SeedOptions = {}): SeededWorkspace {
  const { label = 'case', secondBrain = true, config = {} } = options

  const root = fs.mkdtempSync(path.join(os.tmpdir(), `hive-e2e-${label}-`))
  const workspace = path.join(root, 'workspace')
  const userData = path.join(root, 'userData')
  const outside = path.join(root, 'outside')
  for (const dir of [workspace, userData, outside]) fs.mkdirSync(dir, { recursive: true })

  const manifestDir = path.join(workspace, '_bmad', '_config')
  fs.mkdirSync(manifestDir, { recursive: true })
  fs.writeFileSync(path.join(manifestDir, 'manifest.yaml'), 'version: test-fixture\n', 'utf-8')

  // shortcut-scopes: a small but real BMAD skill catalog, so surfaces that
  // read it ("Personalizar atalhos") render rows instead of their empty state.
  // Headers are the ones captured from a real install (see workflowCatalog.ts).
  //
  // `canonicalId` REPEATS `name`, because that is what a real
  // `skill-manifest.csv` contains — every row of the live file is
  // `"bmad-prd","bmad-prd",…`. This fixture used to invent module-scoped ids
  // (`bmm/prd`), and `listWorkspaceCatalog` keys the catalog off
  // `canonicalId || name`: every key in the seeded workspace was therefore a
  // name nothing else in the app ever refers to, so *nothing* resolved and any
  // spec that depended on a shortcut surviving catalog validation was testing a
  // workspace no user will ever have. The `dev` role's own defaults are in the
  // list for the same reason — that is the role the seed selects.
  fs.writeFileSync(
    path.join(manifestDir, 'skill-manifest.csv'),
    [
      'canonicalId,name,description,module,path',
      'bmad-prd,bmad-prd,Create or update a PRD,bmm,.claude/skills/bmad-prd',
      'bmad-party-mode,bmad-party-mode,Orchestrate a group discussion,core,.claude/skills/bmad-party-mode',
      'bmad-ux,bmad-ux,Plan UX patterns,bmm,.claude/skills/bmad-ux',
      'bmad-dev-story,bmad-dev-story,Execute story implementation,bmm,.claude/skills/bmad-dev-story',
      'bmad-code-review,bmad-code-review,Review code changes adversarially,bmm,.claude/skills/bmad-code-review',
      'bmad-agent-pm,bmad-agent-pm,Product manager persona. Use when the user asks to talk to John,bmm,.claude/skills/bmad-agent-pm',
      'bmad-agent-dev,bmad-agent-dev,Senior engineer persona. Use when the user asks to talk to Amelia,bmm,.claude/skills/bmad-agent-dev'
    ].join('\n') + '\n',
    'utf-8'
  )

  if (secondBrain) {
    // All FOUR skills the real pack installs, not just the `second-brain`
    // marker `SecondBrainService.detect()` probes. The others are what the
    // workspace skill catalog is built from, and the catalog is the oracle
    // that decides whether `/second-brain-query …` renders as an invocation
    // or as prose in the transcript — a fixture with only the marker proves
    // the wrong half of that. Frontmatter, because `listCreatedSkills` reads
    // `name`/`description` out of it.
    for (const key of [
      'second-brain',
      'second-brain-ingest',
      'second-brain-lint',
      'second-brain-query'
    ]) {
      const skillDir = path.join(workspace, '.claude', 'skills', key)
      fs.mkdirSync(skillDir, { recursive: true })
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---\nname: ${key}\ndescription: Test fixture for ${key}.\n---\n\n# test fixture\n`,
        'utf-8'
      )
    }
  }

  // Everything onboarding routes on, seeded to a completed first run. The
  // provisioning gate is only the FIRST step: `agent`/`agents` skip
  // `AgentSetup`, `role` skips `RoleSetup`, and `userName` keeps the guided
  // install form from re-asking. Leaving any of them null parks the app on
  // that screen with the work UI never rendering — the failure looks exactly
  // like the provisioning timeout it is not (observed 2026-07-30).
  fs.writeFileSync(
    path.join(userData, 'config.json'),
    JSON.stringify({
      workspacePath: workspace,
      provisioned: true,
      recentWorkspaces: [workspace],
      lastModel: null,
      lastEffort: null,
      agent: 'claude-cli',
      agents: ['claude-cli'],
      role: 'dev',
      userName: 'E2E',
      // shortcut-scopes: the current shape — one selection per scope, both
      // uncustomized. (`null` still migrates, but the fixture documents the
      // real file, so it carries the real schema.)
      shortcuts: { start: null, during: null },
      skippedUpdateVersion: null,
      // M29.1: every spec gets a throwaway `userData`, so every launch looks
      // like a fresh install — and a fresh install now fetches the 671 MB
      // transcription model by itself. Left on, this suite would start a real
      // Hugging Face transfer per spec, and `voice-model-gate.spec.ts` would
      // meet a progress bar where it expects the offer to download. Seeded
      // through the app's own opt-out rather than a test-only switch: it is
      // exactly the state of a user who pressed "Remover".
      asrAutoDownload: false,
      ...config
    }),
    'utf-8'
  )

  return { root, workspace, userData, outside }
}

/**
 * Merges fields into an already-seeded `config.json`, for cases that need a
 * different first-run state than the default (e.g. the PM role, whose action
 * set is the one carrying the PRD intent). Must run before launch — the app
 * reads this file on boot.
 */
export function patchSeededConfig(seeded: SeededWorkspace, patch: Record<string, unknown>): void {
  const configPath = path.join(seeded.userData, 'config.json')
  const current = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>
  fs.writeFileSync(configPath, JSON.stringify({ ...current, ...patch }), 'utf-8')
}

/** Absolute path to the built main entrypoint the E2E drives. */
export function builtMainPath(): string {
  return path.join(__dirname, '..', '..', 'out', 'main', 'index.js')
}

export interface LaunchOptions {
  /** Extra env for the launched app (e.g. a scripted agent adapter). */
  env?: Record<string, string>
  /** Extra Electron/Chromium CLI switches. */
  args?: string[]
}

/**
 * Launches the real built app against a seeded workspace with the B-1 seam
 * armed (`HIVE_E2E=1`), so the two provisioning gates resolve without a
 * network round-trip or the real CLI.
 *
 * `ELECTRON_RUN_AS_NODE` is stripped deliberately: this dev box has it set
 * ambient via WSL2/WSLENV interop, and if inherited Electron runs the entry as
 * plain Node instead of booting the app (see AGENTS.md / STATE.md lessons).
 */
export async function launchSeededApp(
  seeded: SeededWorkspace,
  options: LaunchOptions = {}
): Promise<ElectronApplication> {
  const launchEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) launchEnv[key] = value
  }
  delete launchEnv.ELECTRON_RUN_AS_NODE
  launchEnv.HIVE_E2E = '1'
  Object.assign(launchEnv, options.env ?? {})

  const app = await electron.launch({
    args: [builtMainPath(), `--user-data-dir=${seeded.userData}`, ...(options.args ?? [])],
    env: launchEnv
  })

  // Dismiss the guided tour before anyone looks at the UI. It lives in renderer
  // localStorage (`hive.tourSeen`, see `tour/useGuidedTour.ts`), so it cannot be
  // seeded from `userData` — it has to be written in-page and the window
  // reloaded. Left open it covers the surface with a scrim and an animating
  // card; that produced five bogus contrast failures before being noticed.
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  const alreadySeen = await window.evaluate(
    () => window.localStorage.getItem('hive.tourSeen') === '1'
  )
  if (!alreadySeen) {
    await window.evaluate(() => window.localStorage.setItem('hive.tourSeen', '1'))
    await window.reload()
    await window.waitForLoadState('domcontentloaded')
  }

  return app
}

/**
 * Waits for the work UI to be on screen, **with the sidebar open**.
 *
 * With the seam armed the wait itself is a straight one — no "continuar mesmo
 * assim" escape hatch, on purpose. That click is what made the four red specs
 * look like they were testing the happy path when they were actually testing
 * the error path; if the gate is reached here at all, the seam did not hold
 * and the test SHOULD fail rather than paper over it.
 *
 * The sidebar is opened here because a workspace with no stored session opens
 * on the chat alone (workspace-session), and every spec written before that
 * describes an app whose file rail is on screen. Doing it in the one helper
 * they all already call keeps those specs describing the app they were written
 * about; `workspace-session.spec.ts` covers the first-run state itself and
 * deliberately does not come through here.
 */
export { openSidebar }

export async function waitForWorkUI(window: Page, timeout = 45_000): Promise<void> {
  await window.locator('.wb-actionrail').waitFor({ state: 'visible', timeout })
  await openSidebar(window)
}

/** Removes a seeded tree. Safe to call twice. */
export function disposeWorkspace(seeded: SeededWorkspace): void {
  fs.rmSync(seeded.root, { recursive: true, force: true })
}

interface HiveFixtures {
  /** A workspace seeded fresh for THIS test, removed afterwards (R-16). */
  seeded: SeededWorkspace
  /** The launched app, already past both provisioning gates, closed afterwards. */
  hiveApp: { app: ElectronApplication; window: Page; seeded: SeededWorkspace }
}

/**
 * `test` extended with per-case isolation. Use `hiveApp` when the case just
 * needs a booted app; use `seeded` alone when it needs to write to the
 * workspace before launch, or to launch with custom env.
 */
export const test = base.extend<HiveFixtures>({
  // The second parameter is Playwright's "hand the value to the test" callback.
  // It is named `provide` rather than the conventional `use` only because the
  // react-hooks lint rule reads a bare `use(...)` call as a React hook.
  // eslint-disable-next-line no-empty-pattern
  seeded: async ({}, provide, testInfo) => {
    const seeded = seedProvisionedWorkspace({
      label: testInfo.title.slice(0, 24).replace(/[^a-z0-9]+/gi, '-')
    })
    await provide(seeded)
    disposeWorkspace(seeded)
  },

  hiveApp: async ({ seeded }, provide) => {
    const app = await launchSeededApp(seeded)
    const window = await app.firstWindow()
    await waitForWorkUI(window)
    await provide({ app, window, seeded })
    await app.close()
  }
})

export { expect } from '@playwright/test'
