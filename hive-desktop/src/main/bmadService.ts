import type { ConfigStore } from './configStore'
import type { ProcessRunner, ProcessStreamChunk } from './processRunner'

/**
 * BMAD lifecycle events (R3, R4) — the UI renders these as a guided
 * install/update flow. Shape matches design.md §3 exactly. `prompt` is kept
 * for interface completeness / future-proofing even though the real install
 * command (verified by T0, design.md §7) runs fully non-interactively on
 * `bmad-method@6.10.0` and never actually emits it today — a future
 * interactive flow (or a different install mode) could.
 */
export type BmadEvent =
  | { type: 'step'; id: string; label: string }
  | { type: 'prompt'; id: string; question: string; choices?: string[] }
  | { type: 'progress'; pct?: number; message: string }
  | { type: 'done'; ok: true }
  | { type: 'error'; message: string; detail?: string }

/**
 * The information the guided-install form (design.md §5.1, GuidedInstall.tsx)
 * collects from the user, mapped 1:1 onto `bmad-method install`'s
 * non-interactive flags. Rather than driving the real interactive clack TUI
 * over a pty (fragile screen-scraping), the app abstracts the CLI's questions
 * into its own visual form and then runs the install non-interactively with
 * the answers — matching the app's "terminal abstracted into visual UI"
 * philosophy (context.md C2). All fields except `modules` are optional; an
 * omitted field simply isn't passed, so the CLI keeps its own default.
 */
export interface BmadInstallOptions {
  /** Module IDs to install alongside always-present core (`--modules`), e.g. `['bmm']`. */
  modules: string[]
  /** What agents should call the user (`--user-name`). */
  userName?: string
  /** Language agents chat in (`--communication-language`). */
  communicationLanguage?: string
  /** Language for generated documents (`--document-output-language`). */
  documentOutputLanguage?: string
  /** Output folder relative to the workspace (`--output-folder`). */
  outputFolder?: string
  /**
   * Module-scoped config options, emitted as repeated
   * `--set <module>.<key>=<value>` flags (e.g. `{ 'bmm.user_skill_level': 'intermediate' }`).
   */
  set?: Record<string, string>
}

export interface BmadService {
  install(workspace: string, options: BmadInstallOptions): AsyncIterable<BmadEvent>
  update(workspace: string): AsyncIterable<BmadEvent>
}

/**
 * Flattens a `BmadInstallOptions` into the ordered CLI flag list that sits
 * between `--directory <ws>` and the fixed `--tools claude-code --yes` tail
 * (added by `runInstallCommand`). `--modules` is always present (at least the
 * user's selection); every other flag is included only when its field is set,
 * so unspecified answers fall back to the CLI's own defaults.
 */
function buildInstallArgs(options: BmadInstallOptions): string[] {
  const args: string[] = ['--modules', options.modules.join(',')]
  if (options.userName) args.push('--user-name', options.userName)
  if (options.communicationLanguage)
    args.push('--communication-language', options.communicationLanguage)
  if (options.documentOutputLanguage)
    args.push('--document-output-language', options.documentOutputLanguage)
  if (options.outputFolder) args.push('--output-folder', options.outputFolder)
  for (const [key, value] of Object.entries(options.set ?? {})) {
    args.push('--set', `${key}=${value}`)
  }
  return args
}

// Line-prefix markers observed in a real `bmad-method@6.10.0 install` run
// (T0's captured output, see design.md §7 and the throwaway install's
// `install-run-output.txt`). The CLI uses a "clack"-style prompt renderer:
// `●` for an informational/config-echo line, `◇`/`◆` for a step that just
// completed, and the `◒◐◓◑` spinner glyphs for a step still in progress
// (each frame overwrites the previous one via cursor-movement ANSI codes).
const STEP_MARKERS = new Set(['●', '◇', '◆'])
const PROGRESS_MARKERS = new Set(['◒', '◐', '◓', '◑'])

