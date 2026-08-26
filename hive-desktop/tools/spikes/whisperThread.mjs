/**
 * Spike — where does the transcription wait actually come from?
 *
 * Runs against the **real built app** (`out/main/index.js`) with its real CSP,
 * its real `hive-model:` store and its own built Transformers.js chunk, the way
 * the T1/T2 spikes did. Three questions, all of them decisions the streaming
 * work depends on and none of them answerable from the source:
 *
 *   Q1 — how much of the wait is the ONNX session build, and does a **second**
 *        surface (a second `useWhisper` instance) pay it again?
 *   Q2 — does the inference block the **main thread**? If it does, text that
 *        already exists cannot paint while the queue is busy, which is exactly
 *        "it only shows up when I stop talking".
 *   Q3 — does `env.backends.onnx.wasm.proxy = true` work under this app's CSP
 *        (blob worker + file:// wasmPaths), and does it unblock the main thread?
 *   Q4 — does `WhisperTextStreamer` emit partial text during one transcription?
 *
 * Usage: npm run build && xvfb-run -a node tools/spikes/whisperThread.mjs
 * (a real display is better — under xvfb the audio graph is starved, but this
 * spike feeds PCM directly and never opens a microphone, so xvfb is fine.)
 */
import { _electron as electron } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MODEL = process.env.SPIKE_MODEL ?? 'tiny'
const CHUNK = `assets/${fs
  .readdirSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../out/renderer/assets'))
  .find((name) => name.startsWith('transformers.web-'))}`
const JFK = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav'

/** 16 kHz mono float PCM from a RIFF/WAVE buffer (the fixture is exactly that). */
function decodeWav(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let offset = 12
  let fmt = null
  while (offset < view.byteLength - 8) {
    const id = String.fromCharCode(...new Uint8Array(buffer.buffer, buffer.byteOffset + offset, 4))
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === 'fmt ') {
      fmt = {
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true)
      }
    } else if (id === 'data') {
      const samples = size / (fmt.bits / 8) / fmt.channels
      const out = new Float32Array(samples)
      for (let i = 0; i < samples; i += 1) {
        out[i] = view.getInt16(body + i * fmt.channels * 2, true) / 32768
      }
      return { pcm: out, rate: fmt.rate }
    }
    offset = body + size + (size % 2)
  }
  throw new Error('no data chunk')
}

async function speech() {
  const response = await fetch(JFK)
  if (!response.ok) throw new Error(`fixture ${response.status}`)
  return decodeWav(Buffer.from(await response.arrayBuffer()))
}

