import { existsSync, statSync, readdirSync } from 'fs'
import { join } from 'path'
import { isE2ESeamEnabled } from './bmadService'
import type { ProcessRunner, ProcessStreamChunk } from './processRunner'
import type { SkillEvent, VaultInfo } from './secondBrainTypes'

export type { SkillEvent, VaultInfo } from './secondBrainTypes'

export interface SecondBrainService {
  /** SB-R1.1: is the `second-brain` skill installed in this workspace? */
  detect(workspace: string): boolean
  /** SB-R1.1: install all four second-brain skills (absent → install). */
  install(workspace: string): AsyncIterable<SkillEvent>
  /** SB-R1.2: update the installed skills (present → update on every launch). */
  update(workspace: string): AsyncIterable<SkillEvent>
  /** SB-R2.1/2.2: locate the vault in the workspace, or null if not configured. */
  resolveVault(workspace: string): VaultInfo | null
}

/**
 * Filesystem probes, injectable so the service stays Electron-free and
 * unit-testable against fakes (the `workspaceService.ts` DI convention). All
 * default to the real synchronous `fs` calls.
 */
export interface SecondBrainDeps {
  pathExists?: (p: string) => boolean
  isDirectory?: (p: string) => boolean
  readDir?: (p: string) => string[]
}

/**
 * The public GitHub source of the second-brain skill pack (T1 spike). The repo
 * ships FOUR skills — `second-brain` (onboarding wizard), `second-brain-ingest`,
 * `second-brain-lint`, `second-brain-query` — so `--skill '*'` installs them
 * all (a bare `--skill second-brain` would install only the wizard and leave
 * ingest/query/lint undiscoverable; see STATE.md T1 lesson).
 */
export const SECOND_BRAIN_REPO = 'https://github.com/nicholasspisak/second-brain'

/** The install marker on disk (analogous to BMAD's `_bmad/_config/manifest.yaml`). */
const SKILL_MARKER = join('.claude', 'skills', 'second-brain', 'SKILL.md')

// The `skills` CLI uses the same "clack"-style prompt renderer as BMAD:
// `●` informational, `◇`/`◆` a completed step, `✓` a per-item result, and the
// `◒◐◓◑` spinner glyphs for an in-progress step. Captured from a real
// `npx skills add`/`update` run (T1, STATE.md fixtures).
const STEP_MARKERS = new Set(['●', '◇', '◆', '✓'])
const PROGRESS_MARKERS = new Set(['◒', '◐', '◓', '◑'])

