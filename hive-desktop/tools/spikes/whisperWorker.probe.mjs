/**
 * Spike 2 — can the whole Whisper pipeline live in a **dedicated worker**?
 *
 * Spike 1 closed two questions and opened this one: the inference blocks the
 * renderer's main thread completely (0 animation frames for the whole run), and
 * ORT's own `wasm.proxy` worker cannot start under this app's CSP/`file://`
 * origin ("no available backend found"). So the offload has to be ours.
 *
 * Three unknowns, none of them answerable from source, all of them fatal if the
 * answer is no:
 *   W1 — does a same-origin module worker start at all from the `file://`
 *        renderer? (pdf.js says yes for a classic worker; this asks for
 *        `type: 'module'`, which is what importing the library chunk needs.)
 *   W2 — can that worker read model bytes over the privileged `hive-model:`
 *        scheme, whose CORS rules were written for the document?
 *   W3 — with the pipeline inside it, does the main thread stay alive during a
 *        transcription — the whole point.
 *
 * The worker here is written by hand into `out/renderer/` rather than built,
 * so the probe answers "does the platform allow this" before any production
 * code is shaped around the answer.
 */
import { _electron as electron } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MODEL = process.env.SPIKE_MODEL ?? 'tiny'
const CHUNK = fs
  .readdirSync(path.join(root, 'out/renderer/assets'))
  .find((name) => name.startsWith('transformers.web-'))
const JFK = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav'

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
      const frames = size / (fmt.bits / 8) / fmt.channels
      const out = new Float32Array(frames)
      for (let i = 0; i < frames; i += 1) {
        out[i] = view.getInt16(body + i * fmt.channels * 2, true) / 32768
      }
      return { pcm: out, rate: fmt.rate }
    }
    offset = body + size + (size % 2)
  }
  throw new Error('no data chunk')
}

/** Linear resample to 16 kHz — what Whisper wants, and what the app captures. */
function to16k(pcm, rate) {
  if (rate === 16_000) return pcm
  const ratio = rate / 16_000
  const out = new Float32Array(Math.floor(pcm.length / ratio))
  for (let i = 0; i < out.length; i += 1) {
    const at = i * ratio
    const low = Math.floor(at)
    const frac = at - low
    out[i] = pcm[low] * (1 - frac) + (pcm[low + 1] ?? pcm[low]) * frac
  }
  return out
}

const WORKER_SOURCE = `
import { pipeline, env, WhisperTextStreamer } from './assets/${CHUNK}'

env.allowRemoteModels = false
env.allowLocalModels = true
env.useBrowserCache = false
env.localModelPath = 'hive-model://models/'
env.backends.onnx.wasm.wasmPaths = new URL('ort/', self.location.href).href
env.backends.onnx.wasm.numThreads = 1

let asr = null

self.onmessage = async (event) => {
  const { type, id, model, pcm } = event.data
  try {
    if (type === 'build') {
      const started = performance.now()
      asr = await pipeline('automatic-speech-recognition', model, { device: 'wasm', dtype: 'fp32' })
      self.postMessage({ id, ok: true, buildMs: Math.round(performance.now() - started) })
      return
    }
    if (type === 'run') {
      const started = performance.now()
      let firstPartialMs = null
      let partials = 0
      const streamer = new WhisperTextStreamer(asr.tokenizer, {
        callback_function: (text) => {
          partials += 1
          if (firstPartialMs === null) firstPartialMs = Math.round(performance.now() - started)
          self.postMessage({ id, partial: text, at: Math.round(performance.now() - started) })
        }
      })
      const result = await asr(new Float32Array(pcm), {
        language: 'english',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        streamer
      })
      self.postMessage({
        id,
        ok: true,
        runMs: Math.round(performance.now() - started),
        firstPartialMs,
        partials,
        text: (result.text ?? '').trim()
      })
    }
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error && error.stack ? error.stack : error) })
  }
}
self.postMessage({ booted: true })
`

