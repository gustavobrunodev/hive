import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createFakeProcessRunner } from './processRunner'
import { scriptedAgentCli, withScriptedAgentCli } from './e2eAgentSeam'

// R-06 / P0-003 — the scripted-agent seam (see e2eAgentSeam.ts for why the
// binary is replaced rather than the adapter). The matrix below is the same one
// B-1 gets in bmadService.test.ts: both conditions, each alone, and neither.
// What is asserted throughout is `runner.calls` — *what was spawned* — because
// that is the entire contract of this module.

describe('e2eAgentSeam', () => {
  let dir: string
  let cliPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hive-seam-'))
    cliPath = join(dir, 'scripted-agent-cli.cjs')
    writeFileSync(cliPath, '// stand-in\n', 'utf-8')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  describe('scriptedAgentCli', () => {
    it('returns the path when the flag is on and the stand-in exists', () => {
      expect(scriptedAgentCli({ HIVE_E2E: '1', HIVE_E2E_AGENT_CLI: cliPath })).toBe(cliPath)
    })

    it('returns null without the flag, even with a valid stand-in', () => {
      // The point of the second condition: a stray variable in a user's
      // environment must never redirect which binary the app executes.
      expect(scriptedAgentCli({ HIVE_E2E_AGENT_CLI: cliPath })).toBeNull()
      expect(scriptedAgentCli({ HIVE_E2E: '0', HIVE_E2E_AGENT_CLI: cliPath })).toBeNull()
      expect(scriptedAgentCli({ HIVE_E2E: 'true', HIVE_E2E_AGENT_CLI: cliPath })).toBeNull()
    })

    it('returns null with the flag alone — it cannot conjure an agent', () => {
      expect(scriptedAgentCli({ HIVE_E2E: '1' })).toBeNull()
      expect(scriptedAgentCli({ HIVE_E2E: '1', HIVE_E2E_AGENT_CLI: '' })).toBeNull()
    })

    it('returns null when the named stand-in is not on disk', () => {
      // Spawning a missing path would surface as "the agent failed", which
      // reads exactly like the product bug the E2E is there to catch.
      const missing = join(dir, 'not-here.cjs')
      expect(scriptedAgentCli({ HIVE_E2E: '1', HIVE_E2E_AGENT_CLI: missing })).toBeNull()
    })

    it('returns null on an empty environment', () => {
      expect(scriptedAgentCli({})).toBeNull()
    })
  })

  describe('withScriptedAgentCli', () => {
    it('redirects the spawn to the stand-in, keeping argv and cwd', () => {
      const runner = createFakeProcessRunner()
      const wrapped = withScriptedAgentCli(runner, {
        HIVE_E2E: '1',
        HIVE_E2E_AGENT_CLI: cliPath
      })

      wrapped.run('claude', ['-p', 'faça um PRD', '--model', 'opus'], { cwd: '/ws' })

      expect(runner.calls).toHaveLength(1)
      expect(runner.calls[0].command).toBe(cliPath)
      // argv untouched: the stand-in receives the very prompt the real CLI
      // would have, which is what lets it act on the request.
      expect(runner.calls[0].args).toEqual(['-p', 'faça um PRD', '--model', 'opus'])
      expect(runner.calls[0].opts?.cwd).toBe('/ws')
    })

    it('tells the stand-in which binary it replaced', () => {
      const runner = createFakeProcessRunner()
      const wrapped = withScriptedAgentCli(runner, {
        HIVE_E2E: '1',
        HIVE_E2E_AGENT_CLI: cliPath
      })

      // Availability detection is a spawn too: one stand-in serves all three
      // registered agents, and answers `--version` per binary.
      wrapped.run('devin', ['--version'])

      expect(runner.calls[0].opts?.env).toEqual({ HIVE_E2E_AGENT_COMMAND: 'devin' })
    })

    it('merges the marker over caller-supplied env instead of dropping it', () => {
      const runner = createFakeProcessRunner()
      const wrapped = withScriptedAgentCli(runner, {
        HIVE_E2E: '1',
        HIVE_E2E_AGENT_CLI: cliPath
      })

      wrapped.run('claude', ['-p', 'oi'], { cwd: '/ws', env: { FOO: 'bar' } })

      expect(runner.calls[0].opts?.env).toEqual({
        FOO: 'bar',
        HIVE_E2E_AGENT_COMMAND: 'claude'
      })
    })

    it('returns the very same runner when the seam is disarmed', () => {
      // Identity, not an equivalent wrapper: production carries no indirection.
      const runner = createFakeProcessRunner()
      expect(withScriptedAgentCli(runner, {})).toBe(runner)
      expect(withScriptedAgentCli(runner, { HIVE_E2E: '1' })).toBe(runner)
      expect(withScriptedAgentCli(runner, { HIVE_E2E_AGENT_CLI: cliPath })).toBe(runner)
    })

    it('disarmed, spawns the real command verbatim', () => {
      const runner = createFakeProcessRunner()
      const wrapped = withScriptedAgentCli(runner, { HIVE_E2E_AGENT_CLI: cliPath })

      wrapped.run('claude', ['-p', 'oi'], { cwd: '/ws' })

      expect(runner.calls[0].command).toBe('claude')
      expect(runner.calls[0].opts?.env).toBeUndefined()
    })
  })
})