async function main() {
  const { pcm, rate } = await speech()
  console.log(`fixture: ${(pcm.length / rate).toFixed(1)} s @ ${rate} Hz`)

  const tmpRoot = process.env.SPIKE_USERDATA ?? fs.mkdtempSync(path.join(os.tmpdir(), 'hive-spike-'))
  const userDataDir = path.join(tmpRoot, 'userData')
  const workspace = path.join(tmpRoot, 'ws')
  fs.mkdirSync(path.join(workspace, '_bmad', '_config'), { recursive: true })
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(path.join(workspace, '_bmad', '_config', 'manifest.yaml'), 'version: test\n')
  fs.writeFileSync(
    path.join(userDataDir, 'config.json'),
    JSON.stringify({
      workspacePath: workspace,
      provisioned: true,
      recentWorkspaces: [],
      agent: 'claude',
      agents: ['claude'],
      role: 'dev',
      userName: 'Spike'
    })
  )
  console.log(`userData: ${userDataDir}`)

  const env = { ...process.env, HIVE_USER_DATA: userDataDir }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({
    args: [path.join(root, 'out/main/index.js'), `--user-data-dir=${userDataDir}`],
    env,
    cwd: root
  })
  const page = await app.firstWindow()
  page.on('console', (message) => {
    if (message.type() === 'error') console.log('  [renderer error]', message.text())
  })
  await page.waitForLoadState('domcontentloaded')

  // 1. Make sure the model is on disk — through the app's own download manager.
  const status = await page.evaluate(async (model) => {
    const before = await window.hive.whisper.modelStatus(model)
    if (before.downloaded && before.variant === 'fp32') return { ...before, fetched: false }
    await new Promise((resolve, reject) => {
      const off = window.hive.whisper.onDownloadSettled((settled) => {
        if (settled.id !== model) return
        off()
        settled.status === 'done' ? resolve() : reject(new Error(settled.status))
      })
      void window.hive.whisper.startDownload(model, 'fp32')
    })
    return { ...(await window.hive.whisper.modelStatus(model)), fetched: true }
  }, MODEL)
  console.log('model:', status)

  const results = []
  for (const proxy of [false, true]) {
    const measured = await page.evaluate(
      async ({ pcm, model, proxy, chunk }) => {
        const audio = new Float32Array(pcm)
        const lib = await import(/* @vite-ignore */ new URL(chunk, document.baseURI).href)
        const { pipeline, env, WhisperTextStreamer } = lib
        env.allowRemoteModels = false
        env.allowLocalModels = true
        env.useBrowserCache = false
        env.localModelPath = 'hive-model://models/'
        env.backends.onnx.wasm.wasmPaths = new URL('ort/', document.baseURI).href
        env.backends.onnx.wasm.numThreads = 1
        env.backends.onnx.wasm.proxy = proxy

        /** Longest gap between animation frames — the main thread's stall. */
        function watchFrames() {
          let last = performance.now()
          let worst = 0
          let frames = 0
          let running = true
          const tick = () => {
            if (!running) return
            const now = performance.now()
            worst = Math.max(worst, now - last)
            last = now
            frames += 1
            requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
          return () => {
            running = false
            return { worstFrameMs: Math.round(worst), frames }
          }
        }

        const out = { proxy }
        let stopWatch = watchFrames()
        const buildStart = performance.now()
        let asr
        try {
          asr = await pipeline('automatic-speech-recognition', model, {
            device: 'wasm',
            dtype: 'fp32'
          })
        } catch (error) {
          return { ...out, error: String(error) }
        }
        out.buildMs = Math.round(performance.now() - buildStart)
        out.build = stopWatch()

        // Q2/Q3 — one transcription, watching the main thread the whole time.
        stopWatch = watchFrames()
        const partials = []
        let firstPartialMs = null
        const runStart = performance.now()
        const streamer = new WhisperTextStreamer(asr.tokenizer, {
          callback_function: (text) => {
            if (firstPartialMs === null) firstPartialMs = Math.round(performance.now() - runStart)
            partials.push(text)
          }
        })
        const result = await asr(audio, {
          language: 'portuguese',
          task: 'transcribe',
          chunk_length_s: 30,
          stride_length_s: 5,
          streamer
        })
        out.runMs = Math.round(performance.now() - runStart)
        out.run = stopWatch()
        out.partials = partials.length
        out.firstPartialMs = firstPartialMs
        out.text = (result.text ?? '').trim().slice(0, 80)

        // Q1 — a second call on the SAME cached pipeline.
        const warmStart = performance.now()
        await asr(audio, { language: 'portuguese', task: 'transcribe', chunk_length_s: 30 })
        out.warmRunMs = Math.round(performance.now() - warmStart)

        return out
      },
      { pcm: Array.from(pcm), model: MODEL, proxy, chunk: CHUNK }
    )
    console.log(JSON.stringify(measured, null, 2))
    results.push(measured)
    // A fresh page per configuration: `pipeline()` caches, and the ORT backend
    // is initialized once per document — proxy cannot be flipped in place.
    if (!proxy) {
      // A fresh document per configuration: `pipeline()` caches and the ORT
      // backend initializes once per page, so proxy cannot be flipped in place.
      await page.reload()
      await page.waitForLoadState('domcontentloaded')
    }
  }

  fs.writeFileSync(
    path.join(root, 'tools/spikes/whisperThread.result.json'),
    JSON.stringify(results, null, 2)
  )
  await app.close()
}

await main()
