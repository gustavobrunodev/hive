import { t } from '../i18n'
import { FileTypeIcon } from '../ui/fileIcons'
import { highlightParts, matchRanges, type MatchRange } from './composerMentions'
import { useVirtualOptionList } from './menuScroll'

interface FileMentionMenuProps {
  /** Already filtered/ranked by the caller (Chat owns query + keyboard bounds). Workspace-relative POSIX paths. */
  items: string[]
  /** How many files matched in all. Equal to `items.length` unless the rank hit its cap. */
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

/**
 * Row height, in px — a contract with `.wb-mention-item` in `workbench.css`,
 * which is handed this number as a custom property so the two cannot drift.
 * Windowed rendering needs rows it can multiply, and uniform rows are also
 * simply the better list: a root-level file and a nested one no longer draw
 * different heights.
 */
const ROW_HEIGHT = 32

/** How many rows the port shows at once — the promise the old cap was keeping badly. */
const VISIBLE_ROWS = 8

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
 * Four things it does that a plain filtered list doesn't, each answering a
 * question a user asks of a picker:
 *
 *  - *Why is this row here?* The characters the query matched are marked, on
 *    the folder line and the file name alike.
 *  - *How many are there?* The header carries the size of the match set, so a
 *    keystroke's effect on it is visible without counting rows.
 *  - *Can I get to the rest?* Every match is in the list — eight are on
 *    screen, the arrows and the wheel reach all of them, and only the rows
 *    near the port are actually rendered (`useVirtualOptionList`). The list
 *    used to *be* eight rows long, which is why "keep typing" was previously
 *    the only way out of it.
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
  // Same reason as the slash menu: the highlight moves without focus, so
  // nothing scrolls unless we scroll it. Here it also decides which rows
  // exist at all (`menuScroll.ts`).
  // Destructured, not held as one object: the returned `ref` makes the React
  // compiler's ref rule treat every `list.*` read in the JSX below as a ref
  // access during render.
  const {
    ref: listRef,
    window: rows,
    onScroll
  } = useVirtualOptionList<HTMLDivElement>(
    items.length,
    ROW_HEIGHT,
    highlightIndex,
    VISIBLE_ROWS,
    query
  )
  const truncated = total > items.length
  return (
    <div
      className="wb-slash-menu wb-mention-menu"
      role="presentation"
      style={
        {
          '--wb-mention-row': `${ROW_HEIGHT}px`,
          '--wb-mention-rows': VISIBLE_ROWS
        } as React.CSSProperties
      }
    >
      <div className="wb-slash-menu-head wb-mention-menu-head">
        <span>{t('chat.mentionMenuLabel')}</span>
        {/* The count is always on, not only when the list truncates. It is
            the scale of what you are scrolling through — and after a
            keystroke, the fastest read of whether the query is narrowing. */}
        <span className="wb-mention-count">
          {truncated ? t('chat.mentionCount', items.length, total) : t('chat.mentionTotal', total)}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="wb-slash-empty wb-mention-empty">
          <span className="wb-mention-empty-line">{emptyLabel}</span>
          <span className="wb-mention-empty-hint">{t('chat.mentionEmptyHint')}</span>
        </div>
      ) : (
        // The scroll port is this wrapper, NOT the listbox. It has to be:
        // the rows outside the window stand in as padding on the `<ul>`, and
        // `box-sizing: border-box` means an element can never be shorter than
        // its own padding — a port carrying both would ignore its `max-height`
        // and render the whole list at full height. Measured: 1536px of "port"
        // where 256 was asked for.
        <div
          ref={listRef}
          onScroll={onScroll}
          // `hds-scrollbar` (design system): the port's bar, recoloured to the
          // palette. Without it this one carried `scrollbar-width: thin`, which
          // in Chromium opts an element out of every `::-webkit-scrollbar-*`
          // rule that would reach it — so the declaration written to make the
          // bar discreet is what painted a raw platform track, light and grey,
          // down the edge of a dark popover.
          className="wb-mention-scroll hds-scrollbar"
          data-more-above={rows.padTop > 0 || undefined}
          data-more-below={rows.padBottom > 0 || undefined}
        >
          <ul
            className="wb-slash-list wb-mention-list"
            role="listbox"
            id={listboxId}
            aria-label={t('chat.mentionMenuLabel')}
            // The rows outside the window, as space rather than as elements —
            // the scrollbar stays honest about how much list there is, and the
            // listbox's children stay exactly its options.
            style={{ paddingTop: rows.padTop, paddingBottom: rows.padBottom }}
          >
            {items.slice(rows.start, rows.end).map((path, offset) => {
              const index = rows.start + offset
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
                  // Rendered rows are a window over the match set, so the
                  // position has to be stated: without these a reader announces
                  // "1 of 14" for a row that is the 300th of 412.
                  aria-posinset={index + 1}
                  aria-setsize={items.length}
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
        </div>
      )}
      <div className="wb-mention-menu-foot">{t('chat.mentionMenuHint')}</div>
    </div>
  )
}