async function main() {
  const { pcm: raw, rate } = await decodeFixture()
  const pcm = to16k(raw, rate)
  console.log(`fixture: ${(pcm.length / 16_000).toFixed(1)} s @ 16 kHz`)

  fs.writeFileSync(path.join(root, 'out/renderer/spike-whisper-worker.js'), WORKER_SOURCE)

  const tmpRoot = process.env.SPIKE_USERDATA ?? fs.mkdtempSync(path.join(os.tmpdir(), 'hive-spike-'))
  const userDataDir = path.join(tmpRoot, 'userData')
  const workspace = path.join(tmpRoot, 'ws')
  fs.mkdirSync(path.join(workspace, '_bmad', '_config'), { recursive: true })
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(path.join(workspace, '_bmad', '_config', 'manifest.yaml'), 'version: test\n')
  if (!fs.existsSync(path.join(userDataDir, 'config.json'))) {
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
  }

  const launchEnv = { ...process.env }
  delete launchEnv.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({
    args: [path.join(root, 'out/main/index.js'), `--user-data-dir=${userDataDir}`],
    env: launchEnv,
    cwd: root
  })
  const page = await app.firstWindow()
  page.on('console', (message) => {
    if (message.type() === 'error') console.log('  [renderer error]', message.text())
  })
  await page.waitForLoadState('domcontentloaded')

  await page.evaluate(async (model) => {
    const before = await window.hive.whisper.modelStatus(model)
    if (before.downloaded && before.variant === 'fp32') return
    await new Promise((resolve, reject) => {
      const off = window.hive.whisper.onDownloadSettled((settled) => {
        if (settled.id !== model) return
        off()
        settled.status === 'done' ? resolve() : reject(new Error(settled.status))
      })
      void window.hive.whisper.startDownload(model, 'fp32')
    })
  }, MODEL)

  const measured = await page.evaluate(
    async ({ pcm, model }) => {
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

      const url = new URL('spike-whisper-worker.js', document.baseURI).href
      let worker
      try {
        worker = new Worker(url, { type: 'module' })
      } catch (error) {
        return { w1: 'FAILED', error: String(error) }
      }

      const out = { w1: 'started' }
      const call = (message, timeout) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), timeout)
          const onMessage = (event) => {
            if (event.data.partial !== undefined) return
            if (event.data.booted) return
            clearTimeout(timer)
            worker.removeEventListener('message', onMessage)
            resolve(event.data)
          }
          worker.addEventListener('message', onMessage)
          worker.addEventListener('error', (event) => {
            clearTimeout(timer)
            reject(new Error(`worker error: ${event.message}`))
          })
          worker.postMessage(message)
        })

      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('boot timeout')), 30_000)
          worker.addEventListener('message', function onBoot(event) {
            if (!event.data.booted) return
            clearTimeout(timer)
            worker.removeEventListener('message', onBoot)
            resolve()
          })
          worker.addEventListener('error', (event) => {
            clearTimeout(timer)
            reject(new Error(`worker error: ${event.message}`))
          })
        })
      } catch (error) {
        return { ...out, w1: 'BOOT FAILED', error: String(error) }
      }
      out.w1 = 'module worker booted'

      let stop = watchFrames()
      const build = await call({ type: 'build', id: 1, model }, 300_000)
      out.build = { ...build, main: stop() }
      if (!build.ok) return { ...out, w2: 'FAILED' }
      out.w2 = 'hive-model: readable from the worker'

      stop = watchFrames()
      const run = await call({ type: 'run', id: 2, pcm }, 300_000)
      out.run = { ...run, main: stop() }
      return out
    },
    { pcm: Array.from(pcm), model: MODEL }
  )

  console.log(JSON.stringify(measured, null, 2))
  fs.writeFileSync(
    path.join(root, 'tools/spikes/whisperWorker.result.json'),
    JSON.stringify(measured, null, 2)
  )
  fs.rmSync(path.join(root, 'out/renderer/spike-whisper-worker.js'), { force: true })
  await app.close()
}

async function decodeFixture() {
  const response = await fetch(JFK)
  if (!response.ok) throw new Error(`fixture ${response.status}`)
  return decodeWav(Buffer.from(await response.arrayBuffer()))
}

await main()