// Strips ANSI CSI escape sequences (cursor hide/show, line-clear, cursor
// column moves) that the real CLI's spinner frames are wrapped in — e.g.
// `\x1b[?25l`, `\x1b[1G`, `\x1b[J`. Harmless no-op on plain text (the fake
// runner's scripted chunks in tests don't need to include real escape
// bytes). Built from `String.fromCharCode` rather than a `\x1b` literal in
// the regex source so it doesn't trip the `no-control-regex` lint rule.
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
 * Parses a single line of BMAD CLI output into a `BmadEvent`, or `null` if
 * the line carries no signal worth surfacing (banner art, blank lines, box
 * borders, etc.). Only `step`/`progress` come from here — `done`/`error` are
 * synthesized by `install()` from the process's exit result, not parsed from
 * text (the CLI's own closing "BMAD is ready to use!" box is decorative
 * ASCII art, not a machine-readable success signal).
 */
function parseLine(rawLine: string): BmadEvent | null {
  const cleaned = rawLine
    .replace(ANSI_PATTERN, '')
    // Strip the vertical box-drawing rail (`│`) BMAD prefixes every line
    // with, plus surrounding whitespace.
    .replace(/^[\s│]+/, '')
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
 * Creates a `BmadService` that drives the real, T0-verified install/update
 * command (design.md §7). There is no separate `update` subcommand — plain
 * `install --yes` against an already-provisioned directory auto-detects and
 * "defaults to quick-update", so `install()` and `update()` share this one
 * code path, differing only in the flags between `--directory <ws>` and the
 * fixed `--tools claude-code --yes` tail (install carries the guided-form
 * answers built by `buildInstallArgs`; update carries none) and in what a
 * successful run means for `ConfigStore.provisioned`:
 *
 *   install: npx bmad-method install --directory <ws> --modules <sel> [--user-name … --set …] --tools claude-code --yes
 *   update:  npx bmad-method install --directory <ws> --tools claude-code --yes
 *
 * `processRunner` and `configStore` are both injected (mirroring
 * `configStore.ts`/`workspaceService.ts`'s DI pattern) so this module has no
 * `electron` dependency and is unit-testable against a fake `ProcessRunner`
 * plus a real `ConfigStore` on a temp dir — no process spawning or module
 * mocking required.
 */
export function createBmadService(
  processRunner: ProcessRunner,
  configStore: ConfigStore
): BmadService {
  async function* runInstallCommand(
    workspace: string,
    extraArgs: string[],
    failureVerb: string,
    onSuccess: () => void
  ): AsyncIterable<BmadEvent> {
    const handle = processRunner.run('npx', [
      'bmad-method',
      'install',
      '--directory',
      workspace,
      ...extraArgs,
      '--tools',
      'claude-code',
      '--yes'
    ])

    const stderrChunks: string[] = []
    // Chunks are not guaranteed to split on line boundaries, so buffer
    // partial lines across chunks rather than parsing each chunk in
    // isolation.
    let lineBuffer = ''

    for await (const chunk of handle.output as AsyncIterable<ProcessStreamChunk>) {
      if (chunk.stream === 'stderr') {
        stderrChunks.push(chunk.data)
      }
      lineBuffer += chunk.data
      const lines = lineBuffer.split(/\r?\n/)
      // The last split element is either empty (buffer ended on a newline)
      // or a not-yet-terminated partial line — keep it buffered and only
      // parse the complete lines before it.
      lineBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const event = parseLine(line)
        if (event) yield event
      }
    }
    // Stream ended — parse whatever partial line is left, if any (the real
    // CLI's output always ends on a newline, but don't assume it).
    if (lineBuffer.length > 0) {
      const event = parseLine(lineBuffer)
      if (event) yield event
    }

    const { code } = await handle.exitCode

    if (code === 0) {
      onSuccess()
      yield { type: 'done', ok: true }
    } else {
      yield {
        type: 'error',
        message: `bmad-method ${failureVerb} exited with code ${code ?? 'unknown'}`,
        detail: stderrChunks.join('').trim() || undefined
      }
    }
  }

  function install(workspace: string, options: BmadInstallOptions): AsyncIterable<BmadEvent> {
    return runInstallCommand(workspace, buildInstallArgs(options), 'install', () =>
      configStore.setProvisioned(true)
    )
  }

  function update(workspace: string): AsyncIterable<BmadEvent> {
    // Already provisioned going in (R4.1 only runs update on a provisioned
    // workspace) — a successful update doesn't need to re-flip the flag, and
    // a failed one (R4.2's "continue anyway") must not unset it either.
    return runInstallCommand(workspace, [], 'update', () => {})
  }

  return { install, update }
}
