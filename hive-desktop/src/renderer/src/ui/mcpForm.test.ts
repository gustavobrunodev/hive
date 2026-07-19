import { describe, expect, it } from 'vitest'
import {
  applyPreset,
  connectionSummary,
  draftFromServer,
  emptyDraft,
  envToText,
  headersToText,
  isDraftValid,
  MCP_PRESETS,
  parseEnv,
  parseHeaders,
  toConfig,
  type McpDraft,
  type McpServer
} from './mcpForm'

describe('mcpForm — text ⇄ config translation (mcp)', () => {
  it('emptyDraft is a blank stdio draft', () => {
    expect(emptyDraft()).toEqual({
      name: '',
      transport: 'stdio',
      command: '',
      argsText: '',
      envText: '',
      url: '',
      headersText: ''
    })
  })

  describe('parseEnv', () => {
    it('parses KEY=value lines, trimming and skipping blanks/keyless entries', () => {
      expect(parseEnv('API_KEY=abc\n  TOKEN = xyz \n\n=novalue\nBAD')).toEqual({
        API_KEY: 'abc',
        TOKEN: 'xyz'
      })
    })
    it('keeps `=` inside the value (only the first splits)', () => {
      expect(parseEnv('URL=https://x?a=b')).toEqual({ URL: 'https://x?a=b' })
    })
  })

  describe('parseHeaders', () => {
    it('parses "Name: value" lines, skipping blanks/nameless entries', () => {
      expect(parseHeaders('Authorization: Bearer x\n: nope\nBad')).toEqual({
        Authorization: 'Bearer x'
      })
    })
    it('keeps colons inside the value', () => {
      expect(parseHeaders('X-Time: 10:30')).toEqual({ 'X-Time': '10:30' })
    })
  })

  it('envToText / headersToText round-trip back to lines (and empty for undefined)', () => {
    expect(envToText({ A: '1', B: '2' })).toBe('A=1\nB=2')
    expect(envToText(undefined)).toBe('')
    expect(headersToText({ Authorization: 'Bearer x' })).toBe('Authorization: Bearer x')
    expect(headersToText(undefined)).toBe('')
  })

  describe('toConfig', () => {
    it('collapses an stdio draft, omitting empty args/env', () => {
      const draft: McpDraft = { ...emptyDraft(), name: 'x', command: 'npx' }
      expect(toConfig(draft)).toEqual({ transport: 'stdio', command: 'npx' })
    })
    it('includes args + env when present', () => {
      const draft: McpDraft = {
        ...emptyDraft(),
        command: 'npx',
        argsText: '-y\n@scope/pkg',
        envText: 'K=v'
      }
      expect(toConfig(draft)).toEqual({
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@scope/pkg'],
        env: { K: 'v' }
      })
    })
    it('collapses a remote draft, omitting empty headers', () => {
      const draft: McpDraft = { ...emptyDraft(), transport: 'http', url: 'https://x/mcp' }
      expect(toConfig(draft)).toEqual({ transport: 'http', url: 'https://x/mcp' })
    })
    it('includes headers when present', () => {
      const draft: McpDraft = {
        ...emptyDraft(),
        transport: 'http',
        url: 'https://x',
        headersText: 'Authorization: Bearer t'
      }
      expect(toConfig(draft)).toEqual({
        transport: 'http',
        url: 'https://x',
        headers: { Authorization: 'Bearer t' }
      })
    })
  })

  describe('draftFromServer', () => {
    it('rehydrates an stdio server into an editable draft', () => {
      const server: McpServer = {
        name: 'srv',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'pkg'],
        env: { K: 'v' },
        enabled: true
      }
      expect(draftFromServer(server)).toEqual({
        name: 'srv',
        transport: 'stdio',
        command: 'npx',
        argsText: '-y\npkg',
        envText: 'K=v',
        url: '',
        headersText: ''
      })
    })
    it('rehydrates a remote server (empty stdio fields)', () => {
      const server: McpServer = {
        name: 'remote',
        transport: 'http',
        url: 'https://x',
        enabled: false
      }
      expect(draftFromServer(server)).toMatchObject({
        name: 'remote',
        transport: 'http',
        url: 'https://x',
        command: '',
        argsText: ''
      })
    })
  })

  describe('isDraftValid', () => {
    it('requires a name', () => {
      expect(isDraftValid({ ...emptyDraft(), name: 'srv', command: 'npx' })).toBe(true)
      expect(isDraftValid({ ...emptyDraft(), name: '   ', command: 'npx' })).toBe(false)
    })
    it('requires a command for stdio and a url for remote', () => {
      expect(isDraftValid({ ...emptyDraft(), name: 'x' })).toBe(false)
      expect(isDraftValid({ ...emptyDraft(), name: 'x', transport: 'http' })).toBe(false)
      expect(isDraftValid({ ...emptyDraft(), name: 'x', transport: 'http', url: 'u' })).toBe(true)
    })
  })

  describe('connectionSummary', () => {
    it('joins command + args for stdio', () => {
      expect(connectionSummary({ transport: 'stdio', command: 'npx', args: ['-y', 'p'] })).toBe(
        'npx -y p'
      )
    })
    it('returns the url for remote (and empty when absent)', () => {
      expect(connectionSummary({ transport: 'http', url: 'https://x' })).toBe('https://x')
      expect(connectionSummary({ transport: 'stdio' })).toBe('')
    })
  })

  describe('presets', () => {
    it('ships a non-empty curated set, each with a valid draft', () => {
      expect(MCP_PRESETS.length).toBeGreaterThan(0)
      for (const preset of MCP_PRESETS) {
        expect(isDraftValid(preset.draft)).toBe(true)
      }
    })
    it('applyPreset substitutes {workspace} in args', () => {
      const filesystem = MCP_PRESETS.find((p) => p.id === 'filesystem')!
      const applied = applyPreset(filesystem, '/home/me/project')
      expect(applied.argsText).toContain('/home/me/project')
      expect(applied.argsText).not.toContain('{workspace}')
    })
    it('applyPreset leaves presets without {workspace} unchanged', () => {
      const playwright = MCP_PRESETS.find((p) => p.id === 'playwright')!
      expect(applyPreset(playwright, '/ws').argsText).toBe(playwright.draft.argsText)
    })
  })
})
