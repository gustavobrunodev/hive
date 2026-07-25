import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createProcessRunner } from './processRunner'
import { createCheckpointService } from './checkpointService'
import { createReviewService, type ReviewService, type ReviewSnapshot } from './reviewService'

/**
 * `ReviewService` is exercised over the **real** `CheckpointService` (temp git +
 * temp userData, the M10 precedent, design.md §9) — integration-leaning so the
 * baseline/diff/accept/reject math is asserted end to end on disk. Only the
 * `onChanged` emit is a spy. STALE uses real mtimes (bumped via `utimesSync`).
 */

let ws: string
let userData: string
let svc: ReviewService
let emitted: Array<{ workspace: string; snapshot: ReviewSnapshot }>

function write(rel: string, content: string): void {
  const abs = join(ws, rel)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content)
}
function read(rel: string): string {
  return readFileSync(join(ws, rel), 'utf-8')
}
/** The most recent snapshot handed to `onChanged`. */
function latest(): ReviewSnapshot {
  return emitted[emitted.length - 1].snapshot
}

beforeEach(() => {
  ws = mkdtempSync(join(tmpdir(), 'hive-rv-ws-'))
  userData = mkdtempSync(join(tmpdir(), 'hive-rv-ud-'))
  emitted = []
  const checkpoint = createCheckpointService({
    processRunner: createProcessRunner(),
    userDataDir: userData
  })
  svc = createReviewService({
    checkpoint,
    onChanged: (workspace, snapshot) => emitted.push({ workspace, snapshot }),
    now: () => 1_000
  })
})

afterEach(() => {
  rmSync(ws, { recursive: true, force: true })
  rmSync(userData, { recursive: true, force: true })
})

