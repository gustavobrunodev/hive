import { describe, expect, it, vi } from 'vitest'
import { createLivePass, DEFAULT_LIVE_PASS_CONFIG, type LivePass } from './livePass'
import type { Draft } from './segmenter'

/**
 * The pacing, asserted with no engine and no clock.
 *
 * Everything here is about *not* running: there is one pipeline slot, and a
 * live pass that takes it at the wrong moment makes dictation slower than the
 * version that had no live pass at all. So the interesting assertions are the
 * negative ones.
 */

function draft(ms: number, index = 0): Draft {
  return { pcm: new Float32Array(Math.round((ms / 1000) * 16_000)), ms, index }
}

function make(overrides: Partial<Parameters<typeof createLivePass>[0]> = {}): {
  pass: LivePass
  calls: Float32Array[]
  settle: (text: string) => void
  reject: (error: Error) => void
  text: string[]
  partial: (text: string) => void
} {
  const calls: Float32Array[] = []
  const text: string[] = []
  let resolve: (value: string) => void = () => {}
  let fail: (error: Error) => void = () => {}
  let partial: (value: string) => void = () => {}

  const pass = createLivePass({
    transcribe: (pcm, onPartial) => {
      calls.push(pcm)
      partial = onPartial
      return new Promise<string>((res, rej) => {
        resolve = res
        fail = rej
      })
    },
    onText: (value) => text.push(value),
    ...overrides
  })

  return {
    pass,
    calls,
    text,
    settle: (value) => resolve(value),
    reject: (error) => fail(error),
    partial: (value) => partial(value)
  }
}

const { minSpeechMs, growthMs } = DEFAULT_LIVE_PASS_CONFIG

/**
 * Lets the promise chain settle.
 *
 * A single `await Promise.resolve()` is not enough: a pass resolves through
 * `then` → `catch` → `finally`, and it is the last of those that frees the
 * slot. A macrotask hop clears all of them at once, whatever the chain grows
 * into.
 */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('createLivePass', () => {
  it('waits for enough speech before guessing at it', () => {
    const { pass, calls } = make()
    pass.offer(draft(minSpeechMs - 1))
    expect(calls).toHaveLength(0)

    pass.offer(draft(minSpeechMs))
    expect(calls).toHaveLength(1)
  })

  it('runs one pass at a time — the engine has one slot', () => {
    const { pass, calls } = make()
    pass.offer(draft(minSpeechMs))
    pass.offer(draft(minSpeechMs + growthMs))
    pass.offer(draft(minSpeechMs + growthMs * 2))
    expect(calls).toHaveLength(1)
    expect(pass.busy()).toBe(true)
  })

  it('re-runs only once there is meaningfully more to hear', async () => {
    const { pass, calls, settle } = make()
    pass.offer(draft(minSpeechMs))
    settle('primeiro')
    await flush()

    // 200 ms more audio buys almost the same sentence and costs a whole
    // pipeline slot — Whisper pads every window to 30 s regardless.
    pass.offer(draft(minSpeechMs + 200))
    expect(calls).toHaveLength(1)

    pass.offer(draft(minSpeechMs + growthMs))
    expect(calls).toHaveLength(2)
  })

  it('forwards the tokens as they decode, then the result', async () => {
    const { pass, text, settle, partial } = make()
    pass.offer(draft(minSpeechMs))
    partial('bom')
    partial('bom dia')
    settle('bom dia a todos')
    await flush()
    expect(text).toEqual(['bom', 'bom dia', 'bom dia a todos'])
  })

  it('starts a new phrase over, rather than waiting out the previous one growth', async () => {
    const { pass, calls, settle } = make()
    pass.offer(draft(3000, 0))
    settle('primeira frase')
    await flush()

    // A new phrase is shorter than the one before it, so the growth rule read
    // against the old length would refuse to run for the whole of it.
    pass.offer(draft(minSpeechMs, 1))
    expect(calls).toHaveLength(2)
  })

  it('clears the text when the phrase ends — the queue owns those words now', () => {
    const { pass, text } = make()
    pass.offer(null)
    expect(text).toEqual([''])
  })

  it('does not clear mid-pass: the guess on screen outlives the phrase that made it', () => {
    const { pass, text } = make()
    pass.offer(draft(minSpeechMs))
    pass.offer(null)
    expect(text).toEqual([])
  })

  /**
   * A live pass failing means the engine is in trouble — an exhausted WASM heap
   * is the failure that actually happens — and a preview is the last thing that
   * should be spending what is left of it. The take still has real segments to
   * transcribe.
   */
  it('gives up for the rest of the take after its failure budget', async () => {
    const { pass, calls, reject } = make()
    for (let i = 0; i < DEFAULT_LIVE_PASS_CONFIG.failureBudget; i += 1) {
      pass.offer(draft(minSpeechMs + growthMs * i, i))
      reject(new Error('std::bad_alloc'))
      await flush()
    }
    const spent = calls.length

    pass.offer(draft(minSpeechMs, 99))
    expect(calls).toHaveLength(spent)
  })

  it('says nothing about a failure — the segment covering the same words reports its own', async () => {
    const { pass, text, reject } = make()
    pass.offer(draft(minSpeechMs))
    reject(new Error('falhou'))
    await flush()
    expect(text).toEqual([])
  })

  it('forgets a pass in flight on reset, so a discarded take cannot write into the next one', async () => {
    const { pass, text, settle } = make()
    pass.offer(draft(minSpeechMs))
    pass.reset()
    settle('de uma tomada que já acabou')
    await flush()
    expect(text).toEqual([])
    expect(pass.busy()).toBe(false)
  })

  it('re-arms the failure budget on reset — a new take deserves the engine again', async () => {
    const { pass, calls, reject } = make()
    for (let i = 0; i < DEFAULT_LIVE_PASS_CONFIG.failureBudget; i += 1) {
      pass.offer(draft(minSpeechMs + growthMs * i, i))
      reject(new Error('bad_alloc'))
      await flush()
    }
    pass.reset()
    pass.offer(draft(minSpeechMs))
    expect(calls.length).toBeGreaterThan(DEFAULT_LIVE_PASS_CONFIG.failureBudget - 1)
  })

  it('honours an injected config', () => {
    const transcribe = vi.fn().mockReturnValue(new Promise<string>(() => {}))
    const pass = createLivePass({
      transcribe,
      onText: () => {},
      config: { minSpeechMs: 100, growthMs: 100, failureBudget: 1 }
    })
    pass.offer(draft(120))
    expect(transcribe).toHaveBeenCalledTimes(1)
  })
})
