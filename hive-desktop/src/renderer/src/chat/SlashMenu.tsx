import { Fragment } from 'react'
import { t } from '../i18n'
import { AutomationIcon, CompactIcon } from '../ui/icons'
import { highlightParts, matchRanges } from './composerMentions'
import type { SlashCommand, SlashKind } from './slashCommands'

interface SlashMenuProps {
  /** Already filtered and ranked by the caller (Chat owns the query + keyboard bounds). */
  items: SlashCommand[]
  /** What was typed after the slash, for the rows' match highlighting. */
  query: string
  /** Index of the keyboard-highlighted row (-1 when none). */
  highlightIndex: number
  onHighlight: (index: number) => void
  onSelect: (command: SlashCommand) => void
  /** Shown when there are no items at all — distinguishes "no skills installed" from "no match". */
  emptyLabel: string
  /**
   * Why the skills half of the list is missing, when it is and the menu is not
   * otherwise empty.
   *
   * The built-in commands mean a bare `/` is never an empty menu again, which
   * quietly cost the two diagnoses this app deliberately keeps apart: "this
   * workspace has no skills installed" sends you to provision it, "nothing
   * matched what you typed" sends you to type something else. Without a line
   * saying which, a user with an unprovisioned workspace just sees one command
   * and no explanation for the thirty that aren't there.
   */
  note: string | null
  /** For `aria-activedescendant` wiring from the textarea. */
  listboxId: string
}

/**
 * The slash-command menu: a listbox of everything a leading `/` can name,
 * anchored above the composer.
 *
 * ## What changed, and why it is the whole point
 *
 * This used to *launch*. Highlight a row, press Enter, and the turn had already
 * gone — which meant the one thing people actually want, `/bmad-prd Eu quero
 * criar uma PRD`, could not be reached through the menu at all: it never gave
 * the line back. Selecting now **completes** the token and returns the caret,
 * exactly as this composer's own `@` file menu already did. The footer says
 * "completar", because a control that changed what it does and not what it
 * promises is a control that lies once per user.
 *
 * ## Why rows carry a name and a sentence again
 *
 * The old rows were bare keys — a palette where "what you pick is what gets
 * sent". That was true when picking sent; it is not true now, and thirty-odd
 * `/bmad-*` keys with nothing beside them is a list you can only use if you
 * already know it. The description is what makes the menu answer "which one do
 * I want", and it is matched by the query too, so a search for "prd" finds the
 * skill that *does* PRDs even when its key doesn't say so.
 *
 * ## Two sections, not one flat list
 *
 * `/compact` is the app's own command and `/bmad-prd` is BMAD's; they do
 * categorically different things and they get headed groups saying so. Order is
 * fixed by the catalog (built-ins first), so the list never reshuffles under
 * the cursor.
 *
 * Presentational only — Chat owns the query, filtering, highlight index and
 * keyboard handling (the textarea keeps focus and drives this listbox through
 * `aria-activedescendant`, so focus is never trapped). Rows commit on
 * `mousedown` with the default prevented, so the textarea never blurs first.
 */
