import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createFakeProcessRunner, type FakeProcessRunner } from './processRunner'
import {
  createSecondBrainService,
  parseSkillLine,
  SECOND_BRAIN_REPO,
  type SkillEvent
} from './secondBrainService'

// Real `skills` CLI output captured from the T1 spike (STATE.md fixtures),
// ANSI/box glyphs included — the parser must survive them.
const ADD_OUTPUT = [
  '\x1b[?25l│',
  '●   claude-code_2-1-218_agent  Agent detected — installing non-interactively',
  '│',
  '◇  Source: https://github.com/nicholasspisak/second-brain.git',
  '◒  Cloning repository…',
  '◐  Cloning repository…',
  '◇  Repository cloned',
  '◇  Found 4 skills',
  '●  Installing all 4 skills',
  '◇  Installation Summary ──────────╮',
  '│  ./.agents/skills/second-brain         │',
  '│    copy → Claude Code                  │',
  '│  ./.agents/skills/second-brain-ingest  │',
  '◇  Installation complete',
  '◇  Installed 4 skills ───────────────────────╮',
  '│  ✓ second-brain (copied)                   │',
  '│  ✓ second-brain-ingest (copied)            │',
  '│  ✓ second-brain-lint (copied)              │',
  '│  ✓ second-brain-query (copied)             │',
  '└  Done!  Review skills before use; they run with full agent permissions.'
].join('\n')

const UPDATE_OUTPUT = [
  'Checking for skill updates…',
  '  ✓ Updated second-brain',
  '  ✓ Updated second-brain-ingest',
  '  ✓ Updated second-brain-lint',
  '  ✓ Updated second-brain-query',
  '✓ Updated 4 skill(s)'
].join('\n')

