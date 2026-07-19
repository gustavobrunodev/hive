import { t } from '../i18n'
import { FileTypeIcon } from '../ui/fileIcons'

interface FileMentionMenuProps {
  /** Already filtered/ranked by the caller (Chat owns query + keyboard bounds). Workspace-relative POSIX paths. */
  items: string[]
  /** Index of the keyboard-highlighted row. */
  highlightIndex: number
  onHighlight: (index: number) => void
  onSelect: (path: string) => void
  /** Shown when there are no items — distinguishes "no files" from "no match". */
  emptyLabel: string
  /** For `aria-activedescendant` wiring from the textarea. */
  listboxId: string
}

/** Splits a workspace-relative path into its directory line and file name. */
function splitPath(path: string): { dir: string | null; base: string } {
  const slash = path.lastIndexOf('/')
  if (slash === -1) return { dir: null, base: path }
  return { dir: path.slice(0, slash), base: path.slice(slash + 1) }
}

/**
 * The `#` workspace-file mention menu (chat-attachments): a listbox of
 * fuzzy-matched workspace files, anchored above the composer, opened by a
 * `#` token at the caret. Presentational only — same contract as
 * `SlashMenu`: Chat owns the query, filtering, highlight index and keyboard
 * handling; the textarea keeps focus and drives this listbox via
 * `aria-activedescendant`. Rows are chosen on `mousedown` (preventing the
 * default so the textarea doesn't blur first).
 */
export function FileMentionMenu({
  items,
  highlightIndex,
  onHighlight,
  onSelect,
  emptyLabel,
  listboxId
}: FileMentionMenuProps): React.JSX.Element {
  return (
    <div className="wb-slash-menu wb-mention-menu" role="presentation">
      <div className="wb-slash-menu-head">{t('chat.mentionMenuLabel')}</div>
      {items.length === 0 ? (
        <div className="wb-slash-empty">{emptyLabel}</div>
      ) : (
        <ul
          className="wb-slash-list"
          role="listbox"
          id={listboxId}
          aria-label={t('chat.mentionMenuLabel')}
        >
          {items.map((path, index) => {
            const { dir, base } = splitPath(path)
            return (
              <li
                key={path}
                id={`${listboxId}-opt-${index}`}
                role="option"
                aria-selected={index === highlightIndex}
                data-active={index === highlightIndex || undefined}
                className="wb-slash-item wb-mention-item"
                onMouseEnter={() => onHighlight(index)}
                onMouseDown={(event) => {
                  // Keep textarea focus (don't blur before the select lands).
                  event.preventDefault()
                  onSelect(path)
                }}
              >
                <span className="wb-slash-item-icon" aria-hidden="true">
                  <FileTypeIcon path={path} size={14} />
                </span>
                <span className="wb-slash-item-text wb-mention-item-text">
                  <span className="wb-slash-item-label">{base}</span>
                  {dir && <span className="wb-slash-item-desc wb-mention-item-dir">{dir}</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="wb-mention-menu-foot">{t('chat.mentionMenuHint')}</div>
    </div>
  )
}