describe('turn lifecycle + capture', () => {
  it('captures the agent’s writes into the pending set after a turn', async () => {
    write('seed.txt', 'seed\n')
    await svc.beginTurn(ws, 't1')
    // Agent writes mid-turn.
    write('a.txt', 'created by agent\n')
    write('seed.txt', 'edited by agent\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['a.txt', 'seed.txt'])

    const snap = latest()
    expect(snap.changes.map((c) => c.path).sort()).toEqual(['a.txt', 'seed.txt'])
    const created = snap.changes.find((c) => c.path === 'a.txt')!
    expect(created.status).toBe('created')
    expect(created.adds).toBe(1)
    // The turn mark carries the touched paths for the chat card.
    expect(snap.turns).toHaveLength(1)
    expect(snap.turns[0]).toMatchObject({ turnId: 't1', at: 1_000, paths: ['a.txt', 'seed.txt'] })
  })

  it('accumulates two turns into a single set (ACR-C5)', async () => {
    await svc.beginTurn(ws, 't1')
    write('one.txt', 'first turn\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['one.txt'])

    await svc.beginTurn(ws, 't2')
    write('two.txt', 'second turn\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't2', ['two.txt'])

    const snap = latest()
    expect(snap.changes.map((c) => c.path).sort()).toEqual(['one.txt', 'two.txt'])
    expect(snap.turns.map((t) => t.turnId)).toEqual(['t1', 't2'])
  })

  it('does not spin up a set (or emit) for idle activity with no active turn', async () => {
    write('idle.txt', 'manual edit\n')
    await svc.onFsActivity(ws)
    expect(emitted).toEqual([]) // no baseline → no recompute, no emit
    expect(await svc.get(ws)).toEqual({ changes: [], turns: [] })
  })
})

describe('acceptFile / rejectFile', () => {
  async function oneTurnTwoFiles(): Promise<void> {
    await svc.beginTurn(ws, 't1')
    write('keep.txt', 'agent keep\n')
    write('drop.txt', 'agent drop\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['keep.txt', 'drop.txt'])
  }

  it('acceptFile keeps the bytes and removes it from the set', async () => {
    await oneTurnTwoFiles()
    const res = await svc.acceptFile(ws, 'keep.txt')
    expect(res).toEqual({ ok: true })
    expect(read('keep.txt')).toBe('agent keep\n') // bytes kept
    expect(latest().changes.map((c) => c.path)).toEqual(['drop.txt'])
  })

  it('rejectFile restores pre-turn bytes and removes it from the set', async () => {
    write('drop.txt', 'ORIGINAL\n')
    await svc.beginTurn(ws, 't1')
    write('drop.txt', 'agent drop\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['drop.txt'])

    const res = await svc.rejectFile(ws, 'drop.txt')
    expect(res).toEqual({ ok: true })
    expect(read('drop.txt')).toBe('ORIGINAL\n') // restored
    expect(latest().changes).toEqual([])
  })

  it('rejectFile deletes a created file', async () => {
    await svc.beginTurn(ws, 't1')
    write('new.txt', 'agent made this\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['new.txt'])

    await svc.rejectFile(ws, 'new.txt')
    expect(existsSync(join(ws, 'new.txt'))).toBe(false)
  })

  it('rejectFile restores an agent-deleted file (no mtime baseline to guard)', async () => {
    write('gone.txt', 'bring me back\n')
    await svc.beginTurn(ws, 't1')
    rmSync(join(ws, 'gone.txt')) // agent deletes it
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['gone.txt'])
    expect(latest().changes[0]).toMatchObject({ path: 'gone.txt', status: 'deleted' })

    const res = await svc.rejectFile(ws, 'gone.txt')
    expect(res).toEqual({ ok: true })
    expect(read('gone.txt')).toBe('bring me back\n')
  })

  it('accept/reject on a clean workspace are no-ops', async () => {
    expect(await svc.acceptFile(ws, 'x')).toEqual({ ok: true })
    expect(await svc.rejectFile(ws, 'x')).toEqual({ ok: true })
    expect(await svc.acceptHunk(ws, 'x', '0:1:1')).toEqual({ ok: true })
    expect(await svc.rejectHunk(ws, 'x', '0:1:1')).toEqual({ ok: true })
    expect(await svc.acceptAll(ws)).toEqual({ ok: true })
    expect(await svc.rejectAll(ws)).toEqual({ ok: true })
  })
})

describe('acceptHunk / rejectHunk', () => {
  async function twoHunkTurn(): Promise<string> {
    const base = Array.from({ length: 12 }, (_, i) => `l${i + 1}`)
    write('f.txt', base.join('\n') + '\n')
    await svc.beginTurn(ws, 't1')
    const edited = [...base]
    edited[0] = 'L1_NEW'
    edited[11] = 'L12_NEW'
    write('f.txt', edited.join('\n') + '\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['f.txt'])
    // Return the id of the second hunk (line 12).
    const change = latest().changes.find((c) => c.path === 'f.txt')!
    // hunkId = `${index}:${oldStart}:${newStart}` (see gitParse).
    const h = change.diff.hunks[1]
    return `1:${h.oldStart}:${h.newStart}`
  }

  it('rejectHunk reverts one hunk on disk, leaving the other', async () => {
    const secondId = await twoHunkTurn()
    await svc.rejectHunk(ws, 'f.txt', secondId)
    expect(read('f.txt')).toContain('L1_NEW') // first hunk kept
    expect(read('f.txt')).toContain('l12') // second hunk reverted
    expect(read('f.txt')).not.toContain('L12_NEW')
  })

  it('acceptHunk advances the baseline for one hunk, leaving the other pending', async () => {
    const base = Array.from({ length: 12 }, (_, i) => `l${i + 1}`)
    write('f.txt', base.join('\n') + '\n')
    await svc.beginTurn(ws, 't1')
    const edited = [...base]
    edited[0] = 'L1_NEW'
    edited[11] = 'L12_NEW'
    write('f.txt', edited.join('\n') + '\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['f.txt'])

    const change = latest().changes.find((c) => c.path === 'f.txt')!
    const firstId = `0:${change.diff.hunks[0].oldStart}:${change.diff.hunks[0].newStart}`
    await svc.acceptHunk(ws, 'f.txt', firstId)

    const after = latest().changes.find((c) => c.path === 'f.txt')!
    const remaining = after.diff.hunks.flatMap((h) => h.lines)
    expect(remaining.some((l) => l.type === 'add' && l.text === 'L12_NEW')).toBe(true)
    expect(remaining.some((l) => l.type === 'add' && l.text === 'L1_NEW')).toBe(false)
  })

  it('returns not-ok for an unknown hunk id', async () => {
    await svc.beginTurn(ws, 't1')
    write('f.txt', 'x\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['f.txt'])
    expect(await svc.rejectHunk(ws, 'f.txt', '9:9:9')).toEqual({ ok: false })
  })
})

describe('acceptAll / rejectAll', () => {
  async function threeChanges(): Promise<void> {
    write('mod.txt', 'ORIGINAL\n')
    await svc.beginTurn(ws, 't1')
    write('mod.txt', 'agent mod\n')
    write('new.txt', 'agent new\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['mod.txt', 'new.txt'])
  }

  it('acceptAll keeps all bytes and clears the set', async () => {
    await threeChanges()
    const res = await svc.acceptAll(ws)
    expect(res).toEqual({ ok: true })
    expect(read('mod.txt')).toBe('agent mod\n')
    expect(read('new.txt')).toBe('agent new\n')
    expect(latest().changes).toEqual([])
    expect(latest().turns).toEqual([])
  })

  it('rejectAll restores every pre-turn byte and clears the set', async () => {
    await threeChanges()
    const res = await svc.rejectAll(ws)
    expect(res).toEqual({ ok: true })
    expect(read('mod.txt')).toBe('ORIGINAL\n') // reverted
    expect(existsSync(join(ws, 'new.txt'))).toBe(false) // created → deleted
    expect(latest().changes).toEqual([])
  })
})

describe('STALE concurrent-edit guard (ACR-R3.2)', () => {
  it('returns {stale:true} instead of clobbering a hand-edited file', async () => {
    write('f.txt', 'ORIGINAL\n')
    await svc.beginTurn(ws, 't1')
    write('f.txt', 'agent wrote\n')
    await svc.onFsActivity(ws) // captures the mtime baseline
    await svc.endTurn(ws, 't1', ['f.txt'])

    // The user hand-edits the file afterward (mtime bumped forward) without a
    // recompute — an accept/reject now would clobber their work.
    write('f.txt', 'user hand-edit\n')
    utimesSync(join(ws, 'f.txt'), new Date(), new Date(Date.now() + 60_000))

    const res = await svc.rejectFile(ws, 'f.txt')
    expect(res).toEqual({ ok: false, stale: true })
    expect(read('f.txt')).toBe('user hand-edit\n') // NOT clobbered
    expect(latest().changes.find((c) => c.path === 'f.txt')!.staleUserEdit).toBe(true)
  })
})

describe('get + teardown', () => {
  it('get recomputes the current snapshot', async () => {
    await svc.beginTurn(ws, 't1')
    write('a.txt', 'x\n')
    await svc.onFsActivity(ws)
    const snap = await svc.get(ws)
    expect(snap.changes.map((c) => c.path)).toEqual(['a.txt'])
  })

  it('get on a clean workspace returns an empty snapshot', async () => {
    expect(await svc.get(ws)).toEqual({ changes: [], turns: [] })
  })

  it('teardown drops in-memory state', async () => {
    await svc.beginTurn(ws, 't1')
    write('a.txt', 'x\n')
    await svc.onFsActivity(ws)
    svc.teardown(ws)
    // After teardown the workspace looks clean again (baseline forgotten).
    expect(await svc.get(ws)).toEqual({ changes: [], turns: [] })
  })

  it('emits on every mutation', async () => {
    const spy = vi.spyOn({ f: () => {} }, 'f')
    expect(spy).not.toHaveBeenCalled() // sanity
    await svc.beginTurn(ws, 't1')
    expect(emitted.length).toBeGreaterThan(0)
    expect(emitted[emitted.length - 1].workspace).toBe(ws)
  })
})
