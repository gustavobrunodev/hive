import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@hive/design-system'
import { t } from '../i18n'
import { IconButton } from '../ui/IconButton'
import { ChatBubbleIcon, CloseIcon, SearchIcon } from '../ui/icons'
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
import { resolveQuery, type ChatSessionsStore } from './useChatSessions'
import type { RowMode } from './ConversationRow'

export interface AllConversationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  store: ChatSessionsStore
  activeSessionId: string | null
  runningSessionIds?: readonly string[]
  reviewPendingBySession?: Readonly<Record<string, number>>
  /** The window/order the sidebar is on — the wide view opens on the same lens. */
  window: ActivityWindow
  sort: ConversationSort
  /** Changes made here travel back to the sidebar, so the two never disagree. */
  onWindowChange: (window: ActivityWindow) => void
  onSortChange: (sort: ConversationSort) => void
  onOpenSession: (id: string) => void
  /** initiatives: demands by folder path — resolves each row's badge. */
  initiativeMarks?: InitiativeMarks
  /** initiatives: the demands the filter can narrow to. Lifted like the window and the order, for the same reason. */
  initiativeOptions?: readonly InitiativeFilterOption[]
  initiativeFilter?: string
  onInitiativeFilterChange?: (path: string) => void
}

/**
 * "Todas as conversas" — the archive.
 *
 * The sidebar previews twelve rows in the order you were last working; this is
 * where the whole history is searchable and re-sortable at a readable width. It
 * is a `Dialog` rather than a work-area pane on purpose: it answers one question
 * ("which conversation was that?"), it ends by opening one, and taking a pane
 * for it would push the transcript the user is trying to compare it against off
 * the screen.
 *
 * ## The filter and the order are the caller's
 *
 * They are lifted, so arriving here shows *the same list* the sidebar was
 * showing — widened, not reshuffled — and narrowing the window here still
 * applies when the dialog closes. A settings pair that resets on open would make
 * the button feel like it went somewhere else entirely.
 *
 * Both surfaces share the same store, so renaming or deleting here updates the
 * sidebar immediately. Only this surface applies the store's search query.
 */
export function AllConversationsDialog(
  props: AllConversationsDialogProps
): React.JSX.Element | null {
  if (!props.open) return null
  return <AllConversations {...props} />
}

function AllConversations({
  open,
  onOpenChange,
  store,
  activeSessionId,
  runningSessionIds,
  reviewPendingBySession,
  window: activityWindow,
  sort,
  onWindowChange,
  onSortChange,
  onOpenSession,
  initiativeMarks,
  initiativeOptions = [],
  initiativeFilter = INITIATIVE_ALL,
  onInitiativeFilterChange
}: AllConversationsDialogProps): React.JSX.Element {
  const { query, setQuery, reload } = store
  const [rowMode, setRowMode] = useState<RowMode | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setQuery('')
    reload()
    return () => setQuery('')
  }, [reload, setQuery])

  const handleEscape = useCallback(
    (event: KeyboardEvent): void => {
      if (rowMode !== null) {
        event.preventDefault()
        setRowMode(null)
      } else if (query !== '') {
        event.preventDefault()
        setQuery('')
        searchRef.current?.focus()
      }
    },
    [rowMode, query, setQuery]
  )

  const entries = useMemo(
    () =>
      sortConversations(
        filterByInitiative(
          filterByWindow(resolveQuery(store), activityWindow, store.loadedAt),
          initiativeFilter
        ),
        sort
      ),
    // `store` is a fresh object every render of the hook, and it already
    // carries `query` — naming it again only misleads the next reader.
    [store, activityWindow, initiativeFilter, sort]
  )

  const handleOpen = (id: string): void => {
    onOpenChange(false)
    onOpenSession(id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wb-allconv" onEscapeKeyDown={handleEscape}>
        <header className="wb-allconv-head">
          <span className="wb-allconv-mark" aria-hidden="true">
            <ChatBubbleIcon size={16} />
          </span>
          <DialogTitle className="wb-allconv-title">{t('chatHistory.allTitle')}</DialogTitle>
          {store.sessions !== null && store.sessions.length > 0 && (
            <span className="wb-allconv-count">{t('chatHistory.allCount', entries.length)}</span>
          )}
          <IconButton
            label={t('chatHistory.closeLabel')}
            className="wb-allconv-close"
            onClick={() => onOpenChange(false)}
          >
            <CloseIcon size={14} />
          </IconButton>
        </header>
        <DialogDescription className="wb-allconv-desc">
          {t('chatHistory.allDescription')}
        </DialogDescription>

        <div className="wb-allconv-controls">
          <div className="wb-history-search wb-allconv-search">
            <SearchIcon size={14} className="wb-history-search-icon" />
            <input
              ref={searchRef}
              className="wb-history-search-input"
              type="text"
              value={query}
              placeholder={t('chatHistory.searchPlaceholder')}
              aria-label={t('chatHistory.searchPlaceholder')}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
            />
            {query !== '' && (
              <IconButton
                label={t('chatHistory.searchClearLabel')}
                className="wb-history-search-clear"
                onClick={() => {
                  setQuery('')
                  searchRef.current?.focus()
                }}
              >
                <CloseIcon size={12} />
              </IconButton>
            )}
          </div>
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

        <div className="wb-allconv-body">
          <ConversationList
            entries={entries}
            totalLoaded={store.sessions?.length ?? 0}
            status={store.status}
            error={store.error}
            rowMode={rowMode}
            onRowModeChange={setRowMode}
            now={store.loadedAt}
            sort={sort}
            window={activityWindow}
            query={query}
            activeSessionId={activeSessionId}
            runningSessionIds={runningSessionIds}
            reviewPendingBySession={reviewPendingBySession}
            onOpen={handleOpen}
            onRename={store.rename}
            onDelete={store.remove}
            onDeleteMany={store.removeMany}
            onRetry={store.reload}
            onClearWindow={() => onWindowChange('all')}
            skeletonRows={8}
            {...(initiativeMarks ? { initiatives: initiativeMarks } : {})}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