describe('SecondBrainService', () => {
  let baseDir: string
  let processRunner: FakeProcessRunner

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'hive-sb-service-'))
    processRunner = createFakeProcessRunner()
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  async function collect(events: AsyncIterable<SkillEvent>): Promise<SkillEvent[]> {
    const out: SkillEvent[] = []
    for await (const event of events) out.push(event)
    return out
  }

  describe('parseSkillLine', () => {
    it('surfaces ● informational and ◇ completed lines as steps', () => {
      expect(parseSkillLine('◇  Found 4 skills')).toEqual({
        type: 'step',
        id: 'found-4-skills',
        label: 'Found 4 skills'
      })
      expect(parseSkillLine('●  Installing all 4 skills')?.type).toBe('step')
    })

    it('surfaces ✓ per-item lines as steps, stripping trailing box rail', () => {
      expect(parseSkillLine('│  ✓ second-brain (copied)                   │')).toEqual({
        type: 'step',
        id: 'second-brain-copied',
        label: 'second-brain (copied)'
      })
    })

    it('surfaces spinner glyphs as progress', () => {
      expect(parseSkillLine('◒  Cloning repository…')).toEqual({
        type: 'progress',
        message: 'Cloning repository…'
      })
    })

    it('strips ANSI escapes before matching', () => {
      expect(parseSkillLine('\x1b[?25l│ ◇  Repository cloned')).toEqual({
        type: 'step',
        id: 'repository-cloned',
        label: 'Repository cloned'
      })
    })

    it('ignores box borders, the summary file list, and blank lines', () => {
      expect(parseSkillLine('│')).toBeNull()
      expect(parseSkillLine('')).toBeNull()
      expect(parseSkillLine('│  ./.agents/skills/second-brain         │')).toBeNull()
      expect(parseSkillLine('│    copy → Claude Code                  │')).toBeNull()
    })
  })

  describe('install()', () => {
    it('runs `skills add --skill * -a claude-code` with cwd = workspace', async () => {
      processRunner.script({ code: 0 })
      const service = createSecondBrainService(processRunner)

      await collect(service.install('/ws'))

      expect(processRunner.calls).toEqual([
        {
          command: 'npx',
          args: [
            '-y',
            'skills',
            'add',
            SECOND_BRAIN_REPO,
            '--skill',
            '*',
            '-a',
            'claude-code',
            '-y'
          ],
          opts: { cwd: '/ws' }
        }
      ])
    })

    it('streams steps/progress then done on exit 0', async () => {
      processRunner.script({
        chunks: [{ stream: 'stdout', data: ADD_OUTPUT }],
        code: 0
      })
      const service = createSecondBrainService(processRunner)

      const events = await collect(service.install('/ws'))

      expect(events.some((e) => e.type === 'step' && e.label === 'Found 4 skills')).toBe(true)
      expect(events.some((e) => e.type === 'step' && e.label === 'second-brain (copied)')).toBe(
        true
      )
      expect(events.some((e) => e.type === 'progress')).toBe(true)
      expect(events.at(-1)).toEqual({ type: 'done', ok: true })
    })

    it('emits an error (with stderr detail) on a non-zero exit', async () => {
      processRunner.script({
        chunks: [{ stream: 'stderr', data: 'network is unreachable' }],
        code: 1
      })
      const service = createSecondBrainService(processRunner)

      const events = await collect(service.install('/ws'))

      expect(events.at(-1)).toEqual({
        type: 'error',
        message: 'second-brain install exited with code 1',
        detail: 'network is unreachable'
      })
    })

    it('parses a line split across chunk boundaries', async () => {
      processRunner.script({
        chunks: [
          { stream: 'stdout', data: '◇  Found ' },
          { stream: 'stdout', data: '4 skills\n' }
        ],
        code: 0
      })
      const service = createSecondBrainService(processRunner)

      const events = await collect(service.install('/ws'))
      expect(events.some((e) => e.type === 'step' && e.label === 'Found 4 skills')).toBe(true)
    })
  })

  describe('update()', () => {
    it('runs `skills update -p -y` with cwd = workspace', async () => {
      processRunner.script({ code: 0 })
      const service = createSecondBrainService(processRunner)

      await collect(service.update('/ws'))

      expect(processRunner.calls).toEqual([
        { command: 'npx', args: ['-y', 'skills', 'update', '-p', '-y'], opts: { cwd: '/ws' } }
      ])
    })

    it('streams the ✓ Updated lines then done', async () => {
      processRunner.script({
        chunks: [{ stream: 'stdout', data: UPDATE_OUTPUT }],
        code: 0
      })
      const service = createSecondBrainService(processRunner)

      const events = await collect(service.update('/ws'))
      expect(events.some((e) => e.type === 'step' && e.label === 'Updated second-brain')).toBe(true)
      expect(events.at(-1)).toEqual({ type: 'done', ok: true })
    })

    it('emits an error on a non-zero update exit (no stderr → no detail)', async () => {
      processRunner.script({ code: 2 })
      const service = createSecondBrainService(processRunner)

      const events = await collect(service.update('/ws'))
      expect(events.at(-1)).toEqual({
        type: 'error',
        message: 'second-brain update exited with code 2'
      })
    })
  })

  describe('detect()', () => {
    it('is true only when the SKILL.md marker exists on disk', () => {
      const service = createSecondBrainService(processRunner)
      expect(service.detect(baseDir)).toBe(false)

      mkdirSync(join(baseDir, '.claude', 'skills', 'second-brain'), { recursive: true })
      writeFileSync(join(baseDir, '.claude', 'skills', 'second-brain', 'SKILL.md'), '# skill')
      expect(service.detect(baseDir)).toBe(true)
    })
  })

  describe('resolveVault()', () => {
    it('returns null when no vault exists', () => {
      const service = createSecondBrainService(processRunner)
      expect(service.resolveVault(baseDir)).toBeNull()
    })

    it('finds the default second-brain/ via a wiki/index.md marker', () => {
      mkdirSync(join(baseDir, 'second-brain', 'wiki'), { recursive: true })
      writeFileSync(join(baseDir, 'second-brain', 'wiki', 'index.md'), '# wiki')
      const service = createSecondBrainService(processRunner)
      expect(service.resolveVault(baseDir)).toEqual({
        path: join(baseDir, 'second-brain'),
        name: 'second-brain'
      })
    })

    it('finds the default second-brain/ via a raw/ marker (pre-scaffold)', () => {
      mkdirSync(join(baseDir, 'second-brain', 'raw'), { recursive: true })
      const service = createSecondBrainService(processRunner)
      expect(service.resolveVault(baseDir)?.name).toBe('second-brain')
    })

    it('finds a differently-named vault by scanning one level for wiki/index.md', () => {
      mkdirSync(join(baseDir, 'kb', 'wiki'), { recursive: true })
      writeFileSync(join(baseDir, 'kb', 'wiki', 'index.md'), '# wiki')
      writeFileSync(join(baseDir, 'a-file.txt'), 'not a dir')
      const service = createSecondBrainService(processRunner)
      expect(service.resolveVault(baseDir)).toEqual({
        path: join(baseDir, 'kb'),
        name: 'kb'
      })
    })

    it('tolerates an unreadable workspace and a stat failure during the scan', () => {
      const service = createSecondBrainService(processRunner, {
        pathExists: () => false,
        readDir: () => {
          throw new Error('EACCES')
        }
      })
      expect(service.resolveVault('/nope')).toBeNull()

      const service2 = createSecondBrainService(processRunner, {
        pathExists: () => false,
        readDir: () => ['weird'],
        isDirectory: () => {
          throw new Error('ELOOP')
        }
      })
      expect(service2.resolveVault('/x')).toBeNull()
    })
  })

  // B-1's second half (test-design-architecture.md, R-01). The launch gate has
  // two steps; bypassing only the BMAD one still parks every E2E here.
  describe('E2E test seam (B-1)', () => {
    function seedSkill(workspace: string): void {
      const skillDir = join(workspace, '.claude', 'skills', 'second-brain')
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, 'SKILL.md'), '# test fixture\n', 'utf-8')
    }

    it('seam on + skill present on disk: resolves done without spawning anything', async () => {
      seedSkill(baseDir)
      const service = createSecondBrainService(processRunner, {}, true)

      const events = await collect(service.update(baseDir))

      expect(events).toEqual([{ type: 'done', ok: true }])
      expect(processRunner.calls).toEqual([])
    })

    it('seam on but skill absent: still runs the real command', async () => {
      processRunner.script({ code: 0 })
      const service = createSecondBrainService(processRunner, {}, true)

      await collect(service.update(baseDir))

      expect(processRunner.calls).toHaveLength(1)
      expect(processRunner.calls[0].args).toContain('skills')
    })

    it('seam off + skill present: still runs the real command (production path)', async () => {
      seedSkill(baseDir)
      processRunner.script({ code: 0 })
      const service = createSecondBrainService(processRunner, {}, false)

      await collect(service.update(baseDir))

      expect(processRunner.calls).toHaveLength(1)
      expect(processRunner.calls[0].args).toContain('skills')
    })

    it('the seam never touches install() — first-run provisioning always runs for real', async () => {
      seedSkill(baseDir)
      processRunner.script({ code: 0 })
      const service = createSecondBrainService(processRunner, {}, true)

      await collect(service.install(baseDir))

      expect(processRunner.calls).toHaveLength(1)
      expect(processRunner.calls[0].args).toContain(SECOND_BRAIN_REPO)
    })
  })
})
