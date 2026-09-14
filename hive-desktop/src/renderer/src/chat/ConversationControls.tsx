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
import { FilterIcon, SortIcon, TargetIcon } from '../ui/icons'
import {
  ACTIVITY_WINDOWS,
  CONVERSATION_SORTS,
  INITIATIVE_ALL,
  INITIATIVE_NONE,
  isActivityWindow,
  isConversationSort,
  sortLabel,
  windowLabel,
  type ActivityWindow,
  type ConversationSort
} from './conversationFilters'

/** One demand the filter can narrow to. */
export interface InitiativeFilterOption {
  path: string
  title: string
}

export interface ConversationControlsProps {
  window: ActivityWindow
  sort: ConversationSort
  onWindowChange: (window: ActivityWindow) => void
  onSortChange: (sort: ConversationSort) => void
  /**
   * initiatives: the demands this workspace has.
   *
   * Empty (the default) renders **no third control at all** — a filter whose
   * every option is "todas" is chrome that teaches a feature the workspace is
   * not using, in the narrowest column of the app.
   */
  initiatives?: readonly InitiativeFilterOption[]
  initiativeFilter?: string
  onInitiativeFilterChange?: (path: string) => void
}

/**
 * The conversation list's controls: the activity window, the order, and — once
 * the workspace has demands — which initiative the rows belong to.
 *
 * **Menus, not rows of chips.** The sidebar is ~300px wide and already carries
 * a primary button, three tool rows and the list itself; five window chips plus
 * three sort chips would be eight competing targets above the thing they
 * filter, and the section heading would lose the row it needs. Compact triggers
 * that *state their current value* cost one line, say what is in force without
 * being opened, and get `menuitemradio` semantics, arrow-key roving and
 * type-ahead from Radix for free.
 *
 * The value is on the trigger rather than only inside the menu because "why am
 * I seeing so few conversations?" has to be answerable without clicking
 * anything.
 */
export function ConversationControls({
  window: activityWindow,
  sort,
  onWindowChange,
  onSortChange,
  initiatives = [],
  initiativeFilter = INITIATIVE_ALL,
  onInitiativeFilterChange
}: ConversationControlsProps): React.JSX.Element {
  const [windowOpen, setWindowOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [demandOpen, setDemandOpen] = useState(false)
  const demandLabel = initiativeFilterLabel(initiatives, initiativeFilter)

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

      {initiatives.length > 0 && onInitiativeFilterChange !== undefined && (
        <DropdownMenu open={demandOpen} onOpenChange={setDemandOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="wb-conv-control"
              data-narrowed={initiativeFilter !== INITIATIVE_ALL || undefined}
              aria-label={t('initiatives.filterAria')}
            >
              <TargetIcon size={13} aria-hidden="true" />
              <span className="wb-conv-control-value">{demandLabel}</span>
            </button>
          </DropdownMenuTrigger>
          {demandOpen && (
            <DropdownMenuContent align="start" className="wb-conv-menu">
              <DropdownMenuLabel>{t('initiatives.filterLabel')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={initiativeFilter}
                onValueChange={onInitiativeFilterChange}
              >
                <DropdownMenuRadioItem value={INITIATIVE_ALL}>
                  {t('initiatives.filterAll')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value={INITIATIVE_NONE}>
                  {t('initiatives.filterNone')}
                </DropdownMenuRadioItem>
                {initiatives.map((entry) => (
                  <DropdownMenuRadioItem key={entry.path} value={entry.path}>
                    {entry.title}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      )}
    </div>
  )
}

/** What the trigger says at rest — the demand's own name, so "why so few rows?" is answerable without opening it. */
function initiativeFilterLabel(
  initiatives: readonly InitiativeFilterOption[],
  value: string
): string {
  if (value === INITIATIVE_ALL) return t('initiatives.filterAll')
  if (value === INITIATIVE_NONE) return t('initiatives.filterNone')
  return initiatives.find((entry) => entry.path === value)?.title ?? t('initiatives.filterAll')
}
