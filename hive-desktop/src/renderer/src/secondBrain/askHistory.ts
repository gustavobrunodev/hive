/**
 * Recently asked Second Brain questions, per workspace (SB-R9.4).
 *
 * Asking the same thing twice is the norm — you remember the base knows
 * something, not how you phrased it. Keeping the last few questions one click
 * away turns the ask surface into a place with memory instead of a blank field.
 *
 * `localStorage`, like every other renderer-local nicety in this app
 * (`hive.workLayout`, the sidebar view): losing it costs a convenience, never
 * data, so every access is best-effort and never throws.
 */

const STORAGE_KEY = 'hive.brainQuestions'

/** How many questions we keep per workspace — enough to recognize, few enough to scan. */
export const MAX_RECENT_QUESTIONS = 5

type Store = Record<string, string[]>

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Store = {}
    for (const [ws, list] of Object.entries(parsed)) {
      if (Array.isArray(list)) {
        out[ws] = list.filter((item): item is string => typeof item === 'string' && item !== '')
      }
    }
    return out
  } catch {
    return {}
  }
}

/** The workspace's recent questions, newest first (empty when there are none). */
export function loadRecentQuestions(workspace: string): string[] {
  return readStore()[workspace]?.slice(0, MAX_RECENT_QUESTIONS) ?? []
}

/**
 * Records a question as the workspace's newest, deduplicated case-insensitively
 * (re-asking the same thing moves it to the top rather than stacking copies),
 * and returns the updated list.
 */
export function rememberQuestion(workspace: string, question: string): string[] {
  const trimmed = question.trim()
  if (trimmed === '') return loadRecentQuestions(workspace)

  const store = readStore()
  const previous = store[workspace] ?? []
  const deduped = previous.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())
  const next = [trimmed, ...deduped].slice(0, MAX_RECENT_QUESTIONS)
  store[workspace] = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Quota/private-mode — the question still gets asked, it just isn't remembered.
  }
  return next
}
