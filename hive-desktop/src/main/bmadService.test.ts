import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createConfigStore, type ConfigStore } from './configStore'
import { createFakeProcessRunner, type FakeProcessRunner } from './processRunner'
import { createBmadService, isE2ESeamEnabled, type BmadEvent } from './bmadService'

// `createBmadService` takes both its `ProcessRunner` and `ConfigStore` as
// plain injected arguments (mirroring configStore.ts/workspaceService.ts's
// DI pattern), so tests use the scriptable fake `ProcessRunner` plus a real
// `ConfigStore` pointed at a temp dir — no process spawning or module
// mocking required.
describe('BmadService', () => {
  let baseDir: string
  let configStore: ConfigStore
  let processRunner: FakeProcessRunner

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'hive-bmad-service-'))
    configStore = createConfigStore(baseDir)
    processRunner = createFakeProcessRunner()
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  async function collect(events: AsyncIterable<BmadEvent>): Promise<BmadEvent[]> {
    const out: BmadEvent[] = []
    for await (const event of events) out.push(event)
    return out
  }

  it('install() with only modules invokes the minimal non-interactive command', async () => {
    processRunner.script({ code: 0 })
    const service = createBmadService(processRunner, configStore)

    await collect(service.install('/Users/dev/my-workspace', { modules: ['bmm'] }))

    expect(processRunner.calls).toEqual([
      {
        command: 'npx',
        args: [
          'bmad-method',
          'install',
          '--directory',
          '/Users/dev/my-workspace',
          '--modules',
          'bmm',
          '--tools',
          'claude-code',
          '--yes'
        ],
        opts: undefined
      }
    ])
  })

  it('install() maps the guided-form answers onto the non-interactive CLI flags', async () => {
    processRunner.script({ code: 0 })
    const service = createBmadService(processRunner, configStore)

    await collect(
      service.install('/Users/dev/my-workspace', {
        modules: ['bmm', 'bmb'],
        userName: 'Gustavo',
        communicationLanguage: 'Português',
        documentOutputLanguage: 'English',
        outputFolder: '_bmad-output',
        set: { 'bmm.user_skill_level': 'expert' }
      })
    )

    expect(processRunner.calls).toEqual([
      {
        command: 'npx',
        args: [
          'bmad-method',
          'install',
          '--directory',
          '/Users/dev/my-workspace',
          '--modules',
          'bmm,bmb',
          '--user-name',
          'Gustavo',
          '--communication-language',
          'Português',
          '--document-output-language',
          'English',
          '--output-folder',
          '_bmad-output',
          '--set',
          'bmm.user_skill_level=expert',
          '--tools',
          'claude-code',
          '--yes'
        ],
        opts: undefined
      }
    ])
  })

  it('successful install emits a real-shaped step/progress sequence ending in done, and flips provisioned', async () => {
    // Realistic install output shaped after the real `bmad-method@6.10.0`
    // run captured by T0 (design.md §7) — box-rail-prefixed lines, `●` for
    // config echoes, `◇`/`◆` for completed steps, spinner glyphs for
    // in-progress steps — split across multiple stdout chunks the way a
    // real streaming process would deliver them.
    processRunner.script({
      chunks: [
        {
          stream: 'stdout',
          data:
            '│  Using directory from command-line: /Users/dev/my-workspace\n' +
            '│  Using modules from command-line: bmm\n' +
            '│  Using tools from command-line: claude-code\n'
        },
        {
          stream: 'stdout',
          data:
            '◇  Shared scripts installed\n' +
            '◒  Installing core\n' +
            '◐  Installing bmm\n' +
            '◇  2 module(s) installed\n'
        },
        {
          stream: 'stdout',
          data:
            '◇  Module directories created\n' +
            '◒  Generating manifests\n' +
            '◇  Configurations generated\n' +
            '●  Setting up claude-code...\n' +
            '◆  claude-code configured: 46 skills → .claude/skills\n'
        }
      ],
      code: 0
    })
    const service = createBmadService(processRunner, configStore)

    const events = await collect(service.install('/Users/dev/my-workspace', { modules: ['bmm'] }))

    // At least one step-shaped and one progress-shaped event were parsed.
    expect(events.some((e) => e.type === 'step')).toBe(true)
    expect(events.some((e) => e.type === 'progress')).toBe(true)
    // Ends with the synthesized done event.
    expect(events.at(-1)).toEqual({ type: 'done', ok: true })
    // A couple of concrete parsed events, spot-checked.
    expect(events).toContainEqual({
      type: 'step',
      id: 'shared-scripts-installed',
      label: 'Shared scripts installed'
    })
    expect(events).toContainEqual({ type: 'progress', message: 'Installing core' })

    expect(configStore.getConfig().provisioned).toBe(true)
  })

  it('failing install (non-zero exit) ends the sequence with an error event and does not set provisioned', async () => {
    processRunner.script({
      chunks: [
        {
          stream: 'stdout',
          data: '●  Using directory from command-line: /Users/dev/my-workspace\n'
        },
        {
          stream: 'stderr',
          data: "Error: EACCES: permission denied, mkdir '/Users/dev/my-workspace/_bmad'\n"
        }
      ],
      code: 1
    })
    const service = createBmadService(processRunner, configStore)

    const events = await collect(service.install('/Users/dev/my-workspace', { modules: ['bmm'] }))

    const last = events.at(-1)
    expect(last?.type).toBe('error')
    expect(last).toMatchObject({
      type: 'error',
      message: expect.stringContaining('1')
    })
    if (last?.type === 'error') {
      expect(last.detail).toContain('EACCES')
    }

    expect(configStore.getConfig().provisioned).toBe(false)
  })

  it('failing install with no stderr still emits an error event with undefined detail, and provisioned stays false', async () => {
    processRunner.script({
      chunks: [{ stream: 'stdout', data: '●  Using directory from command-line: /ws\n' }],
      code: 127
    })
    const service = createBmadService(processRunner, configStore)

    const events = await collect(service.install('/ws', { modules: ['bmm'] }))

    expect(events.at(-1)).toEqual({
      type: 'error',
      message: expect.stringContaining('127'),
      detail: undefined
    })
    expect(configStore.getConfig().provisioned).toBe(false)
  })

  it('update() invokes the exact real T0-verified command/args (no --modules)', async () => {
    processRunner.script({ code: 0 })
    const service = createBmadService(processRunner, configStore)

    await collect(service.update('/Users/dev/my-workspace'))

    expect(processRunner.calls).toEqual([
      {
        command: 'npx',
        args: [
          'bmad-method',
          'install',
          '--directory',
          '/Users/dev/my-workspace',
          '--tools',
          'claude-code',
          '--yes'
        ],
        opts: undefined
      }
    ])
  })

  it('successful update ends in done and does not need to touch provisioned (already true)', async () => {
    configStore.setProvisioned(true)
    processRunner.script({
      chunks: [{ stream: 'stdout', data: '◇  2 module(s) up to date\n' }],
      code: 0
    })
    const service = createBmadService(processRunner, configStore)

    const events = await collect(service.update('/Users/dev/my-workspace'))

    expect(events.at(-1)).toEqual({ type: 'done', ok: true })
    expect(configStore.getConfig().provisioned).toBe(true)
  })

  it('failing update ends in error and leaves provisioned untouched (R4.2 "continue anyway")', async () => {
    configStore.setProvisioned(true)
    processRunner.script({
      chunks: [{ stream: 'stderr', data: 'Error: network timeout\n' }],
      code: 1
    })
    const service = createBmadService(processRunner, configStore)

    const events = await collect(service.update('/Users/dev/my-workspace'))

    expect(events.at(-1)).toMatchObject({ type: 'error' })
    // Still provisioned — a failed update must not undo a prior successful install.
    expect(configStore.getConfig().provisioned).toBe(true)
  })

  it('partial lines split across chunk boundaries are still parsed correctly', async () => {
    processRunner.script({
      chunks: [
        { stream: 'stdout', data: '◇  Shared scripts ' },
        { stream: 'stdout', data: 'installed\n◇  Module directories created\n' }
      ],
      code: 0
    })
    const service = createBmadService(processRunner, configStore)

    const events = await collect(service.install('/ws', { modules: ['bmm'] }))

    expect(events).toContainEqual({
      type: 'step',
      id: 'shared-scripts-installed',
      label: 'Shared scripts installed'
    })
    expect(events).toContainEqual({
      type: 'step',
      id: 'module-directories-created',
      label: 'Module directories created'
    })
  })

  // B-1 / P0-001 (test-design-architecture.md, R-01 score 9). The seam that
  // lets an E2E reach the work UI without a real `npx bmad-method install`.
  // The assertion that matters in every case below is `processRunner.calls` —
  // whether anything was spawned at all — not the event shape.
  describe('E2E test seam (B-1)', () => {
    it('seam on + provisioned workspace: resolves done without spawning anything', async () => {
      configStore.setProvisioned(true)
      const service = createBmadService(processRunner, configStore, true)

      const events = await collect(service.update('/ws'))

      expect(events).toEqual([{ type: 'done', ok: true }])
      expect(processRunner.calls).toEqual([])
      // The seam reports the workspace as provisioned; it must not also be
      // what makes it provisioned.
      expect(configStore.getConfig().provisioned).toBe(true)
    })

    it('seam on but workspace NOT provisioned: still runs the real command', async () => {
      // The flag alone must never fake provisioning — otherwise the seam
      // hides the exact failure the gate exists to catch.
      processRunner.script({ code: 0 })
      const service = createBmadService(processRunner, configStore, true)

      await collect(service.update('/ws'))

      expect(processRunner.calls).toHaveLength(1)
      expect(processRunner.calls[0].args).toContain('bmad-method')
    })

    it('seam off + provisioned workspace: still runs the real command (production path)', async () => {
      // R4.1's whole point: a provisioned workspace still updates on launch.
      configStore.setProvisioned(true)
      processRunner.script({ code: 0 })
      const service = createBmadService(processRunner, configStore, false)

      await collect(service.update('/ws'))

      expect(processRunner.calls).toHaveLength(1)
      expect(processRunner.calls[0].args).toContain('bmad-method')
    })

    it('the seam never touches install() — first-run provisioning always runs for real', async () => {
      processRunner.script({ code: 0 })
      const service = createBmadService(processRunner, configStore, true)

      await collect(service.install('/ws', { modules: ['bmm'] }))

      expect(processRunner.calls).toHaveLength(1)
      expect(processRunner.calls[0].args).toContain('install')
    })

    it('isE2ESeamEnabled reads HIVE_E2E=1 and nothing looser', () => {
      expect(isE2ESeamEnabled({ HIVE_E2E: '1' })).toBe(true)
      expect(isE2ESeamEnabled({ HIVE_E2E: 'true' })).toBe(false)
      expect(isE2ESeamEnabled({ HIVE_E2E: '0' })).toBe(false)
      expect(isE2ESeamEnabled({})).toBe(false)
    })
  })
})
