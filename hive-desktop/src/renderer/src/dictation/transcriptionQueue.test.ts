import { describe, expect, it, vi } from 'vitest'
import { createTranscriptionQueue, type QueueState } from './transcriptionQueue'

/**
 * A fake transcriber whose resolutions are controlled by the test, which is the
 * only way to assert ordering, cold-start buffering and failure containment
 * deterministically.
 */
function controlledTranscriber(): {
  transcribe: (pcm: Float32Array) => Promise<string>
  /** Resolves the Nth call (0-based). */
  resolve(call: number, text: string): Promise<void>
  reject(call: number, message: string): Promise<void>
  calls: Float32Array[]
} {
  const settlers: { resolve(text: string): void; reject(error: Error): void }[] = []
  const calls: Float32Array[] = []
  return {
    calls,
    transcribe: (pcm) => {
      calls.push(pcm)
      return new Promise<string>((resolve, reject) => {
        settlers.push({ resolve, reject })
      })
    },
    resolve: async (call, text) => {
      settlers[call].resolve(text)
      // Two microtask flushes: one for `then`, one for `finally`+`pump`.
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    },
    reject: async (call, message) => {
      settlers[call].reject(new Error(message))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    }
  }
}

function harness(): {
  queue: ReturnType<typeof createTranscriptionQueue>
  inserted: string[]
  states: QueueState[]
  engine: ReturnType<typeof controlledTranscriber>
} {
  const engine = controlledTranscriber()
  const inserted: string[] = []
  const states: QueueState[] = []
  const queue = createTranscriptionQueue({
    transcribe: engine.transcribe,
    insert: (text) => inserted.push(text),
    onChange: (state) => states.push(state)
  })
  return { queue, inserted, states, engine }
}

const pcm = (fill: number): Float32Array => new Float32Array(4).fill(fill)

