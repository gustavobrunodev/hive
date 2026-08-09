import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createStudioSessionStore, type StudioSessionStore } from './sessionStore'
import type { StudioSession } from './types'

/**
 * spec.md P2 (Sessão persistida). Exercised against a real temp dir, same
 * approach as `chatHistoryStore.test.ts`: no mocks, disk is the source of
 * truth, and a fresh store over the same baseDir must see everything.
 */
describe('studio sessionStore', () => {
  let baseDir: string
  let workspace: string
  let store: StudioSessionStore
  const SPEC = '/home/user/project-a/docs/ux-spec.md'

  function session(overrides: Partial<StudioSession> = {}): StudioSession {
    return {
      specPath: SPEC,
      workspace,
      dsId: 'web-awesome',
      activeScreenId: 'login',
      screens: [
        {
          screenId: 'login',
          title: 'Login',
          log: {
            entries: [
              {
                command: {
                  type: 'AddComponent',
                  parentId: null,
                  index: 0,
                  node: { id: 'page', tag: 'wa-page', props: {}, children: [] }
                },
                groupId: 'g1',
                at: 1000
              }
            ],
            cursor: 1
          },
          transcript: [{ id: 'm1', role: 'user', text: 'deixe o botão maior', at: 1000 }]
        }
      ],
      ...overrides
    }
  }

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'hive-studio-session-test-'))
    workspace = mkdtempSync(join(tmpdir(), 'hive-studio-workspace-test-'))
    store = createStudioSessionStore(baseDir)
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
    rmSync(workspace, { recursive: true, force: true })
  })

  // AC-1: keyed by (specPathHash, workspaceHash).
  describe('key', () => {
    it('is stable for the same spec and workspace', () => {
      expect(store.key(SPEC, workspace)).toBe(store.key(SPEC, workspace))
    })

    it('differs for a different spec, and for the same spec in another workspace', () => {
      const key = store.key(SPEC, workspace)

      expect(store.key('/home/user/project-a/docs/other.md', workspace)).not.toBe(key)
      expect(store.key(SPEC, '/home/user/project-b')).not.toBe(key)
    })

    it('carries neither path verbatim, so the filename leaks no machine layout', () => {
      const key = store.key(SPEC, workspace)

      expect(key).toMatch(/^[0-9a-f]{16}-[0-9a-f]{16}$/)
      expect(key).not.toContain('ux-spec')
    })
  })

  // AC-1: the command log, the per-screen transcript and the active screen.
  describe('save / get', () => {
    it('round-trips the log, the transcript and the active screen', () => {
      const key = store.key(SPEC, workspace)

      store.save(key, session())

      expect(store.get(key)).toEqual(session())
    })

    it('is readable by a fresh store over the same baseDir — disk is the source of truth', () => {
      const key = store.key(SPEC, workspace)
      store.save(key, session())

      const reopened = createStudioSessionStore(baseDir)

      expect(reopened.get(key)?.screens[0].log.cursor).toBe(1)
      expect(reopened.get(key)?.screens[0].transcript[0].text).toBe('deixe o botão maior')
    })

    it('overwrites the previous state on the next save', () => {
      const key = store.key(SPEC, workspace)
      store.save(key, session())

      store.save(key, session({ activeScreenId: 'signup', screens: [] }))

      expect(store.get(key)?.activeScreenId).toBe('signup')
      expect(store.get(key)?.screens).toEqual([])
    })

    it('returns null for a session that was never saved', () => {
      expect(store.get(store.key(SPEC, workspace))).toBeNull()
    })

    it('keeps two specs in the same workspace independent', () => {
      const first = store.key(SPEC, workspace)
      const second = store.key('/home/user/project-a/docs/other.md', workspace)
      store.save(first, session())

      expect(store.get(second)).toBeNull()
      expect(store.get(first)).not.toBeNull()
    })
  })

  // AC-2: write-temp-then-rename.
  it('leaves no temp file behind after a save', () => {
    const key = store.key(SPEC, workspace)

    store.save(key, session())

    const written = readdirSync(join(baseDir, 'design-studio'))
    expect(written).toEqual([`${key}.json`])
  })

  // AC-3: a corrupt file opens as a fresh session and never throws.
  describe('a damaged session file', () => {
    it('reads as a fresh session for malformed JSON, without throwing', () => {
      const key = store.key(SPEC, workspace)
      mkdirSync(join(baseDir, 'design-studio'), { recursive: true })
      writeFileSync(join(baseDir, 'design-studio', `${key}.json`), '{"screens": [', 'utf-8')

      expect(() => store.get(key)).not.toThrow()
      expect(store.get(key)).toBeNull()
    })

    it('reads as a fresh session for well-formed but foreign JSON', () => {
      const key = store.key(SPEC, workspace)
      mkdirSync(join(baseDir, 'design-studio'), { recursive: true })
      writeFileSync(join(baseDir, 'design-studio', `${key}.json`), '{"hello":"world"}', 'utf-8')

      expect(store.get(key)).toBeNull()
    })

    it('reads as a fresh session when the file is not an object at all', () => {
      const key = store.key(SPEC, workspace)
      mkdirSync(join(baseDir, 'design-studio'), { recursive: true })
      writeFileSync(join(baseDir, 'design-studio', `${key}.json`), 'null', 'utf-8')

      expect(store.get(key)).toBeNull()
    })

    it('reads as a fresh session when a required field has the wrong type', () => {
      const key = store.key(SPEC, workspace)
      mkdirSync(join(baseDir, 'design-studio'), { recursive: true })
      writeFileSync(
        join(baseDir, 'design-studio', `${key}.json`),
        JSON.stringify({ ...session(), activeScreenId: 7 }),
        'utf-8'
      )

      expect(store.get(key)).toBeNull()
    })

    it('accepts a session whose active screen is null', () => {
      const key = store.key(SPEC, workspace)

      store.save(key, session({ activeScreenId: null }))

      expect(store.get(key)?.activeScreenId).toBeNull()
    })
  })

  it('leaves no partial artifact behind when the rename itself fails', () => {
    const key = store.key(SPEC, workspace)
    // A non-empty directory sitting where the session file goes: the write
    // succeeds, the rename cannot.
    mkdirSync(join(baseDir, 'design-studio', `${key}.json`), { recursive: true })
    writeFileSync(join(baseDir, 'design-studio', `${key}.json`, 'blocker'), 'x', 'utf-8')

    expect(() => store.save(key, session())).toThrow()

    const leftovers = readdirSync(join(baseDir, 'design-studio')).filter((entry) =>
      entry.includes('.tmp-')
    )
    expect(leftovers).toEqual([])
  })

  // AC-4: the Studio writes nothing into the user's workspace.
  it('writes only under baseDir, never into the workspace', () => {
    const key = store.key(SPEC, workspace)

    store.save(key, session())

    expect(readdirSync(workspace)).toEqual([])
    expect(existsSync(join(baseDir, 'design-studio', `${key}.json`))).toBe(true)
  })

  // Keys round-trip through the renderer; a malformed one must resolve to no
  // session rather than to a path outside the store.
  describe('a key that this store never minted', () => {
    it('reads as no session', () => {
      expect(store.get('../../etc/passwd')).toBeNull()
      expect(store.get('not-a-key')).toBeNull()
    })

    it('is a no-op on save rather than a write outside the store', () => {
      store.save('../escape', session())

      expect(existsSync(join(baseDir, 'design-studio'))).toBe(false)
    })
  })
})
