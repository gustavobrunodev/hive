import { existsSync } from 'fs'
import { createAsrEngineCore, type SherpaModule } from './asrEngineCore'
import type { AsrModelPaths, AsrWorkerRequest, AsrWorkerResponse } from './asrWorkerProtocol'

/**
 * The ASR utility process — wiring only. Every rule lives in `asrEngineCore`.
 *
 * **Why a separate process at all.** `sherpa-onnx-node`'s API is synchronous:
 * `recognizer.decode(stream)` blocks its thread until the transducer is done.
 * Called in main that would freeze the window — menus, IPC, the agent's own
 * output — for the length of every phrase. Called in the renderer it would
 * freeze the UI, which is the failure the Whisper worker existed to avoid in
 * the first place. A utility process is the only place where a blocking native
 * call is simply a blocking call.
 *
 * **Why not a renderer worker, as before.** Because that is where the old
 * engine's three defects came from and none of them were Whisper's fault: a
 * `file://` origin is not cross-origin isolated, so `SharedArrayBuffer` is
 * unavailable, so ORT's WASM backend is pinned to one thread; the quantized
 * decoder cannot create a session on that backend, so the weights had to be
 * fp32; and the WASM heap grows and never returns, so a long session ended in
 * `std::bad_alloc`. Native ONNX Runtime in a Node process has none of those
 * properties — threads, int8 and a heap that frees.
 */

/** Set by main before the first request; the specifier is resolved there. */
let addonSpecifier = 'sherpa-onnx-node'

function loadAddon(): SherpaModule {
  // `require` rather than `import`, and the rule is disabled rather than worked
  // around: the specifier is only known at runtime (see `asrAddon.ts`), the
  // package is CommonJS wrapping a `.node` binary, and a static import would
  // invite the bundler to inline something that must stay external.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require(addonSpecifier) as SherpaModule | undefined
  if (!loaded || typeof loaded.OfflineRecognizer !== 'function') {
    // The package resolves to `undefined` rather than throwing when it cannot
    // find its binary, so saying so here is the difference between a
    // diagnosable error and `Cannot read properties of undefined`.
    throw new Error(`sherpa-onnx-node loaded no native binary from ${addonSpecifier}`)
  }
  return loaded
}

const post = (message: AsrWorkerResponse): void => process.parentPort.postMessage(message)

const filesExist = (paths: AsrModelPaths): boolean =>
  [paths.encoder, paths.decoder, paths.joiner, paths.tokens].every((file) => existsSync(file))

const core = createAsrEngineCore({ loadAddon, post, filesExist })

/**
 * The idle sweep. Unrefed so a pending eviction can never be the reason this
 * process — or the app — stays alive.
 */
const sweep = setInterval(() => core.sweep(), 30_000)
sweep.unref()

process.parentPort.on('message', (event) => {
  const message = event.data as AsrWorkerRequest | { type: 'configure'; specifier: string }
  if (message.type === 'configure') {
    addonSpecifier = message.specifier
    return
  }
  core.handle(message)
})
