import { vi } from 'vitest'
import {
  createWhisperEngineCore,
  type AsrPipeline,
  type TransformersModule
} from '../secondBrain/whisper/whisperEngineCore'
import { resetWhisperClient } from '../secondBrain/whisper/whisperClient'
import type {
  WhisperWorkerRequest,
  WhisperWorkerResponse
} from '../secondBrain/whisper/whisperWorkerProtocol'

/**
 * A `Worker` for a jsdom test, so a surface that transcribes can be driven end
 * to end without a thread.
 *
 * It exists because of where the engine moved. Transcription used to run on the
 * renderer's main thread, so a test could stub `@huggingface/transformers` and
 * everything above it was reachable. Now the pipeline lives in a module worker
 * — which jsdom does not implement — and that stub is never consulted: the
 * client's very first `new Worker(...)` throws, the transcription rejects, and
 * a panel test fails claiming the transcript never arrived. It is a true
 * statement about a cause that has nothing to do with the panel.
 *
 * So the seam moves down one level with the code. What is faked here is the
 * *thread*: `whisperEngineCore` — the real protocol, the real phases, the real
 * error classification — runs inline against a stubbed library, and messages
 * cross by `queueMicrotask` instead of by structured clone.
 */

export interface WhisperWorkerMockOptions {
  /** What every transcription returns. A function sees the audio it was given. */
  transcript?: string | ((pcm: Float32Array) => string)
  /** Streamed before the result, as Whisper streams its tokens. */
  partials?: string[]
  /** Fails instead of transcribing — `std::bad_alloc` and friends, verbatim. */
  fail?: string
}

/** The fake, plus the way to see what crossed the wire. */
export interface WhisperWorkerMock {
  /** Every request the client posted, in order. */
  sent: WhisperWorkerRequest[]
  /** How many workers were spawned — a recycle after an OOM shows up here. */
  spawns: () => number
  /** Restores the previous `Worker` and drops the shared client. */
  restore: () => void
}

/**
 * Installs the fake for the duration of a test.
 *
 * `resetWhisperClient()` is called on both ends and neither is optional: the
 * engine is a module singleton on purpose (one pipeline for the whole app), so
 * a client built in an earlier test would hold a worker built from an earlier
 * fake, and the transcript a test is waiting for would be answered by the
 * previous one.
 */
export function installWhisperWorkerMock(
  options: WhisperWorkerMockOptions = {}
): WhisperWorkerMock {
  const sent: WhisperWorkerRequest[] = []
  let spawns = 0

  const asr = (async (pcm: Float32Array) => {
    if (options.fail !== undefined) throw new Error(options.fail)
    const text =
      typeof options.transcript === 'function'
        ? options.transcript(pcm)
        : (options.transcript ?? 'texto transcrito')
    for (const piece of options.partials ?? []) streamer.emit(piece)
    return { text }
  }) as unknown as AsrPipeline
  Object.assign(asr, { tokenizer: { name: 'fake' }, dispose: vi.fn(async () => {}) })

  /** Holds whichever streamer the core built for the request in flight. */
  const streamer = {
    callback: undefined as ((text: string) => void) | undefined,
    emit(text: string) {
      this.callback?.(text)
    }
  }

  const library: TransformersModule = {
    pipeline: async () => asr,
    env: {
      allowRemoteModels: true,
      allowLocalModels: false,
      useBrowserCache: true,
      localModelPath: '',
      fetch: async () => new Response(null),
      backends: { onnx: { wasm: { wasmPaths: '' } } }
    },
    WhisperTextStreamer: class {
      constructor(_tokenizer: unknown, opts: { callback_function?: (text: string) => void }) {
        streamer.callback = opts.callback_function
      }
    } as TransformersModule['WhisperTextStreamer']
  }

  class FakeWorker {
    onmessage: ((event: MessageEvent<WhisperWorkerResponse>) => void) | null = null
    onerror: ((event: ErrorEvent) => void) | null = null
    private core = createWhisperEngineCore({
      loadLibrary: async () => library,
      post: (message) => queueMicrotask(() => this.onmessage?.({ data: message } as never))
    })
    private chain: Promise<void> = Promise.resolve()

    constructor() {
      spawns += 1
      queueMicrotask(() => this.onmessage?.({ data: { type: 'ready', id: 0 } } as never))
    }

    postMessage(request: WhisperWorkerRequest): void {
      sent.push(request)
      // Serialized exactly as the real worker serializes: ORT is not reentrant,
      // and a test that let two requests interleave would be testing something
      // the app cannot do.
      this.chain = this.chain.then(() => this.core.handle(request))
    }

    /**
     * Nothing to tear down — but the methods have to exist: the client calls
     * `terminate()` when it recycles after an out-of-memory failure, and the
     * `Worker` contract carries the listener pair whether or not this fake uses
     * them (it delivers through `onmessage`).
     */
    terminate(): void {
      return undefined
    }
    addEventListener(): void {
      return undefined
    }
    removeEventListener(): void {
      return undefined
    }
  }

  const previous = (globalThis as { Worker?: unknown }).Worker
  ;(globalThis as { Worker?: unknown }).Worker = FakeWorker
  resetWhisperClient()

  return {
    sent,
    spawns: () => spawns,
    restore: () => {
      resetWhisperClient()
      ;(globalThis as { Worker?: unknown }).Worker = previous
    }
  }
}
