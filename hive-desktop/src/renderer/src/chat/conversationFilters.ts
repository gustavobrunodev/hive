import { t } from '../i18n'
import { sessionTitle, type ChatSessionMeta } from './sessionMeta'

/**
 * The conversation list's filter and order — pure functions, so the two
 * surfaces that show the list (the sidebar section and the wide "Todas as
 * conversas" dialog) share one definition of what "últimos 7 dias" and
 * "Recém-criadas" mean instead of each computing its own.
 */

/** How far back "last activity" may reach. */
export type ActivityWindow = '1d' | '3d' | '7d' | '30d' | 'all'

/** What the list is ordered by. */
export type ConversationSort = 'activity' | 'created' | 'name'

export const ACTIVITY_WINDOWS: readonly ActivityWindow[] = ['1d', '3d', '7d', '30d', 'all']
export const CONVERSATION_SORTS: readonly ConversationSort[] = ['activity', 'created', 'name']

/**
 * The default pair.
 *
 * `all` + `activity` is what the list did before it had either control, so the
 * redesign adds capability without silently hiding anybody's history on first
 * open — a filter that starts narrow reads as data loss.
 */
export const DEFAULT_WINDOW: ActivityWindow = 'all'
export const DEFAULT_SORT: ConversationSort = 'activity'

const WINDOW_LABEL_KEY = {
  '1d': 'chatHistory.filter1d',
  '3d': 'chatHistory.filter3d',
  '7d': 'chatHistory.filter7d',
  '30d': 'chatHistory.filter30d',
  all: 'chatHistory.filterAll'
} as const

const SORT_LABEL_KEY = {
  activity: 'chatHistory.sortActivity',
  created: 'chatHistory.sortCreated',
  name: 'chatHistory.sortName'
} as const

export function windowLabel(window: ActivityWindow): string {
  return t(WINDOW_LABEL_KEY[window])
}

export function sortLabel(sort: ConversationSort): string {
  return t(SORT_LABEL_KEY[sort])
}

export function isActivityWindow(value: unknown): value is ActivityWindow {
  return typeof value === 'string' && (ACTIVITY_WINDOWS as readonly string[]).includes(value)
}

export function isConversationSort(value: unknown): value is ConversationSort {
  return typeof value === 'string' && (CONVERSATION_SORTS as readonly string[]).includes(value)
}

/** How many days each window spans (`all` has no edge). */
const WINDOW_DAYS: Record<Exclude<ActivityWindow, 'all'>, number> = {
  '1d': 1,
  '3d': 3,
  '7d': 7,
  '30d': 30
}

const DAY_MS = 86_400_000

/**
 * The earliest `updatedAt` a window admits, or `null` for "Todos".
 *
 * Cut on **calendar-day boundaries**, exactly like the recency buckets the list
 * groups by: "1 dia" therefore means "Hoje", "7 dias" ends where the "Últimos 7
 * dias" heading ends, and "30 dias" where "Últimos 30 dias" does. A rolling
 * 24-hour window would have been simpler to write and would have put a
 * conversation under the "Hoje" heading that the "1 dia" filter then hid,
 * which is the kind of disagreement a user reads as a bug.
 */
export function windowFloor(window: ActivityWindow, now: number): number | null {
  if (window === 'all') return null
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  return startOfToday.getTime() - (WINDOW_DAYS[window] - 1) * DAY_MS
}

/**
 * The two pseudo-values the initiative filter adds either side of the real
 * demands: everything, and everything with no demand at all.
 *
 * `''` for "all" so the control's resting state is falsy and a surface that
 * never sets it behaves exactly as it did before the filter existed. "None" is
 * a real answer rather than an absence — "which of these did I start outside a
 * demand?" is the question you ask right before filing them.
 */
export const INITIATIVE_ALL = ''
export const INITIATIVE_NONE = '\u0000none'

/**
 * The conversations belonging to one demand (by folder path), to no demand at
 * all, or — the default — all of them.
 */
export function filterByInitiative(
  sessions: readonly ChatSessionMeta[],
  initiativePath: string
): ChatSessionMeta[] {
  if (initiativePath === INITIATIVE_ALL) return [...sessions]
  if (initiativePath === INITIATIVE_NONE)
    return sessions.filter((meta) => (meta.initiativePath ?? null) === null)
  return sessions.filter((meta) => meta.initiativePath === initiativePath)
}

/** The conversations whose last activity falls inside the window. */
export function filterByWindow(
  sessions: readonly ChatSessionMeta[],
  window: ActivityWindow,
  now: number
): ChatSessionMeta[] {
  const floor = windowFloor(window, now)
  return floor === null ? [...sessions] : sessions.filter((meta) => meta.updatedAt >= floor)
}

/**
 * A new array in the requested order (never a mutation — the caller's array is
 * React state).
 *
 * Names compare with `sensitivity: 'base'` and `numeric: true`, so "Épico 2"
 * sits next to "epico 10" in the order a reader expects rather than in code
 * points. The two time orders are newest-first, because a list of conversations
 * is a stack, not a timeline; `id` breaks ties so the order is total and a
 * re-render never shuffles equal rows.
 */
export function sortConversations(
  sessions: readonly ChatSessionMeta[],
  sort: ConversationSort
): ChatSessionMeta[] {
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
  return [...sessions].sort((a, b) => {
    if (sort === 'name') {
      const byName = collator.compare(sessionTitle(a), sessionTitle(b))
      if (byName !== 0) return byName
    } else {
      const key = sort === 'created' ? 'createdAt' : 'updatedAt'
      if (b[key] !== a[key]) return b[key] - a[key]
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/**
 * Whether this order should still be cut into recency headings.
 *
 * "Hoje / Ontem / Últimos 7 dias" over an alphabetical list is a heading that
 * lies about why the rows are next to each other, so name order renders flat.
 */
export function groupsFor(sort: ConversationSort): boolean {
  return sort !== 'name'
}

/**
 * The timestamp the headings should be cut on — **the one the list is sorted
 * by**, not always `updatedAt`.
 *
 * Grouping by last activity while ordering by creation date puts the rows in an
 * order that contradicts the sort: a conversation created five minutes ago but
 * untouched since last week lands under "Últimos 7 dias", *below* one created
 * days earlier that was replied to this morning — while "Recém-criadas" is
 * showing on the control. Measured, not theorised: it is what the first version
 * of this did, and the test that caught it asserts the row order directly.
 */
export function groupTimestamp(
  meta: Pick<ChatSessionMeta, 'createdAt' | 'updatedAt'>,
  sort: ConversationSort
): number {
  return sort === 'created' ? meta.createdAt : meta.updatedAt
}