export function SlashMenu({
  items,
  query,
  highlightIndex,
  onHighlight,
  onSelect,
  emptyLabel,
  note,
  listboxId
}: SlashMenuProps): React.JSX.Element {
  return (
    <div className="wb-slash-menu" role="presentation">
      {items.length === 0 ? (
        <>
          <div className="wb-slash-menu-head">{t('chat.slashMenuLabel')}</div>
          <div className="wb-slash-empty">{emptyLabel}</div>
        </>
      ) : (
        <ul
          className="wb-slash-list"
          role="listbox"
          id={listboxId}
          aria-label={t('chat.slashMenuLabel')}
        >
          {items.map((command, index) => (
            <Fragment key={`${command.kind}-${command.key}`}>
              {/* A heading inside the listbox, not around it: the rows are one
                  keyboard sequence and splitting them into two listboxes would
                  split the arrow keys with them. `presentation` keeps the
                  separator out of the option count screen readers announce. */}
              {sectionStart(items, index) && (
                <li className="wb-slash-section" role="presentation" aria-hidden="true">
                  {sectionLabel(command.kind)}
                </li>
              )}
              <li
                id={`${listboxId}-opt-${index}`}
                role="option"
                // Named explicitly rather than from contents — the same reason
                // `FileMentionMenu` does it: match highlighting splits the
                // command into element runs, and name-from-contents inserts a
                // space at every boundary, so `/bmad-ux` would be announced as
                // "bmad - ux". The description rides along because it is what
                // tells two `/bmad-*` rows apart when you can't see them.
                aria-label={optionLabel(command)}
                aria-selected={index === highlightIndex}
                data-active={index === highlightIndex || undefined}
                className="wb-slash-item"
                onMouseEnter={() => onHighlight(index)}
                onMouseDown={(event) => {
                  // Keep textarea focus (don't blur before the completion lands).
                  event.preventDefault()
                  onSelect(command)
                }}
              >
                {/* The icon column carries the distinction the section header
                    states, so a glance at a row is enough: a squeeze for the
                    app's own compaction, a cycle for a workspace workflow. It
                    used to be a slash for every row, which repeated the
                    character already leading the label two pixels away. */}
                <span className="wb-slash-item-icon" aria-hidden="true">
                  {command.kind === 'builtin' ? (
                    <CompactIcon size={14} />
                  ) : (
                    <AutomationIcon size={14} />
                  )}
                </span>
                <span className="wb-slash-item-text">
                  <span className="wb-slash-item-line">
                    <span className="wb-slash-cmd">/{renderMatch(command.key, query)}</span>
                    {command.argHint !== undefined && (
                      // Ghost text on the row, not in the description: an
                      // argument that changes what the command does has to be
                      // discoverable *where the command is*.
                      <span className="wb-slash-arg">{command.argHint}</span>
                    )}
                  </span>
                  <span className="wb-slash-item-desc">{command.description}</span>
                </span>
              </li>
            </Fragment>
          ))}
        </ul>
      )}
      {items.length > 0 && note !== null && (
        <p className="wb-slash-note">
          <span className="wb-slash-section">{t('chat.slashSectionSkills')}</span>
          {note}
        </p>
      )}
      <div className="wb-slash-menu-foot">
        <span className="wb-slash-foot-keys">
          <kbd className="wb-slash-kbd">↑</kbd>
          <kbd className="wb-slash-kbd">↓</kbd>
        </span>
        {t('chat.slashHintMove')}
        <span className="wb-slash-foot-sep" aria-hidden="true" />
        {/* The key's own printed name, not copy: it says "Enter" on every
            keyboard this app runs on, in every locale. */}
        <kbd className="wb-slash-kbd">Enter</kbd> {/* i18n-exempt */}
        {t('chat.slashHintComplete')}
      </div>
    </div>
  )
}

/** One row's spoken name: the command, then what it does. */
function optionLabel(command: SlashCommand): string {
  return command.description === '' ? `/${command.key}` : `/${command.key} — ${command.description}`
}

/** Does a section heading belong above this row? True for the first row of each kind. */
function sectionStart(items: readonly SlashCommand[], index: number): boolean {
  return index === 0 || items[index - 1].kind !== items[index].kind
}

const SECTION_LABELS: Record<SlashKind, string> = {
  builtin: t('chat.slashSectionBuiltin'),
  skill: t('chat.slashSectionSkills')
}

function sectionLabel(kind: SlashKind): string {
  return SECTION_LABELS[kind]
}

/**
 * The command name with the query's matched runs marked — the same treatment,
 * from the same module, that the `@` file menu uses. A row that explains why it
 * matched is a row you can trust the ranking of.
 */
function renderMatch(text: string, query: string): React.ReactNode {
  if (query === '') return text
  return highlightParts(text, matchRanges(text, query)).map((part, index) =>
    part.match ? (
      <mark key={index} className="wb-slash-match">
        {part.text}
      </mark>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    )
  )
}
