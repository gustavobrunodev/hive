/// <reference lib="webworker" />
import { createWhisperEngineCore, type TransformersModule } from './whisperEngineCore'
import type { WhisperWorkerRequest, WhisperWorkerResponse } from './whisperWorkerProtocol'

/**
 * The transcription worker — wiring only.
 *
 * Everything it does lives in `whisperEngineCore.ts`, which is testable without
 * a `Worker`; what is here is the part that cannot be: `self`, and the dynamic
 * import that pulls in the real library. Keeping the shell this thin is
 * deliberate — the platform half of a feature is where untested code hides, so
 * there is as little of it as the platform allows.
 *
 * Why a worker exists at all, with the numbers, is in
 * `whisperWorkerProtocol.ts`. The short version: on the main thread a
 * transcription froze the renderer completely, so words that already existed
 * could not be drawn until the user stopped talking.
 */

const scope = self as unknown as DedicatedWorkerGlobalScope

const core = createWhisperEngineCore({
  loadLibrary: () =>
    import('@huggingface/transformers') as unknown as Promise<TransformersModule>,
  post: (message: WhisperWorkerResponse) => scope.postMessage(message)
})

/**
 * Requests run in the order they arrive, one at a time.
 *
 * ORT is not reentrant, and the chain is also what keeps a pre-warm from racing
 * the first real phrase into two concurrent session builds — the defect that
 * made a warmed engine *slower* than a cold one, both builds fighting for the
 * same core.
 */
let chain: Promise<void> = Promise.resolve()

scope.onmessage = (event: MessageEvent<WhisperWorkerRequest>): void => {
  chain = chain.then(() => core.handle(event.data))
}

scope.postMessage({ type: 'ready', id: 0 } satisfies WhisperWorkerResponse)
