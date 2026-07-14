import { t } from '../i18n'
import { SlashIcon } from '../ui/icons'

/** Structural mirror of `main/workflowCatalog.ts`'s `SkillEntry`. */
export interface SlashSkill {
  key: string
  label: string
  description: string
}

interface SlashMenuProps {
  /** Already filtered by the caller (Chat owns the query + keyboard bounds). */
  items: SlashSkill[]
  /** Index of the keyboard-highlighted row (-1 when none). */
  highlightIndex: number
  onHighlight: (index: number) => void
  onSelect: (skill: SlashSkill) => void
  /** Shown when there are no items — distinguishes "no skills installed" from "no match". */
  emptyLabel: string
  /** For `aria-activedescendant` wiring from the textarea. */
  listboxId: string
}

/**
 * The slash-command (skills) menu (chat-controls CC-R2): a listbox of the
 * workspace's BMAD skills, anchored above the composer, opened by a leading
 * `/`. Presentational only — Chat owns the query, filtering, highlight index
 * and keyboard handling (the textarea keeps focus and controls this listbox via
 * `aria-activedescendant`, so focus is never trapped). Rows are chosen on
 * `mousedown` (preventing the default so the textarea doesn't blur first).
 */
export function SlashMenu({
  items,
  highlightIndex,
  onHighlight,
  onSelect,
  emptyLabel,
  listboxId
}: SlashMenuProps): React.JSX.Element {
  return (
    <div className="wb-slash-menu" role="presentation">
      <div className="wb-slash-menu-head">{t('chat.slashMenuLabel')}</div>
      {items.length === 0 ? (
        <div className="wb-slash-empty">{emptyLabel}</div>
      ) : (
        <ul
          className="wb-slash-list"
          role="listbox"
          id={listboxId}
          aria-label={t('chat.slashMenuLabel')}
        >
          {items.map((skill, index) => (
            <li
              key={skill.key}
              id={`${listboxId}-opt-${index}`}
              role="option"
              aria-selected={index === highlightIndex}
              data-active={index === highlightIndex || undefined}
              className="wb-slash-item"
              onMouseEnter={() => onHighlight(index)}
              onMouseDown={(event) => {
                // Keep textarea focus (don't blur before the select lands).
                event.preventDefault()
                onSelect(skill)
              }}
            >
              <span className="wb-slash-item-icon" aria-hidden="true">
                <SlashIcon size={13} />
              </span>
              <span className="wb-slash-item-text">
                <span className="wb-slash-item-label">{skill.label}</span>
                {skill.description && (
                  <span className="wb-slash-item-desc">{skill.description}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
