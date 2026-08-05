import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  claudePermissionRule,
  grantAgentPermission,
  revokeAgentPermissions
} from './agentPermissions'

/**
 * Real files, real JSON — the whole point of this module is what ends up on
 * disk in `.claude/`, so mocking `fs` would test nothing the user can see.
 */
describe('agentPermissions', () => {
  let workspace: string
  const settingsPath = (): string => join(workspace, '.claude', 'settings.local.json')
  const readSettings = (): Record<string, unknown> =>
    JSON.parse(readFileSync(settingsPath(), 'utf8'))

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'hive-perms-'))
  })
  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true })
  })

  describe('claudePermissionRule', () => {
    it('grants a shell command by its executable, in the CLI’s own prefix syntax', () => {
      expect(claudePermissionRule('Bash', { command: 'mkdir -p out/x' })).toBe('Bash(mkdir:*)')
      expect(claudePermissionRule('Bash', { command: '  npm run build ' })).toBe('Bash(npm:*)')
    })

    it('grants every other tool by name, MCP tools included', () => {
      expect(claudePermissionRule('WebFetch', undefined)).toBe('WebFetch')
      expect(claudePermissionRule('mcp__linear__create_issue', {})).toBe(
        'mcp__linear__create_issue'
      )
    })

    it('refuses to write a rule it cannot narrow, rather than granting the whole shell', () => {
      expect(claudePermissionRule('Bash', {})).toBeNull()
      expect(claudePermissionRule('Bash', { command: '   ' })).toBeNull()
      expect(claudePermissionRule('', {})).toBeNull()
    })
  })

  it('creates .claude/settings.local.json with the grant on the first "sempre permitir"', async () => {
    const grant = await grantAgentPermission({
      agentId: 'claude-cli',
      workspace,
      tool: 'Bash',
      input: { command: 'mkdir -p out' }
    })

    expect(grant).toEqual({ file: settingsPath(), rule: 'Bash(mkdir:*)' })
    // This is the defect the user reported: clicking "Sempre permitir" left
    // `.claude/` empty, so the grant existed only inside Hive.
    expect(readSettings()).toEqual({ permissions: { allow: ['Bash(mkdir:*)'] } })
  })

  it('adds to an existing file without disturbing anything already in it', async () => {
    mkdirSync(join(workspace, '.claude'), { recursive: true })
    writeFileSync(
      settingsPath(),
      JSON.stringify({
        enableAllProjectMcpServers: true,
        permissions: { allow: ['Read'], deny: ['Bash(rm:*)'] }
      })
    )

    await grantAgentPermission({ agentId: 'claude-cli', workspace, tool: 'WebFetch' })

    expect(readSettings()).toEqual({
      enableAllProjectMcpServers: true,
      permissions: { allow: ['Read', 'WebFetch'], deny: ['Bash(rm:*)'] }
    })
  })

  it('is idempotent — re-granting the same rule does not duplicate it', async () => {
    const opts = { agentId: 'claude-cli', workspace, tool: 'Read' }
    await grantAgentPermission(opts)
    const second = await grantAgentPermission(opts)

    expect(second).toEqual({ file: settingsPath(), rule: 'Read' })
    expect(readSettings()).toEqual({ permissions: { allow: ['Read'] } })
  })

  it('writes nothing for an agent with no permission file to write', async () => {
    // Copilot is launched with `--allow-all-tools` and Devin exposes no
    // permission surface at all; inventing a file for either would be a lie
    // about a setting the CLI never reads.
    expect(
      await grantAgentPermission({ agentId: 'github-copilot', workspace, tool: 'Read' })
    ).toBeNull()
    expect(await grantAgentPermission({ agentId: 'devin', workspace, tool: 'Read' })).toBeNull()
    expect(() => readSettings()).toThrow()
  })

  it('leaves a hand-broken settings file alone instead of overwriting it', async () => {
    mkdirSync(join(workspace, '.claude'), { recursive: true })
    writeFileSync(settingsPath(), '{ not json')

    await expect(
      grantAgentPermission({ agentId: 'claude-cli', workspace, tool: 'Read' })
    ).rejects.toThrow(/Invalid JSON/)
    expect(readFileSync(settingsPath(), 'utf8')).toBe('{ not json')
  })

  describe('revokeAgentPermissions', () => {
    it('removes only the rules Hive granted, keeping the user’s own', async () => {
      mkdirSync(join(workspace, '.claude'), { recursive: true })
      writeFileSync(
        settingsPath(),
        JSON.stringify({ permissions: { allow: ['Read', 'Bash(git:*)', 'WebFetch'] } })
      )

      await revokeAgentPermissions('claude-cli', workspace, ['Read', 'WebFetch'])

      expect(readSettings()).toEqual({ permissions: { allow: ['Bash(git:*)'] } })
    })

    it('is a no-op with nothing to remove, or for an agent that has no config', async () => {
      mkdirSync(join(workspace, '.claude'), { recursive: true })
      writeFileSync(settingsPath(), JSON.stringify({ permissions: { allow: ['Read'] } }))

      await revokeAgentPermissions('claude-cli', workspace, ['WebFetch'])
      await revokeAgentPermissions('devin', workspace, ['Read'])
      await revokeAgentPermissions('claude-cli', workspace, [])

      expect(readSettings()).toEqual({ permissions: { allow: ['Read'] } })
    })
  })
})
