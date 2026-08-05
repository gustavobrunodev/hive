/**
 * The serial, in-order transcription queue (VP-R2.3–2.5, VP-R3.1–3.5, VP-R4.4).
 *
 * A plain factory rather than a hook, so the properties that matter — order,
 * cold-start buffering, failure containment — are asserted against a fake
 * transcriber with no React, no engine and no audio anywhere near them.
 *
 * **One transcription in flight at a time.** The pipeline is not reentrant and
 * concurrent WASM sessions thrash. This is also why D-VP-5's buffering is not a
 * special case: while the engine is cold the single worker is simply blocked
 * inside its first `transcribe()` — which the T1 spike measured at 51 s for a
 * session build — and everything spoken meanwhile piles up behind it in spoken
 * order. The queue *is* the buffer.
 */

type ItemStatus = 'queued' | 'running' | 'done' | 'failed'

interface Item {
  index: number
  /** Retained even after a failure, so `retry()` reuses the same audio. */
  pcm: Float32Array
  status: ItemStatus
  text?: string
  /**
   * A retried segment. Its place in the ordered gate is already gone (see
   * `flushWrites`), so when it finally succeeds it is written at the caret
   * rather than waiting for a slot that will never come round again.
   */
  late?: boolean
}

export interface QueueState {
  /** Segments queued or in flight — what the transport counts (D-VP-8). */
  pending: number
  /** The last unresolved failure, or `null`. Never silently dropped. */
  failure: string | null
}

export interface TranscriptionQueueDeps {
  transcribe: (pcm: Float32Array) => Promise<string>
  /** Writes one finished segment's text into the field, in spoken order. */
  insert: (text: string) => void
  /** Announces a state change, so the caller can re-render. */
  onChange: (state: QueueState) => void
}

export interface TranscriptionQueue {
  /** Adds a segment. `index` is its position in spoken order. */
  enqueue: (index: number, pcm: Float32Array) => void
  /** Re-runs every failed segment, reusing its retained audio (VP-R4.4). */
  retry: () => void
  /** Drops everything, including results still in flight (VP-R1.5). */
  clear: () => void
  state: () => QueueState
  /** True while anything is queued or running — the drain condition. */
  busy: () => boolean
}

export function createTranscriptionQueue(deps: TranscriptionQueueDeps): TranscriptionQueue {
  let items: Item[] = []
  /** The next index allowed to be written. This is what enforces order. */
  let writeIndex = 0
  let running = false
  let failure: string | null = null
  /** Bumped by `clear()`; every continuation checks it before doing anything. */
  let generation = 0

  const state = (): QueueState => ({
    pending: items.filter((item) => item.status === 'queued' || item.status === 'running').length,
    failure
  })

  const announce = (): void => deps.onChange(state())

  /**
   * Releases finished results in spoken order (VP-R2.4).
   *
   * A segment that resolved early waits for every lower index. The case that
   * makes this more than belt-and-braces is a **retry**: segment 2 fails while
   * 3 succeeds, and writing 3 immediately would put the retried 2 after it.
   *
   * A *failed* predecessor does release the gate, deliberately. Holding every
   * later segment hostage to a failure would leave the user staring at text
   * that exists and is being withheld; the failure is visible and retryable
   * instead, and the retried text lands at the caret. Withheld text is the
   * worse of the two, and it is the one this chooses against.
   *
   * That choice has a consequence the first cut of this file got wrong, and a
   * test caught: once the gate has passed a failed segment, its slot is gone,
   * so a successful retry has no slot to wait for and would be written
   * *nowhere*. Retried segments are therefore released immediately, at the
   * caret — which is exactly what "the retried text lands at the caret" above
   * has to mean in code.
   */
  const flushWrites = (): void => {
    for (const late of items.filter((item) => item.late === true && item.status === 'done')) {
      deps.insert(late.text ?? '')
      items = items.filter((item) => item !== late)
    }

    for (;;) {
      const next = items.find((item) => item.index === writeIndex)
      if (next === undefined || next.status === 'queued' || next.status === 'running') return
      if (next.status === 'done') {
        deps.insert(next.text ?? '')
        items = items.filter((item) => item !== next)
      }
      // A failed item stays in `items` — that is what `retry()` reuses — but it
      // no longer blocks the segments behind it.
      writeIndex += 1
    }
  }

  const pump = (): void => {
    if (running) return
    const next = items.find((item) => item.status === 'queued')
    if (next === undefined) return

    running = true
    next.status = 'running'
    const take = generation
    announce()

    deps
      .transcribe(next.pcm)
      .then((text) => {
        if (generation !== take) return
        next.status = 'done'
        next.text = text
        flushWrites()
      })
      .catch((error: unknown) => {
        if (generation !== take) return
        next.status = 'failed'
        failure = error instanceof Error ? error.message : String(error)
        // The rest of the queue keeps running — one bad segment does not end
        // the take (VP-R4.4).
        flushWrites()
      })
      .finally(() => {
        if (generation !== take) return
        running = false
        announce()
        pump()
      })
  }

  return {
    enqueue: (index, pcm) => {
      items.push({ index, pcm, status: 'queued' })
      announce()
      pump()
    },
    retry: () => {
      let retried = false
      for (const item of items) {
        if (item.status === 'failed') {
          item.status = 'queued'
          item.late = true
          retried = true
        }
      }
      if (!retried) return
      failure = null
      announce()
      pump()
    },
    clear: () => {
      generation += 1
      items = []
      writeIndex = 0
      running = false
      failure = null
      announce()
    },
    state,
    busy: () =>
      items.some((item) => item.status === 'queued' || item.status === 'running') || running
  }
}
