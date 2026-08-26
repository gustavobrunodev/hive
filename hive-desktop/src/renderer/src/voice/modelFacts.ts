import { t } from '../i18n'

/** One catalog row as the bridge returns it. */
export type ModelInfo = Awaited<ReturnType<Window['hive']['whisper']['listModels']>>[number]

/** The two axes a person actually chooses along, each 1–5. */
export interface ModelRating {
  /** How well it transcribes. Derived from the published parameter count. */
  accuracy: number
  /** How fast it answers. Derived from the published speed multiplier. */
  speed: number
}

/** Parses `'769 M'` / `'1.55 B'` into a plain parameter count. */
function paramCount(params: string): number {
  const value = Number.parseFloat(params.replace(',', '.'))
  if (!Number.isFinite(value)) return 0
  return /b/i.test(params) ? value * 1000 : value
}

/** Parses the catalog's `'~10x'` into `10`. */
function speedMultiple(relativeSpeed: string): number {
  const value = Number.parseFloat(relativeSpeed.replace(/[^\d.]/g, ''))
  return Number.isFinite(value) ? value : 1
}

/**
 * The two readings that answer "which one do I want?".
 *
 * **Derived from the row, never a second table.** Every figure here already
 * exists in the catalog (`params`, `relativeSpeed`) and comes from the
 * published Whisper card; restating it as a hand-written 1–5 rating would be a
 * second source of truth that drifts the first time a model is added.
 *
 * Five steps rather than a number, because the question is comparative. Nobody
 * choosing a transcription model is asking how many weights it has; they are
 * asking whether this one is better than the one above it, and by how much.
 */
export function modelRating(model: ModelInfo): ModelRating {
  const size = paramCount(model.params)
  const accuracy = size >= 1000 ? 5 : size >= 700 ? 4 : size >= 200 ? 3 : size >= 70 ? 2 : 1
  const times = speedMultiple(model.relativeSpeed)
  const speed = times >= 8 ? 5 : times >= 6 ? 4 : times >= 3 ? 3 : times >= 2 ? 2 : 1
  return { accuracy, speed }
}

/**
 * The one-line character of a model — the part that is actually a choice.
 *
 * Keyed off the same two ratings rather than off the id, so a model added to
 * the catalog gets a sentence without anyone remembering to write one.
 */
export function modelTradeoff(model: ModelInfo): string {
  const { accuracy, speed } = modelRating(model)
  if (accuracy >= 4 && speed >= 4) return t('voice.tradeoffBalancedStrong')
  if (accuracy >= 4) return t('voice.tradeoffAccurate')
  if (speed >= 5) return t('voice.tradeoffFastest')
  if (accuracy <= 2) return t('voice.tradeoffFast')
  return t('voice.tradeoffBalanced')
}

/**
 * Catalog order for the library: multilingual ladder first, then the
 * English-only builds.
 *
 * The `.en` models are a specialist's choice in a pt-BR product (D-SB-6) — they
 * transcribe Portuguese into confident nonsense — so they belong in the list,
 * findable, and below the models anyone here would actually reach for. Ten rows
 * sorted purely by size would interleave them and put `tiny.en` second.
 */
export function libraryOrder(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    if (a.multilingual !== b.multilingual) return a.multilingual ? -1 : 1
    return a.sizeMB.fp32 - b.sizeMB.fp32
  })
}
