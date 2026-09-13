import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@hive/design-system'
import { t } from '../i18n'
import { FilterIcon, SortIcon } from '../ui/icons'
import {
  ACTIVITY_WINDOWS,
  CONVERSATION_SORTS,
  isActivityWindow,
  isConversationSort,
  sortLabel,
  windowLabel,
  type ActivityWindow,
  type ConversationSort
} from './conversationFilters'

export interface ConversationControlsProps {
  window: ActivityWindow
  sort: ConversationSort
  onWindowChange: (window: ActivityWindow) => void
  onSortChange: (sort: ConversationSort) => void
}

/**
 * The conversation list's two controls: the activity window and the order.
 *
 * **Menus, not two rows of chips.** The sidebar is ~300px wide and already
 * carries a primary button, three tool rows and the list itself; five window
 * chips plus three sort chips would be eight competing targets above the thing
 * they filter, and the section heading would lose the row it needs. A pair of
 * compact triggers that *state their current value* costs one line, says what
 * is in force without being opened, and gets `menuitemradio` semantics,
 * arrow-key roving and type-ahead from Radix for free.
 *
 * The value is on the trigger rather than only inside the menu because "why am
 * I seeing so few conversations?" has to be answerable without clicking
 * anything.
 */
export function ConversationControls({
  window: activityWindow,
  sort,
  onWindowChange,
  onSortChange
}: ConversationControlsProps): React.JSX.Element {
  const [windowOpen, setWindowOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  return (
    <div className="wb-conv-controls">
      <DropdownMenu open={windowOpen} onOpenChange={setWindowOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="wb-conv-control"
            data-narrowed={activityWindow !== 'all' || undefined}
            aria-label={t('chatHistory.filterLabelWithCurrent', windowLabel(activityWindow))}
          >
            <FilterIcon size={13} aria-hidden="true" />
            <span className="wb-conv-control-value">{windowLabel(activityWindow)}</span>
          </button>
        </DropdownMenuTrigger>
        {windowOpen && (
          <DropdownMenuContent align="start" className="wb-conv-menu">
            <DropdownMenuLabel>{t('chatHistory.filterLabel')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={activityWindow}
              onValueChange={(value) => {
                if (isActivityWindow(value)) onWindowChange(value)
              }}
            >
              {ACTIVITY_WINDOWS.map((id) => (
                <DropdownMenuRadioItem key={id} value={id}>
                  {windowLabel(id)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        )}
      </DropdownMenu>

      <DropdownMenu open={sortOpen} onOpenChange={setSortOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="wb-conv-control"
            aria-label={t('chatHistory.sortLabelWithCurrent', sortLabel(sort))}
          >
            <SortIcon size={13} aria-hidden="true" />
            <span className="wb-conv-control-value">{sortLabel(sort)}</span>
          </button>
        </DropdownMenuTrigger>
        {sortOpen && (
          <DropdownMenuContent align="start" className="wb-conv-menu">
            <DropdownMenuLabel>{t('chatHistory.sortLabel')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => {
                if (isConversationSort(value)) onSortChange(value)
              }}
            >
              {CONVERSATION_SORTS.map((id) => (
                <DropdownMenuRadioItem key={id} value={id}>
                  {sortLabel(id)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  )
}
