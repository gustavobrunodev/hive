import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * P0-002 / B-2 (test-design-architecture.md, risk R-14 — OPS, score 6).
 *
 * A failing E2E used to leave no trace: no `trace`/`screenshot`/`video`,
 * `retries: 0`, and a CI `upload-artifact` pointing at `playwright-report/` —
 * a directory the `list` reporter never creates, so the upload was a silent
 * no-op. That combination is the mechanism by which four red specs stayed
 * invisible for an unknown length of time.
 *
 * These are guards over the committed configuration, deliberately NOT written
 * as Playwright tests: at that level a `--reporter=` flag on the command line
 * overrides the config, so the assertion would measure the invocation rather
 * than what CI actually runs. They are also the kind of thing that regresses
 * quietly during an unrelated config edit, so they belong in the fast suite
 * that runs on every change.
 */

const repoRoot = join(__dirname, '..', '..')
const playwrightConfig = readFileSync(join(repoRoot, 'playwright.config.ts'), 'utf-8')
const workflow = readFileSync(
  join(repoRoot, '..', '.github', 'workflows', 'hive-desktop.yml'),
  'utf-8'
)

describe('E2E diagnostics configuration (B-2)', () => {
  it('captures a trace, a screenshot and a video on failure', () => {
    expect(playwrightConfig).toMatch(/trace:\s*'retain-on-failure'/)
    expect(playwrightConfig).toMatch(/screenshot:\s*'only-on-failure'/)
    expect(playwrightConfig).toMatch(/video:\s*'retain-on-failure'/)
  })

  it('declares the html reporter, which is what creates playwright-report/', () => {
    // The `list` reporter alone writes nothing to disk. Dropping html here
    // would re-break the CI upload without failing a single test.
    expect(playwrightConfig).toMatch(/reporter:\s*\[\['list'\],\s*\['html'/)
  })

  it('retries once in CI and never locally', () => {
    // A local retry hides the flake you are trying to reproduce; a CI run
    // without one turns every hiccup into a red build.
    expect(playwrightConfig).toMatch(/retries:\s*isCI\s*\?\s*1\s*:\s*0/)
  })

  it('the CI artifact upload points at directories the run actually creates', () => {
    // The original bug, pinned: `playwright-report/` alone was a no-op.
    expect(workflow).toContain('hive-desktop/playwright-report/')
    expect(workflow).toContain('hive-desktop/test-results/')
    // And an empty upload must fail loudly rather than pass as "uploaded".
    expect(workflow).toMatch(/if-no-files-found:\s*error/)
  })

  it('the outputDir the config declares is the one CI uploads', () => {
    const declared = playwrightConfig.match(/outputDir:\s*'([^']+)'/)?.[1]
    expect(declared).toBe('test-results')
    expect(workflow).toContain(`hive-desktop/${declared}/`)
  })
})

/**
 * P0-011 / R-03. The coverage gate is only a gate while it runs inside
 * `verify` without an escape hatch. It spent a milestone as a reporting-only
 * step with `continue-on-error: true`, which is how 14 per-file violations
 * accumulated unnoticed.
 */
describe('coverage gate wiring (P0-011)', () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8'))

  it('verify runs coverage, not just the plain test suite', () => {
    expect(pkg.scripts.verify).toContain('test:coverage')
  })

  it('the CI verify job has no continue-on-error escape hatch', () => {
    const verifyJob = workflow.slice(
      workflow.indexOf('jobs:'),
      workflow.indexOf('  e2e:', workflow.indexOf('jobs:'))
    )
    // Match the YAML key, not the word — the surrounding comment explains why
    // the escape hatch was removed and legitimately mentions it by name.
    expect(verifyJob).not.toMatch(/^\s*continue-on-error:/m)
  })
})

/**
 * Architecture doc, "Melhorias arquiteturais necessárias" #3. `@hive/design-system`
 * is a `file:` link carrying its own physical React, which has already caused a
 * duplicate-React crash and an "invalid hook call". Two independent configs
 * carry the `dedupe` fix today; a third config that forgets it repeats the bug.
 * This is the guard that was asked for.
 */
describe('React dedupe is declared in every config that resolves modules', () => {
  it.each(['electron.vite.config.ts', 'vitest.config.ts'])('%s dedupes react', (file) => {
    const source = readFileSync(join(repoRoot, file), 'utf-8')
    expect(source).toMatch(/dedupe:\s*\[['"]react['"],\s*['"]react-dom['"]\]/)
  })
})
