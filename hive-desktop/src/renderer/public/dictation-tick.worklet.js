/**
 * The dictation capture worklet: mono PCM in, fixed-cadence ticks out.
 *
 * Shipped as a **plain, unbundled `.js` asset copied same-origin** into the
 * renderer output (see `copyDictationWorklet` in `electron.vite.config.ts`),
 * because `audioWorklet.addModule()` is a script load governed by
 * `script-src 'self'` — the same reason ORT's WASM glue is copied rather than
 * served over `hive-model:` (STATE.md, M12 T2). The T1 spike proved this exact
 * path loads under this app's CSP from a `file://` origin, and measured the
 * cadence below at 32.0 ms.
 *
 * It runs on the audio render thread, so it does the least possible: coalesce
 * `FRAMES_PER_TICK` render quanta, compute one RMS, post it across. Every
 * decision about what the levels *mean* belongs to `segmenter.ts`, which is
 * pure and testable; nothing here is.
 */

/**
 * 4 render quanta of 128 samples = 512 samples = 32 ms at 16 kHz. Small enough
 * that the level meter and the silence timer feel immediate, large enough that
 * the message port is not the bottleneck.
 */
const FRAMES_PER_TICK = 4

class DictationTickProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.pending = []
    this.pendingLength = 0
  }

  process(inputs) {
    // Channel 0 only: the track is requested mono, but the
    // `MediaStreamAudioSourceNode` still reports 2 channels (T1 spike), so the
    // channel count is never asserted on — the first channel is simply read.
    const channel = inputs[0] && inputs[0][0]
    if (!channel) return true

    this.pending.push(new Float32Array(channel))
    this.pendingLength += channel.length
    if (this.pending.length < FRAMES_PER_TICK) return true

    const samples = new Float32Array(this.pendingLength)
    let offset = 0
    for (const chunk of this.pending) {
      samples.set(chunk, offset)
      offset += chunk.length
    }
    this.pending = []
    this.pendingLength = 0

    let sumSquares = 0
    for (let i = 0; i < samples.length; i += 1) sumSquares += samples[i] * samples[i]

    // Transferred, not copied: the buffer is handed over so a 32 ms cadence
    // does not allocate-and-collect its way through a long take.
    this.port.postMessage({ rms: Math.sqrt(sumSquares / samples.length), samples }, [
      samples.buffer
    ])
    return true
  }
}

registerProcessor('dictation-tick', DictationTickProcessor)
