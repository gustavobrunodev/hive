import { useMemo, type ReactNode } from 'react'
import { t } from '../i18n'
import { ListAllIcon, PlusIcon } from '../ui/icons'
import { ConversationControls } from './ConversationControls'
import { ConversationList } from './ConversationList'
import {
  INITIATIVE_ALL,
  filterByInitiative,
  filterByWindow,
  sortConversations,
  type ActivityWindow,
  type ConversationSort
} from './conversationFilters'
import type { InitiativeFilterOption } from './ConversationControls'
import type { InitiativeMarks } from '../initiatives/initiativeChrome'
import type { ChatSessionsStore } from './useChatSessions'

/**
 * How many rows the sidebar previews.
 *
 * The sidebar's job is "get me back into a conversation I was just in", and
 * twelve rows is about two screenfuls of that on a laptop. Everything past it
 * is an archive question — search, a different order, a wider window — which is
 * what "Ver todas as conversas" opens. Capping is also what makes that button
 * mean something instead of being a second door to the same list.
 */
export const SIDEBAR_PREVIEW_LIMIT = 12

export interface ChatSidebarProps {
  /**
   * The Iniciativas section, above the history.
   *
   * Passed in rather than mounted here so this file keeps owning exactly one
   * thing — the conversation list — and the initiatives store stays where the
   * work area can reach it too.
   */
  initiatives?: ReactNode
  store: ChatSessionsStore
  window: ActivityWindow
  sort: ConversationSort
  onWindowChange: (window: ActivityWindow) => void
  onSortChange: (sort: ConversationSort) => void
  activeSessionId: string | null
  runningSessionIds?: readonly string[]
  reviewPendingBySession?: Readonly<Record<string, number>>
  onOpenSession: (id: string) => void
  onOpenAll: () => void
  /** initiatives: demands by folder path — resolves each row's badge. */
  initiativeMarks?: InitiativeMarks
  /** initiatives: the demands the filter can narrow to. Empty hides the control. */
  initiativeOptions?: readonly InitiativeFilterOption[]
  initiativeFilter?: string
  onInitiativeFilterChange?: (path: string) => void
}

/**
 * The Chat tab's home: the conversation list, with the controls that shape it.
 *
 * The `+ Novo` button and the three chat tools live one level up (in the
 * sidebar's fixed header) so they stay put while this region swaps for the
 * agent-review and knowledge-base panels — the tools have to remain reachable
 * from inside the surface they opened.
 */
export function ChatSidebar({
  initiatives,
  store,
  window: activityWindow,
  sort,
  onWindowChange,
  onSortChange,
  activeSessionId,
  runningSessionIds,
  reviewPendingBySession,
  onOpenSession,
  onOpenAll,
  initiativeMarks,
  initiativeOptions = [],
  initiativeFilter = INITIATIVE_ALL,
  onInitiativeFilterChange
}: ChatSidebarProps): React.JSX.Element {
  const visible = useMemo(
    () =>
      sortConversations(
        filterByInitiative(
          filterByWindow(store.sessions ?? [], activityWindow, store.loadedAt),
          initiativeFilter
        ),
        sort
      ),
    [store.sessions, store.loadedAt, activityWindow, initiativeFilter, sort]
  )
  const loaded = store.sessions ?? []
  const shown = visible.slice(0, SIDEBAR_PREVIEW_LIMIT)
  const hidden = visible.length - shown.length

  return (
    <div className="wb-chatside">
      {initiatives}
      <div className="wb-chatside-head">
        <h2 className="wb-sidebar-group-label">{t('nav.conversationsLabel')}</h2>
        <ConversationControls
          window={activityWindow}
          sort={sort}
          onWindowChange={onWindowChange}
          onSortChange={onSortChange}
          initiatives={initiativeOptions}
          initiativeFilter={initiativeFilter}
          {...(onInitiativeFilterChange ? { onInitiativeFilterChange } : {})}
        />
      </div>

      <div className="wb-chatside-list">
        <ConversationList
          entries={shown}
          totalLoaded={loaded.length}
          status={store.status}
          error={store.error === 'search' ? null : store.error}
          now={store.loadedAt}
          sort={sort}
          window={activityWindow}
          activeSessionId={activeSessionId}
          runningSessionIds={runningSessionIds}
          reviewPendingBySession={reviewPendingBySession}
          onOpen={onOpenSession}
          onRename={store.rename}
          onDelete={store.remove}
          onDeleteMany={store.removeMany}
          onRetry={store.reload}
          onClearWindow={() => onWindowChange('all')}
          skeletonRows={4}
          {...(initiativeMarks ? { initiatives: initiativeMarks } : {})}
        />
      </div>

      {/* Always present, including an empty or temporarily unavailable history — a button that appears only
          past a threshold is a control users never learn exists. The remainder
          rides on it so it says what it will actually add. */}
      <button type="button" className="wb-chatside-all" onClick={onOpenAll}>
        <ListAllIcon size={14} aria-hidden="true" />
        <span className="wb-chatside-all-text">{t('nav.seeAllLabel')}</span>
        {hidden > 0 && (
          <span className="wb-chatside-all-count" aria-hidden="true">
            +{hidden}
          </span>
        )}
      </button>
    </div>
  )
}

export interface NewConversationButtonProps {
  onClick: () => void
  /** A turn is still streaming in the open conversation — starting a new one is still allowed, this only reports it. */
  disabled?: boolean
}

/** The Chat tab's primary action. Kept beside the sidebar's fixed header, above the tools. */
export function NewConversationButton({
  onClick,
  disabled = false
}: NewConversationButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className="wb-newconv"
      // The visible word is short because the row is narrow; the accessible
      // name spells out what it starts, and contains the visible text so the
      // two never disagree (WCAG 2.5.3, label in name).
      aria-label={t('nav.newAria')}
      disabled={disabled}
      onClick={onClick}
    >
      <PlusIcon size={15} aria-hidden="true" />
      <span className="wb-newconv-text">{t('nav.newLabel')}</span>
    </button>
  )
}
