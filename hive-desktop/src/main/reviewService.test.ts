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
    expect(await svc.acceptFiles(ws, ['x'])).toEqual({ ok: true })
    expect(await svc.rejectFiles(ws, ['x'])).toEqual({ ok: true })
  })
})

/**
 * The change card's "Aceitar tudo" / "Rejeitar tudo" — one turn's whole set as
 * one decision. The card used to loop the single-file calls from the renderer,
 * so the user clicked once and watched the files being reviewed one at a time,
 * each on its own baseline advance and its own emit.
 */
describe('acceptFiles / rejectFiles (one turn, one decision)', () => {
  async function threeFileTurn(): Promise<void> {
    write('mine.txt', 'ORIGINAL\n')
    await svc.beginTurn(ws, 't1')
    write('a.txt', 'agent a\n')
    write('b.txt', 'agent b\n')
    write('mine.txt', 'agent edited\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['a.txt', 'b.txt', 'mine.txt'])
  }

  it('accepts every named file at once — one emit, not one per file', async () => {
    await threeFileTurn()
    const before = emitted.length

    const res = await svc.acceptFiles(ws, ['a.txt', 'b.txt', 'mine.txt'])

    expect(res).toEqual({ ok: true })
    expect(latest().changes).toEqual([])
    expect(read('a.txt')).toBe('agent a\n')
    // The single-emit contract is the fix: N emits meant N intermediate
    // renders, which is exactly what "aceita 1 arquivo por 1" looked like.
    expect(emitted.length - before).toBe(1)
  })

  it('accepts only the named subset, leaving the rest pending', async () => {
    await threeFileTurn()
    await svc.acceptFiles(ws, ['a.txt'])
    expect(latest().changes.map((c) => c.path)).toEqual(['b.txt', 'mine.txt'])
  })

  it('rejects every named file at once, restoring pre-turn bytes', async () => {
    await threeFileTurn()
    const before = emitted.length

    const res = await svc.rejectFiles(ws, ['a.txt', 'b.txt', 'mine.txt'])

    expect(res).toEqual({ ok: true })
    expect(existsSync(join(ws, 'a.txt'))).toBe(false) // created → deleted
    expect(read('mine.txt')).toBe('ORIGINAL\n') // modified → restored
    expect(latest().changes).toEqual([])
    expect(emitted.length - before).toBe(1)
  })

  it('stops on a file hand-edited after the turn instead of clobbering it', async () => {
    await threeFileTurn()
    // The user edits one of the turn's files afterwards (STALE, ACR-R3.2).
    const future = new Date(Date.now() + 60_000)
    writeFileSync(join(ws, 'b.txt'), 'my own edit\n')
    utimesSync(join(ws, 'b.txt'), future, future)

    expect(await svc.acceptFiles(ws, ['a.txt', 'b.txt'])).toEqual({ ok: false, stale: true })
    // Nothing was decided — the batch is all-or-ask, so `a.txt` is untouched.
    expect(latest().changes.map((c) => c.path)).toContain('a.txt')
    expect(read('b.txt')).toBe('my own edit\n')
  })

  it('an empty set is a no-op', async () => {
    await threeFileTurn()
    const before = emitted.length
    expect(await svc.acceptFiles(ws, [])).toEqual({ ok: true })
    expect(await svc.rejectFiles(ws, [])).toEqual({ ok: true })
    expect(emitted.length).toBe(before)
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

  /**
   * P0-005 (test-design-qa.md, risk R-08 — DATA, score 6).
   *
   * Accept-then-reject is the ordinary review gesture — the user keeps one
   * change and throws away another in the same file — and it is the only one
   * that combines two operations over the same bytes. Each half is tested
   * above in isolation; the interaction was not. If rejecting recomputed the
   * reverse patch against the ORIGINAL baseline rather than the one that
   * `acceptHunk` advanced, it would take the accepted change down with it, and
   * the user would watch work they explicitly kept disappear.
   */
  it('rejecting a hunk after accepting a neighbour does not undo the accepted one', async () => {
    const base = Array.from({ length: 12 }, (_, i) => `l${i + 1}`)
    write('f.txt', base.join('\n') + '\n')
    await svc.beginTurn(ws, 't1')
    const edited = [...base]
    edited[0] = 'L1_KEEP'
    edited[11] = 'L12_DROP'
    write('f.txt', edited.join('\n') + '\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['f.txt'])

    const change = latest().changes.find((c) => c.path === 'f.txt')!
    const firstId = `0:${change.diff.hunks[0].oldStart}:${change.diff.hunks[0].newStart}`
    expect(await svc.acceptHunk(ws, 'f.txt', firstId)).toEqual({ ok: true })

    // Re-derive the surviving hunk's id from the POST-accept snapshot: the
    // indices shift, and rejecting a stale id is its own way to lose data.
    const afterAccept = latest().changes.find((c) => c.path === 'f.txt')!
    const survivor = afterAccept.diff.hunks[0]
    const survivorId = `0:${survivor.oldStart}:${survivor.newStart}`
    expect(await svc.rejectHunk(ws, 'f.txt', survivorId)).toEqual({ ok: true })

    const final = read('f.txt')
    expect(final).toContain('L1_KEEP') // the accepted change survived
    expect(final).not.toContain('L12_DROP') // the rejected one is gone
    expect(final).toContain('l12') // …restored to its pre-turn bytes
    // And nothing else in the file moved.
    expect(final.split('\n').filter((l) => l.length > 0)).toHaveLength(12)
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

  /**
   * P0-006 (test-design-qa.md, risk R-08 — DATA, score 6).
   *
   * Before the authorship guard, both of these destroyed the user's own work
   * while reporting success (measured 2026-07-30): `rejectAll` deleted a file
   * the user created with a turn open, and `rejectFile` silently reverted a
   * user edit to a file the agent never touched. Nothing was committed and the
   * trash is not involved — the checkpoint restore unlinks — so there was no
   * way back.
   *
   * The guard classifies by TURN WINDOW: the agent only writes while a turn is
   * in flight, so a change first observed with no turn open is the user's.
   * See `reviewService.ts` for why `TurnMark.paths` is not the signal.
   */
  it('rejectAll leaves a user-created file alone and reports what it skipped', async () => {
    await threeChanges()
    // The user creates their own file — no turn is open, the agent is idle.
    write('my-notes.md', 'written by the human\n')
    await svc.onFsActivity(ws)
    expect(latest().changes.find((c) => c.path === 'my-notes.md')!.userAuthored).toBe(true)

    const res = await svc.rejectAll(ws)

    expect(res).toEqual({ ok: true, skipped: 1 })
    expect(read('my-notes.md')).toBe('written by the human\n')
    // The agent's own changes are still fully reverted.
    expect(read('mod.txt')).toBe('ORIGINAL\n')
    expect(existsSync(join(ws, 'new.txt'))).toBe(false)
    // What was NOT reverted stays visible in the set rather than vanishing.
    expect(latest().changes.map((c) => c.path)).toEqual(['my-notes.md'])
  })

  it('rejectFile refuses a file the agent never touched instead of reverting it', async () => {
    write('mine.txt', 'my original\n')
    await svc.beginTurn(ws, 't1')
    write('agent.txt', 'agent output\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['agent.txt'])

    // User edits their own file with no turn in flight.
    write('mine.txt', 'my edit\n')
    await svc.onFsActivity(ws)

    expect(await svc.rejectFile(ws, 'mine.txt')).toEqual({ ok: false, unattributed: true })
    expect(read('mine.txt')).toBe('my edit\n')
    // The agent's file is unaffected by the refusal and still rejectable.
    expect(await svc.rejectFile(ws, 'agent.txt')).toEqual({ ok: true })
    expect(existsSync(join(ws, 'agent.txt'))).toBe(false)
  })

  it('rejectHunk is refused on a user-authored file too', async () => {
    write('mine.txt', 'l1\nl2\nl3\n')
    await svc.beginTurn(ws, 't1')
    write('agent.txt', 'agent\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['agent.txt'])

    write('mine.txt', 'l1\nMINE\nl3\n')
    await svc.onFsActivity(ws)
    const change = latest().changes.find((c) => c.path === 'mine.txt')!
    const h = change.diff.hunks[0]

    expect(await svc.rejectHunk(ws, 'mine.txt', `0:${h.oldStart}:${h.newStart}`)).toEqual({
      ok: false,
      unattributed: true
    })
    expect(read('mine.txt')).toBe('l1\nMINE\nl3\n')
  })

  it('a file the agent wrote stays the agent\u2019s even after the user edits it (STALE still governs)', async () => {
    // First observation wins. Otherwise a user touching an agent file would
    // make it permanently un-rejectable, and the STALE guard — which exists to
    // handle exactly that overlap — would never get a chance to run.
    write('f.txt', 'ORIGINAL\n')
    await svc.beginTurn(ws, 't1')
    write('f.txt', 'agent wrote\n')
    await svc.onFsActivity(ws)
    await svc.endTurn(ws, 't1', ['f.txt'])
    expect(latest().changes[0].userAuthored).toBeUndefined()

    write('f.txt', 'user hand-edit\n')
    utimesSync(join(ws, 'f.txt'), new Date(), new Date(Date.now() + 60_000))

    // Not "unattributed" — STALE, which is the right conversation to have.
    expect(await svc.rejectFile(ws, 'f.txt')).toEqual({ ok: false, stale: true })
    expect(read('f.txt')).toBe('user hand-edit\n')
  })

  it('accepting a user-authored change is allowed — keeping bytes destroys nothing', async () => {
    await threeChanges()
    write('my-notes.md', 'written by the human\n')
    await svc.onFsActivity(ws)

    expect(await svc.acceptFile(ws, 'my-notes.md')).toEqual({ ok: true })
    expect(read('my-notes.md')).toBe('written by the human\n')
    expect(
      latest()
        .changes.map((c) => c.path)
        .sort()
    ).toEqual(['mod.txt', 'new.txt'])
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