// Strips ANSI CSI escapes (cursor hide/show, line-clear, column moves) the
// spinner frames are wrapped in. Built via `String.fromCharCode` so the source
// carries no literal control byte (avoids the `no-control-regex` lint rule).
const ESC = String.fromCharCode(0x1b)
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;?]*[a-zA-Z]`, 'g')

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'step'
  )
}

/**
 * Parses one line of `skills` CLI output into a `SkillEvent`, or `null` for
 * lines with no signal (banner art, box borders, blank lines, the install
 * summary's file list). Only `step`/`progress` originate here.
 */
export function parseSkillLine(rawLine: string): SkillEvent | null {
  const cleaned = rawLine
    .replace(ANSI_PATTERN, '')
    // Strip the box-drawing rail the CLI prefixes/suffixes lines with, plus
    // surrounding whitespace.
    .replace(/^[\s│]+/, '')
    .replace(/[\s│]+$/, '')
    .trim()

  if (cleaned.length === 0) return null

  const marker = cleaned[0]
  const label = cleaned.slice(1).trim()
  if (label.length === 0) return null

  if (STEP_MARKERS.has(marker)) {
    return { type: 'step', id: slugify(label), label }
  }
  if (PROGRESS_MARKERS.has(marker)) {
    return { type: 'progress', message: label }
  }
  return null
}

/**
 * Creates a `SecondBrainService` driving the real, T1-verified vercel-labs
 * `skills` CLI. `processRunner` is injected (the `bmadService.ts`/
 * `workspaceService.ts` DI pattern) so this module has no `electron` import and
 * is unit-testable against a fake runner plus injected fs probes.
 *
 *   install: npx -y skills add <repo> --skill '*' -a claude-code -y   (cwd = ws)
 *   update:  npx -y skills update -p -y                               (cwd = ws)
 *
 * Both run with `cwd = workspace` so the skills land in `<ws>/.claude/skills/`
 * (project scope). Non-interactive: the CLI auto-detects the Claude Code agent;
 * `-y` skips every confirmation.
 */
export function createSecondBrainService(
  processRunner: ProcessRunner,
  deps: SecondBrainDeps = {},
  // B-1's second half. The launch gate has two steps, and bypassing only the
  // BMAD one still parks every E2E on this one. Same contract as
  // `bmadService`: explicit launcher opt-in AND genuinely seeded state (here,
  // the skill marker on disk) — see `isE2ESeamEnabled` in bmadService.ts.
  e2eSeam: boolean = isE2ESeamEnabled()
): SecondBrainService {
  const pathExists = deps.pathExists ?? existsSync
  const isDirectory = deps.isDirectory ?? ((p: string) => statSync(p).isDirectory())
  const readDir = deps.readDir ?? readdirSync

  function detect(workspace: string): boolean {
    return pathExists(join(workspace, SKILL_MARKER))
  }

  function resolveVault(workspace: string): VaultInfo | null {
    // Fast path: the default `<ws>/second-brain/` with the skill's own markers
    // (`wiki/index.md` once scaffolded, or `raw/` staged before the first ingest).
    const defaultDir = join(workspace, 'second-brain')
    if (pathExists(join(defaultDir, 'wiki', 'index.md')) || pathExists(join(defaultDir, 'raw'))) {
      return { path: defaultDir, name: 'second-brain' }
    }
    // Best-effort: a wizard run may have named the vault differently — scan one
    // level for a directory containing the `wiki/index.md` marker.
    let entries: string[]
    try {
      entries = readDir(workspace)
    } catch {
      return null
    }
    for (const entry of entries) {
      const candidate = join(workspace, entry)
      let dir = false
      try {
        dir = isDirectory(candidate)
      } catch {
        dir = false
      }
      if (dir && pathExists(join(candidate, 'wiki', 'index.md'))) {
        return { path: candidate, name: entry }
      }
    }
    return null
  }

  async function* runSkillCommand(
    command: string,
    args: string[],
    workspace: string,
    failureVerb: string
  ): AsyncIterable<SkillEvent> {
    const handle = processRunner.run(command, args, { cwd: workspace })

    const stderrChunks: string[] = []
    // Chunks aren't guaranteed to split on line boundaries — buffer partial
    // lines across chunks rather than parsing each chunk in isolation.
    let lineBuffer = ''

    for await (const chunk of handle.output as AsyncIterable<ProcessStreamChunk>) {
      if (chunk.stream === 'stderr') {
        stderrChunks.push(chunk.data)
      }
      lineBuffer += chunk.data
      const lines = lineBuffer.split(/\r?\n/)
      lineBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const event = parseSkillLine(line)
        if (event) yield event
      }
    }
    if (lineBuffer.length > 0) {
      const event = parseSkillLine(lineBuffer)
      if (event) yield event
    }

    const { code } = await handle.exitCode

    if (code === 0) {
      yield { type: 'done', ok: true }
    } else {
      yield {
        type: 'error',
        message: `second-brain ${failureVerb} exited with code ${code ?? 'unknown'}`,
        detail: stderrChunks.join('').trim() || undefined
      }
    }
  }

  function install(workspace: string): AsyncIterable<SkillEvent> {
    return runSkillCommand(
      'npx',
      ['-y', 'skills', 'add', SECOND_BRAIN_REPO, '--skill', '*', '-a', 'claude-code', '-y'],
      workspace,
      'install'
    )
  }

  async function* seamedDone(): AsyncIterable<SkillEvent> {
    yield { type: 'done', ok: true }
  }

  function update(workspace: string): AsyncIterable<SkillEvent> {
    if (e2eSeam && detect(workspace)) {
      return seamedDone()
    }
    return runSkillCommand('npx', ['-y', 'skills', 'update', '-p', '-y'], workspace, 'update')
  }

  return { detect, install, update, resolveVault }
}