describe('createTranscriptionQueue', () => {
  it('runs exactly one transcription at a time', async () => {
    const { queue, engine } = harness()
    queue.enqueue(0, pcm(1))
    queue.enqueue(1, pcm(2))
    queue.enqueue(2, pcm(3))

    // The pipeline is not reentrant: three segments, one call.
    expect(engine.calls).toHaveLength(1)
    await engine.resolve(0, 'um')
    expect(engine.calls).toHaveLength(2)
    await engine.resolve(1, 'dois')
    expect(engine.calls).toHaveLength(3)
  })

  it('inserts finished segments in spoken order', async () => {
    const { queue, engine, inserted } = harness()
    queue.enqueue(0, pcm(1))
    queue.enqueue(1, pcm(2))

    await engine.resolve(0, 'primeira')
    expect(inserted).toEqual(['primeira'])
    await engine.resolve(1, 'segunda')
    expect(inserted).toEqual(['primeira', 'segunda'])
  })

  // VP-R2.4. The case that makes the write gate more than belt-and-braces.
  it('makes a segment that finishes early wait for its predecessor', async () => {
    const engine = controlledTranscriber()
    const inserted: string[] = []
    // A queue fed out of order, as a retry does: index 1 resolves before 0 is
    // even enqueued.
    const queue = createTranscriptionQueue({
      transcribe: engine.transcribe,
      insert: (text) => inserted.push(text),
      onChange: () => undefined
    })

    queue.enqueue(1, pcm(2))
    await engine.resolve(0, 'segunda')
    // Nothing written: index 0 has not been seen yet, so 1 waits.
    expect(inserted).toEqual([])

    queue.enqueue(0, pcm(1))
    await engine.resolve(1, 'primeira')
    // Both released, in spoken order — not in resolution order.
    expect(inserted).toEqual(['primeira', 'segunda'])
  })

  // D-VP-5 / VP-R3.1–3.3: the queue with no consumer yet IS the cold-start
  // buffer. The T1 spike measured 51 s for the first session build.
  it('buffers everything spoken while the engine is cold, then drains in order', async () => {
    const { queue, engine, inserted } = harness()

    // The user keeps talking for three segments while the first transcribe call
    // is still inside a model download plus a session build.
    queue.enqueue(0, pcm(1))
    queue.enqueue(1, pcm(2))
    queue.enqueue(2, pcm(3))
    expect(queue.state().pending).toBe(3)
    expect(inserted).toEqual([])

    // The engine warms up and the queue drains — nothing spoken was lost.
    await engine.resolve(0, 'um')
    await engine.resolve(1, 'dois')
    await engine.resolve(2, 'três')
    expect(inserted).toEqual(['um', 'dois', 'três'])
    expect(queue.state().pending).toBe(0)
    expect(queue.busy()).toBe(false)
  })

  it('counts pending segments, never guessing at their contents (D-VP-8)', async () => {
    const { queue, engine } = harness()
    queue.enqueue(0, pcm(1))
    expect(queue.state().pending).toBe(1)
    queue.enqueue(1, pcm(2))
    expect(queue.state().pending).toBe(2)

    await engine.resolve(0, 'um')
    expect(queue.state().pending).toBe(1)
    await engine.resolve(1, 'dois')
    expect(queue.state().pending).toBe(0)
  })

  it('announces every state change so the transport can follow it', async () => {
    const { queue, engine, states } = harness()
    queue.enqueue(0, pcm(1))
    await engine.resolve(0, 'um')
    expect(states.length).toBeGreaterThan(1)
    expect(states[states.length - 1]).toEqual({ pending: 0, failure: null })
  })

  it('keeps the queue running past a failure, and surfaces it (VP-R4.4)', async () => {
    const { queue, engine, inserted } = harness()
    queue.enqueue(0, pcm(1))
    queue.enqueue(1, pcm(2))

    await engine.reject(0, 'session build failed')
    expect(queue.state().failure).toBe('session build failed')
    // The next segment was still picked up — one bad segment does not end the take.
    expect(engine.calls).toHaveLength(2)

    await engine.resolve(1, 'segunda')
    // The failed predecessor released the gate rather than withholding text that
    // already exists.
    expect(inserted).toEqual(['segunda'])
  })

  it('retries a failed segment with the SAME audio it captured (VP-R4.4)', async () => {
    const { queue, engine, inserted } = harness()
    const audio = pcm(7)
    queue.enqueue(0, audio)

    await engine.reject(0, 'boom')
    expect(queue.state().failure).toBe('boom')

    queue.retry()
    // Byte-for-byte the buffered take, not a re-record.
    expect(engine.calls[1]).toBe(audio)
    expect(queue.state().failure).toBeNull()

    await engine.resolve(1, 'recuperada')
    expect(inserted).toEqual(['recuperada'])
  })

  it('retries every failed segment at once, and is a no-op with none', async () => {
    const { queue, engine, states } = harness()
    queue.enqueue(0, pcm(1))
    queue.enqueue(1, pcm(2))
    await engine.reject(0, 'um falhou')
    await engine.reject(1, 'dois falhou')

    const before = states.length
    queue.retry()
    expect(engine.calls).toHaveLength(3)

    // Nothing failed now, so a second retry changes nothing at all.
    await engine.resolve(2, 'a')
    await engine.resolve(3, 'b')
    const settled = states.length
    queue.retry()
    expect(states.length).toBe(settled)
    expect(settled).toBeGreaterThan(before)
  })

  it('inserts an empty transcript as nothing rather than dropping the slot', async () => {
    const { queue, engine, inserted } = harness()
    queue.enqueue(0, pcm(1))
    queue.enqueue(1, pcm(2))
    // A segment that transcribed to nothing (a cough, a door) must not block
    // the segment behind it.
    await engine.resolve(0, '')
    await engine.resolve(1, 'depois')
    expect(inserted).toEqual(['', 'depois'])
  })

  it('clear() drops everything, including a result still in flight (VP-R1.5)', async () => {
    const { queue, engine, inserted } = harness()
    queue.enqueue(0, pcm(1))
    queue.enqueue(1, pcm(2))

    queue.clear()
    expect(queue.state()).toEqual({ pending: 0, failure: null })
    expect(queue.busy()).toBe(false)

    // The in-flight transcription resolves *after* the discard. It must not
    // write into a composer the user already rewound.
    await engine.resolve(0, 'fantasma')
    expect(inserted).toEqual([])

    // And the queue is reusable for the next take, numbering from zero again.
    queue.enqueue(0, pcm(3))
    await engine.resolve(1, 'novo take')
    expect(inserted).toEqual(['novo take'])
  })

  it('clear() also discards a failure, so a new take starts clean', async () => {
    const { queue, engine } = harness()
    queue.enqueue(0, pcm(1))
    await engine.reject(0, 'boom')
    expect(queue.state().failure).toBe('boom')

    queue.clear()
    expect(queue.state().failure).toBeNull()
  })

  it('reports busy while work remains, so the caller knows when the drain is done', async () => {
    const { queue, engine } = harness()
    expect(queue.busy()).toBe(false)
    queue.enqueue(0, pcm(1))
    expect(queue.busy()).toBe(true)
    await engine.resolve(0, 'pronto')
    expect(queue.busy()).toBe(false)
  })

  it('reports a non-Error rejection without crashing on it', async () => {
    const transcribe = vi.fn().mockRejectedValue('just a string')
    const queue = createTranscriptionQueue({
      transcribe,
      insert: () => undefined,
      onChange: () => undefined
    })
    queue.enqueue(0, pcm(1))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(queue.state().failure).toBe('just a string')
  })
})
