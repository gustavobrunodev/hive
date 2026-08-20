/**
 * Fetches the Whisper weights that ship **inside** the app (D-SB-8) into
 * `resources/whisper-models/`, where `electron-builder` picks them up through
 * the existing `asarUnpack: resources/**` rule.
 *
 * Why a build step instead of committed files: the three models are ~1.3 GB of
 * fp32 ONNX weights. Committing them would put a gigabyte of opaque binary into
 * every clone, every branch and every `git gc`, to deliver bytes that are
 * already published, immutable and content-addressable on the Hugging Face CDN.
 * So the repo carries the *recipe*, the installer carries the *bytes*, and the
 * user downloads nothing — which is the requirement that actually matters.
 *
 * The layout written here is byte-identical to what `whisperModelStore`'s
 * downloader produces, marker file included, because both are read back by the
 * same `status()`: a bundled model and a downloaded one must be
 * indistinguishable to everything above the store.
 *
 * Idempotent: a model whose marker already matches is skipped, so re-running
 * before a build costs one HTTP HEAD-equivalent per model, not a re-download.
 *
 * Run: `npm run models:fetch` (implied by `npm run build:win|mac|linux`).
 * Flags: `--force` re-fetches even a complete model, `--only <id,id>` narrows.
 */
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '..', 'resources', 'whisper-models')

/**
 * Mirrors `BUNDLED_WHISPER_MODELS` + `WHISPER_CATALOG`. Duplicated rather than
 * imported because this script runs under plain Node before any TypeScript
 * build exists; `models:check` below fails the build if the two ever drift.
 */
const MODELS = [
  { id: 'tiny', repo: 'Xenova/whisper-tiny' },
  { id: 'base', repo: 'Xenova/whisper-base' },
  { id: 'small', repo: 'Xenova/whisper-small' }
]

/** fp32 — the only precision that builds a session on the WASM backend. */
const VARIANT = 'fp32'
const MARKER = '.hive-complete.json'

const args = process.argv.slice(2)
const force = args.includes('--force')
const onlyFlag = args.indexOf('--only')
const only = onlyFlag === -1 ? null : new Set((args[onlyFlag + 1] ?? '').split(','))

/** Root metadata files every Transformers.js Whisper repo needs. */
const isWantedRootFile = (path) =>
  /^[^/]+\.(json|txt)$/.test(path) && !/^quant(ize)?_config\.json$/.test(path)

/**
 * The fp32 weights, `.onnx_data` sidecar included. The sidecar is why this
 * reads the tree API instead of hardcoding names: repos in the external-data
 * format ship a 0-byte `.onnx` stub with the real weights beside it.
 */
const isWantedOnnxFile = (path) =>
  /^onnx\/(encoder_model|decoder_model_merged)\.onnx(_data)?$/.test(path)

const mb = (bytes) => `${(bytes / 1048576).toFixed(0)} MB`

async function listRepoFiles(repo) {
  const wanted = []
  for (const sub of ['', '/onnx']) {
    const response = await fetch(`https://huggingface.co/api/models/${repo}/tree/main${sub}`)
    if (!response.ok) throw new Error(`tree API for ${repo}${sub}: HTTP ${response.status}`)
    for (const item of await response.json()) {
      if (item.type !== 'file') continue
      const keep = sub === '' ? isWantedRootFile(item.path) : isWantedOnnxFile(item.path)
      if (keep) wanted.push(item)
    }
  }
  if (!wanted.some((f) => f.path.startsWith('onnx/'))) {
    throw new Error(`no ${VARIANT} weights published for ${repo}`)
  }
  return wanted
}

/** Is this model already complete on disk, in the precision we ship? */
function isComplete(dir) {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, MARKER), 'utf-8'))
    return parsed.variant === VARIANT
  } catch {
    return false
  }
}

async function fetchModel({ id, repo }) {
  const finalDir = join(OUT_DIR, id)
  if (!force && isComplete(finalDir)) {
    console.log(`  ${id.padEnd(6)} já presente — pulando`)
    return 0
  }

  const files = await listRepoFiles(repo)
  const total = files.reduce((sum, f) => sum + (f.size ?? 0), 0)
  console.log(`  ${id.padEnd(6)} ${files.length} arquivos, ${mb(total)}`)

  // Atomic, exactly like the runtime downloader: a partial fetch must never be
  // mistaken for a shipped model by the build that packages it.
  const tempDir = join(OUT_DIR, `.tmp-${id}`)
  rmSync(tempDir, { recursive: true, force: true })
  mkdirSync(tempDir, { recursive: true })

  let loaded = 0
  for (const file of files) {
    const response = await fetch(`https://huggingface.co/${repo}/resolve/main/${file.path}`)
    if (!response.ok || !response.body) {
      rmSync(tempDir, { recursive: true, force: true })
      throw new Error(`download failed for ${repo}/${file.path}: HTTP ${response.status}`)
    }
    const target = join(tempDir, file.path)
    mkdirSync(dirname(target), { recursive: true })
    await pipeline(Readable.fromWeb(response.body), createWriteStream(target))
    loaded += statSync(target).size
    process.stdout.write(`\r    ${mb(loaded)} / ${mb(total)}  ${file.path.padEnd(32)}`)
  }
  process.stdout.write('\n')

  writeFileSync(
    join(tempDir, MARKER),
    JSON.stringify({ variant: VARIANT, repo, bundled: true, completedAt: new Date().toISOString() })
  )
  rmSync(finalDir, { recursive: true, force: true })
  renameSync(tempDir, finalDir)
  return loaded
}

const wanted = MODELS.filter((m) => only === null || only.has(m.id))
console.log(`Modelos embutidos (${VARIANT}) → ${OUT_DIR}`)
mkdirSync(OUT_DIR, { recursive: true })

let bytes = 0
for (const model of wanted) {
  bytes += await fetchModel(model)
}
console.log(`Pronto. ${bytes === 0 ? 'Nada a baixar.' : `${mb(bytes)} baixados.`}`)

// A build that silently packages an incomplete set would ship an app that
// promises offline transcription and then asks for a download on first use.
const missing = wanted.filter((m) => !isComplete(join(OUT_DIR, m.id)))
if (missing.length > 0) {
  console.error(`FALHA: incompletos após o fetch: ${missing.map((m) => m.id).join(', ')}`)
  process.exit(1)
}
