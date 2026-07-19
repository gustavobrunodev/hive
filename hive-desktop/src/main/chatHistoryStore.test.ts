import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  createChatHistoryStore,
  deriveSessionTitle,
  type ChatHistoryStore
} from './chatHistoryStore'

/**
 * ChatHistoryStore (session-history) — exercised against a real temp dir,
 * same approach as configStore.test.ts: no mocks, disk is the source of
 * truth, a fresh store instance over the same baseDir must see everything.
 */
describe('chatHistoryStore', () => {
  let baseDir: string
  let store: ChatHistoryStore
  const WS = '/home/user/project-a'
  const OTHER_WS = '/home/user/project-b'

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'hive-chat-history-test-'))
    store = createChatHistoryStore(baseDir)
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('starts empty and creates sessions that a fresh instance can read back', () => {
    expect(store.list(WS)).toEqual([])
    const session = store.create(WS, 'claude-cli')
    expect(session.title).toBe('')
    expect(session.messages).toEqual([])

    const reread = createChatHistoryStore(baseDir).get(WS, session.id)
    expect(reread?.id).toBe(session.id)
    expect(reread?.agent).toBe('claude-cli')
  })

  it('appendMessage persists turns, bumps updatedAt, and auto-titles from the first user message', () => {
    const session = store.create(WS, null)
    const meta = store.appendMessage(WS, session.id, {
      role: 'user',
      text: '  Crie   um PRD\npara o app de finanças  '
    })
    expect(meta?.title).toBe('Crie um PRD para o app de finanças')
    expect(meta?.messageCount).toBe(1)

    const after = store.appendMessage(WS, session.id, {
      role: 'assistant',
      text: 'Claro! Vamos lá.'
    })
    expect(after?.title).toBe('Crie um PRD para o app de finanças') // unchanged
    expect(after?.messageCount).toBe(2)
    expect(after?.preview).toBe('Claro! Vamos lá.')
    expect(after !== null && after.updatedAt >= (meta?.updatedAt ?? 0)).toBe(true)

    const full = store.get(WS, session.id)
    expect(full?.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
  })

  it('an assistant-first message never becomes the title', () => {
    const session = store.create(WS, null)
    const meta = store.appendMessage(WS, session.id, { role: 'assistant', text: 'olá!' })
    expect(meta?.title).toBe('')
  })

  // chat-attachments: attachment names persist with their message and read
  // back for the transcript's chips; absent everywhere else.
  it('appendMessage persists attachment names and omits the field when there are none', () => {
    const session = store.create(WS, null)
    store.appendMessage(WS, session.id, {
      role: 'user',
      text: 'resuma',
      attachments: ['relatorio.pdf', 'dados.csv']
    })
    store.appendMessage(WS, session.id, { role: 'assistant', text: 'feito', attachments: [] })

    const full = store.get(WS, session.id)
    expect(full?.messages[0].attachments).toEqual(['relatorio.pdf', 'dados.csv'])
    expect('attachments' in (full?.messages[1] ?? {})).toBe(false)
  })

  it('an attachments-only first user message titles by its first file name', () => {
    const session = store.create(WS, null)
    const meta = store.appendMessage(WS, session.id, {
      role: 'user',
      text: '   ',
      attachments: ['plano-de-metas.xlsx']
    })
    expect(meta?.title).toBe('plano-de-metas.xlsx')
  })

  /** Path of a session's JSON on disk (layout: chat-history/<ws-hash>/<id>.json — a single hash dir exists per used workspace here). */
  function sessionFile(id: string): string {
    const historyDir = join(baseDir, 'chat-history')
    for (const hashDir of readdirSync(historyDir)) {
      const candidates = readdirSync(join(historyDir, hashDir))
      if (candidates.includes(`${id}.json`)) return join(historyDir, hashDir, `${id}.json`)
    }
    throw new Error(`session file not found for ${id}`)
  }

  it('list() returns only the given workspace, newest-updated first', () => {
    const a = store.create(WS, null)
    const b = store.create(WS, null)
    store.create(OTHER_WS, null)
    store.appendMessage(WS, a.id, { role: 'user', text: 'primeira' })
    store.appendMessage(WS, b.id, { role: 'user', text: 'segunda' })
    // Force a strictly later updatedAt for b, deterministically, on disk.
    const bumped = store.get(WS, b.id)
    if (!bumped) throw new Error('session b vanished')
    bumped.updatedAt = Date.now() + 60_000
    writeFileSync(sessionFile(b.id), JSON.stringify(bumped), 'utf-8')

    const metas = store.list(WS)
    expect(metas.map((m) => m.id)).toEqual([b.id, a.id])
    expect(store.list(OTHER_WS)).toHaveLength(1)
  })

  it('rename() sets a custom title and remove() deletes (idempotently)', () => {
    const session = store.create(WS, null)
    store.appendMessage(WS, session.id, { role: 'user', text: 'texto original' })
    const renamed = store.rename(WS, session.id, '  Meu título\ncustom  ')
    expect(renamed?.title).toBe('Meu título custom')

    store.remove(WS, session.id)
    expect(store.get(WS, session.id)).toBeNull()
    expect(store.list(WS)).toEqual([])
    expect(() => store.remove(WS, session.id)).not.toThrow()
  })

  it('mutations on an unknown/deleted id return null (no throw)', () => {
    expect(
      store.appendMessage(WS, '11111111-2222-4333-8444-555555555555', { role: 'user', text: 'x' })
    ).toBeNull()
    expect(store.rename(WS, '11111111-2222-4333-8444-555555555555', 'y')).toBeNull()
  })

  it('rejects non-UUID ids (path traversal cannot reach the filesystem)', () => {
    expect(store.get(WS, '../../../etc/passwd')).toBeNull()
    expect(store.appendMessage(WS, '../escape', { role: 'user', text: 'x' })).toBeNull()
    expect(() => store.remove(WS, '../escape')).not.toThrow()
  })

  it('list() skips corrupt/foreign files instead of throwing', () => {
    const session = store.create(WS, null)
    store.appendMessage(WS, session.id, { role: 'user', text: 'ok' })
    const wsDir = join(baseDir, 'chat-history', readdirSync(join(baseDir, 'chat-history'))[0])
    writeFileSync(join(wsDir, 'corrupt.json'), '{ not json', 'utf-8')
    writeFileSync(join(wsDir, 'foreign.json'), JSON.stringify({ hello: 'world' }), 'utf-8')

    const metas = store.list(WS)
    expect(metas).toHaveLength(1)
    expect(metas[0].id).toBe(session.id)
  })

  // session-history conversation memory: the CLI-native session id round-trips.
  it('setCliSession persists the CLI session id without bumping updatedAt', () => {
    const session = store.create(WS, 'claude-cli')
    store.appendMessage(WS, session.id, { role: 'user', text: 'olá' })
    const before = store.get(WS, session.id)

    store.setCliSession(WS, session.id, 'cli-sess-42')

    const after = store.get(WS, session.id)
    expect(after?.cliSessionId).toBe('cli-sess-42')
    expect(after?.updatedAt).toBe(before?.updatedAt)
    // Unknown id: safe no-op.
    expect(() => store.setCliSession(WS, '11111111-2222-4333-8444-555555555555', 'x')).not.toThrow()
  })

  // session-history full-text search.
  it('search() matches titles and message bodies, accent- and case-insensitively', () => {
    const a = store.create(WS, null)
    store.appendMessage(WS, a.id, { role: 'user', text: 'PRD do app de finanças' })
    const b = store.create(WS, null)
    store.appendMessage(WS, b.id, { role: 'user', text: 'brainstorm de onboarding' })
    store.appendMessage(WS, b.id, {
      role: 'assistant',
      text: 'Uma ideia: usar retentativa em cascata para pagamentos.'
    })

    // Title hit (accent-insensitive: "financas" → "finanças"), match: null.
    const byTitle = store.search(WS, 'FINANCAS')
    expect(byTitle.map((m) => m.id)).toEqual([a.id])
    expect(byTitle[0].match).toBeNull()

    // Message-body hit carries a snippet around the occurrence.
    const byBody = store.search(WS, 'cascata')
    expect(byBody.map((m) => m.id)).toEqual([b.id])
    expect(byBody[0].match).toContain('cascata')

    // No hit.
    expect(store.search(WS, 'zzz-inexistente')).toEqual([])
    // Blank query behaves like list().
    expect(store.search(WS, '   ').length).toBe(2)
  })

  it('search() snippets are single-line windows with ellipses on long messages', () => {
    const session = store.create(WS, null)
    const long = `${'começo '.repeat(20)}\n\nAQUI está o trecho procurado no meio do texto ${'fim '.repeat(30)}`
    store.appendMessage(WS, session.id, { role: 'user', text: long })

    const [hit] = store.search(WS, 'trecho procurado')
    expect(hit.match).toBeTruthy()
    expect(hit.match).toContain('trecho procurado')
    expect(hit.match!.includes('\n')).toBe(false)
    expect(hit.match!.startsWith('…')).toBe(true)
    expect(hit.match!.endsWith('…')).toBe(true)
  })

  it('deriveSessionTitle collapses whitespace and cuts long text at a word boundary', () => {
    expect(deriveSessionTitle('curto e direto')).toBe('curto e direto')
    const long = deriveSessionTitle(
      'Quero criar um PRD extremamente detalhado para o novo aplicativo de gestão financeira pessoal'
    )
    expect(long.endsWith('…')).toBe(true)
    expect(long.length).toBeLessThanOrEqual(65)
    expect(long.includes('\n')).toBe(false)
  })
})
