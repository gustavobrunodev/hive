import { t } from '../i18n'
import { FileTypeIcon } from '../ui/fileIcons'
import { highlightParts, matchRanges, type MatchRange } from './composerMentions'

interface FileMentionMenuProps {
  /** Already filtered/ranked by the caller (Chat owns query + keyboard bounds). Workspace-relative POSIX paths. */
  items: string[]
  /** How many files matched in all — `items` is capped at 8, and the header says so when it truncates. */
  total: number
  /** The text typed after the `@`, used to paint why each row matched. */
  query: string
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
 * One line of a row, with the query's matched runs marked. `offset` is where
 * this slice starts inside the full path, because the ranges were measured
 * against the whole path (see `highlightParts`).
 */
function MatchedText({
  text,
  ranges,
  offset,
  className
}: {
  text: string
  ranges: readonly MatchRange[]
  offset: number
  className: string
}): React.JSX.Element {
  return (
    <span className={className}>
      {highlightParts(text, ranges, offset).map((part, index) =>
        part.match ? (
          <b key={index} className="wb-mention-hit">
            {part.text}
          </b>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  )
}

/**
 * The `@` workspace-file mention menu (chat-attachments): a listbox of
 * fuzzy-matched workspace files, anchored above the composer, opened by an
 * `@` token at the caret. Presentational only — same contract as
 * `SlashMenu`: Chat owns the query, filtering, highlight index and keyboard
 * handling; the textarea keeps focus and drives this listbox via
 * `aria-activedescendant`. Rows are chosen on `mousedown` (preventing the
 * default so the textarea doesn't blur first).
 *
 * Three things it does that a plain filtered list doesn't, each answering a
 * question a user asks of a picker:
 *
 *  - *Why is this row here?* The characters the query matched are marked, on
 *    the folder line and the file name alike.
 *  - *Is my file just below the fold?* The header admits when the ranked page
 *    is a slice of a larger match set, so "keep typing" reads as advice
 *    rather than as a dead end.
 *  - *How do I take it?* The highlighted row carries its own commit key.
 */
export function FileMentionMenu({
  items,
  total,
  query,
  highlightIndex,
  onHighlight,
  onSelect,
  emptyLabel,
  listboxId
}: FileMentionMenuProps): React.JSX.Element {
  const truncated = total > items.length
  return (
    <div className="wb-slash-menu wb-mention-menu" role="presentation">
      <div className="wb-slash-menu-head wb-mention-menu-head">
        <span>{t('chat.mentionMenuLabel')}</span>
        {truncated && (
          <span className="wb-mention-count">{t('chat.mentionCount', items.length, total)}</span>
        )}
      </div>
      {items.length === 0 ? (
        <div className="wb-slash-empty wb-mention-empty">
          <span className="wb-mention-empty-line">{emptyLabel}</span>
          <span className="wb-mention-empty-hint">{t('chat.mentionEmptyHint')}</span>
        </div>
      ) : (
        <ul
          className="wb-slash-list"
          role="listbox"
          id={listboxId}
          aria-label={t('chat.mentionMenuLabel')}
        >
          {items.map((path, index) => {
            const { dir, base } = splitPath(path)
            const ranges = matchRanges(path, query)
            const active = index === highlightIndex
            return (
              <li
                key={path}
                id={`${listboxId}-opt-${index}`}
                role="option"
                // Named explicitly rather than from contents: highlighting
                // splits the file name into element runs, and name-from-
                // contents puts a space at every element boundary — the row
                // would be announced as "prd .md docs". The path is also just
                // the better thing to hear, in the order it's written.
                aria-label={path}
                aria-selected={active}
                data-active={active || undefined}
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
                  <MatchedText
                    text={base}
                    ranges={ranges}
                    offset={dir === null ? 0 : dir.length + 1}
                    className="wb-slash-item-label"
                  />
                  {dir && (
                    <MatchedText
                      text={dir}
                      ranges={ranges}
                      offset={0}
                      className="wb-slash-item-desc wb-mention-item-dir"
                    />
                  )}
                </span>
                {/* The commit key travels with the highlight instead of
                    living only in the footer, so the answer to "and now
                    what?" is on the row the eye is already on. */}
                <span className="wb-mention-enter" aria-hidden="true">
                  ↵
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
