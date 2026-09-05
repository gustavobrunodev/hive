import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Command as CommandPrimitive } from "cmdk"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { useScrollLockEscape } from "../../hooks/useScrollLockEscape"
import { cx } from "../../utils/cx"
import "./OptionPicker.css"

/** Tone of a row's inline tag. Omit for the neutral treatment. */
export type OptionTagTone = "neutral" | "accent" | "success" | "warning"

export interface OptionTag {
  label: string
  tone?: OptionTagTone
}

/** One selectable row. Everything but `id`/`label` is optional detail. */
export interface PickerOption {
  /** Stable identity, compared against `value` and handed back to `onChange`. */
  id: string
  /** The name, and the only part guaranteed to be shown. */
  label: string
  /** One line of prose under the label. Wraps to at most two lines. */
  description?: string
  /**
   * Fine print under the description, set in the mono face — for the thing
   * behind the name (a resolved id, a path, a version). Deliberately a
   * separate slot from `description`: it is evidence, not explanation, and
   * mixing the two into one sentence makes both harder to scan.
   */
  hint?: string
  /** Right-aligned metric (a size, a count, a price). Set in the numeric face. */
  meta?: string
  /** Small chips after the label. Two is the practical ceiling before the row gets noisy. */
  tags?: OptionTag[]
  /** Leading glyph, 20×20. Supply a real distinction; don't decorate every row alike. */
  icon?: ReactNode
  /** Group key — must match a `PickerGroup.id` to be placed and labelled. */
  group?: string
  /** Extra text the filter should match (aliases, vendor, ids the label hides). */
  keywords?: string
  disabled?: boolean
}

export interface PickerGroup {
  id: string
  /** Header text. Omit for an unlabelled group — still a visual break. */
  label?: string
}

export interface OptionPickerProps {
  options: PickerOption[]
  /** Group order and labels. Options whose group is missing here fall to the end, ungrouped. */
  groups?: PickerGroup[]
  /** The selected option's `id`. */
  value: string
  onChange: (id: string) => void
  /** The control that opens the panel. Rendered as the popover trigger via `asChild`. */
  children: ReactNode
  /** Accessible name for the listbox — required, since the panel has no visible title. */
  ariaLabel: string
  /**
   * Whether to show the filter field. `"auto"` (the default) shows it from
   * `searchThreshold` options up, which keeps a four-row picker from looking
   * like a search problem while a twenty-row one stays usable.
   */
  searchable?: boolean | "auto"
  searchThreshold?: number
  searchPlaceholder?: string
  /** Shown when the filter matches nothing. */
  emptyLabel?: string
  /**
   * The row the consumer treats as **its default** — the one a fresh visit
   * lands on. Supplying it (together with `onPinChange`) turns on the pin
   * affordance: a toggle on every row, and the mark that says which row is
   * already the default.
   *
   * `null` is a real value ("nothing pinned"), and `undefined` means this
   * picker has no notion of a default at all — no pin control is rendered.
   */
  pinnedId?: string | null
  /**
   * Toggles the pin. Receives the row's id when a row is pinned, and `null`
   * when the pinned row is unpinned. Required for the affordance to appear.
   */
  onPinChange?: (id: string | null) => void
  /**
   * Heading for the hoisted pinned row. When given, the pinned row is lifted
   * out of its group into a section of its own at the top of the list — a
   * default you cannot find is not one you can trust. Omit to leave the row
   * where the catalogue put it.
   */
  pinGroupLabel?: string
  /** Accessible name for a row's pin toggle, per state. */
  pinHint?: (label: string) => string
  unpinHint?: (label: string) => string
  /** Pinned above the list (a status line, a warning). */
  header?: ReactNode
  /** Pinned below the list — the slot for a secondary control or provenance line. */
  footer?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
  /** Panel width in px. Defaults to 340. */
  width?: number
  className?: string
}

/**
 * A rich single-select: a popover of **described** rows, rather than a
 * `<select>` of bare labels.
 *
 * The difference is the point. A native select answers "which one is set?";
 * this answers "which one should I pick?" — every row carries the sentence
 * that makes it choosable (what it is good at, what it costs, what it really
 * resolves to), grouped so the recommended few sit above the long tail. That
 * is the shape a model picker needs, and a select can't hold it: options are
 * text nodes.
 *
 * Composition, not reinvention: Radix `Popover` supplies the portal, the focus
 * restore, Escape/outside-click dismiss and collision-aware placement; cmdk's
 * `Command` supplies filtering, the roving `aria-activedescendant` listbox and
 * the arrow/Enter contract. This layer supplies the row anatomy and the
 * tokenized surface.
 *
 * ## The hidden input
 *
 * cmdk binds its keyboard handling to the input, so a panel without one has no
 * arrow keys. When the list is short enough not to need a visible filter, the
 * input is still rendered — collapsed to zero height and transparent to the
 * eye, but focused — and it *unfolds* the moment the user types. So a short
 * picker looks like a menu and still answers type-ahead, and nobody types into
 * a field they can't see for longer than one keystroke.
 */
export function OptionPicker({
  options,
  groups,
  value,
  onChange,
  children,
  ariaLabel,
  searchable = "auto",
  searchThreshold = 8,
  searchPlaceholder,
  emptyLabel = "Nada encontrado",
  pinnedId,
  onPinChange,
  pinGroupLabel,
  pinHint = (label) => `Fixar ${label} como padrão`,
  unpinHint = (label) => `Remover ${label} como padrão`,
  header,
  footer,
  open,
  onOpenChange,
  align = "start",
  side = "top",
  sideOffset = 8,
  width = 340,
  className,
}: OptionPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  // Nodes, not refs: this panel lives behind a `Portal`, which mounts its
  // children one commit *later* than the state change that opened it, so an
  // effect keyed on `isOpen` sees a ref that is still null and binds nothing.
  // `useScrollLockEscape` documents that order in full; every effect below
  // depends on the node itself for the same reason.
  const [list, setList] = useState<HTMLDivElement | null>(null)
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  // cmdk's cursor (the row Enter would take), tracked so the panel can *open*
  // on the current choice instead of on row one — see the effect below.
  const [cursor, setCursor] = useState("")

  // The wheel escape hatch. Without it this panel is dead to the mouse whenever
  // a `Dialog` is holding it open, which is how the whole skill/agent creator
  // uses it.
  useScrollLockEscape(list)

  const showSearch =
    searchable === true || (searchable === "auto" && options.length >= searchThreshold)
  // A typed character always earns the field: hiding what the user is typing
  // is worse than showing a field they didn't ask for.
  const searchVisible = showSearch || query !== ""

  // Reopening is a fresh question, not a continuation of the last one.
  useEffect(() => {
    if (!isOpen) setQuery("")
  }, [isOpen])

  // The pinned row is hoisted into a section of its own (when the consumer
  // named one), so "which model do I start on?" is answered by the first thing
  // in the list instead of by hunting for a mark somewhere in eighteen rows.
  const ordered = useMemo(
    () => orderByGroup(options, groups, pinnedId ?? null, pinGroupLabel),
    [options, groups, pinnedId, pinGroupLabel]
  )

  /**
   * Open **on the current choice**, not at the top of the catalogue.
   *
   * A picker of eighteen models shows five at a time. Opened at row one, a user
   * whose model sits at row fourteen is shown a list with no check mark in it,
   * and has to scroll to find out what they already had — the panel answers
   * "what is there?" before it answers "what is set?", which is backwards for
   * a control whose label is the answer.
   *
   * So: put cmdk's cursor on the chosen row (arrows then continue from where
   * you are) and centre it in the viewport. The scroll is done by arithmetic on
   * the list rather than `scrollIntoView`, because that method walks *every*
   * scrollable ancestor — including the dialog behind the panel, which would
   * lurch under it.
   */
  const current = options.find((option) => option.id === value)

  useLayoutEffect(() => {
    if (list === null) return
    setCursor(current ? cmdkValue(current) : "")
    const row = list.querySelector<HTMLElement>("[data-selected-option]")
    if (row === null) return
    const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top
    list.scrollTop = Math.max(
      0,
      list.scrollTop + offset - (list.clientHeight - row.offsetHeight) / 2
    )
    // Deliberately keyed on the list appearing — i.e. on opening. Re-centring
    // while the user scrolls or filters would yank the list out from under them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list])

  /**
   * Marks which way the list continues, so the CSS can say so.
   *
   * A list that is cut off by a footer with a hard edge does not read as cut
   * off — it reads as finished, and the eleven rows below the fold may as well
   * not exist. `data-below` earns the fade that tells the truth; `data-above`
   * is what pins the group heading's rule once you have left the top.
   *
   * Written to the DOM instead of to state on purpose: this fires on every
   * scroll frame, and a re-render per frame to move one attribute is the kind
   * of cost that shows up as a list that stutters under the finger.
   */
  useEffect(() => {
    if (list === null || scroller === null) return
    const sync = (): void => {
      const room = list.scrollHeight - list.clientHeight
      scroller.toggleAttribute("data-above", list.scrollTop > 1)
      scroller.toggleAttribute("data-below", room > 1 && list.scrollTop < room - 1)
      // How much width the scrollbar actually took — 10px for a classic bar,
      // 0 for an overlay one. Measured rather than assumed, so the edge fades
      // stop exactly at the gutter on every platform instead of leaving a bare
      // strip on the ones that draw no bar at all.
      scroller.style.setProperty("--picker-gutter", `${list.offsetWidth - list.clientWidth}px`)
    }
    sync()
    list.addEventListener("scroll", sync, { passive: true })
    // The list resizes without scrolling whenever the filter narrows it — the
    // moment a stale "there is more below" fade would otherwise linger.
    const observer = new ResizeObserver(sync)
    observer.observe(list)
    const sizer = list.firstElementChild
    if (sizer) observer.observe(sizer)
    return () => {
      list.removeEventListener("scroll", sync)
      observer.disconnect()
    }
  }, [list, scroller])

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={12}
          className={cx("hds-picker", className)}
          style={{ width }}
          onOpenAutoFocus={(event) => {
            // Focus the input ourselves so the collapsed case still gets keys.
            event.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <CommandPrimitive
            className="hds-picker-command"
            label={ariaLabel}
            loop
            value={cursor}
            onValueChange={setCursor}
            // The keyboard's way to the pin. The row's own toggle is a mouse
            // target (cmdk owns the panel's focus, so eighteen tab stops
            // inside the list would take the arrow keys away from the list);
            // this, and the consumer's footer control, are what keep the pin
            // reachable without one. Alt is the modifier because a bare letter
            // belongs to the filter field.
            onKeyDown={(event) => {
              if (!onPinChange || !event.altKey || event.key.toLowerCase() !== "p") return
              const row = options.find((option) => cmdkValue(option) === cursor)
              if (!row || row.disabled) return
              event.preventDefault()
              onPinChange(row.id === pinnedId ? null : row.id)
            }}
          >
            <div className="hds-picker-search" data-collapsed={!searchVisible || undefined}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.75 10.75L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <CommandPrimitive.Input
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                placeholder={searchPlaceholder}
                className="hds-picker-input"
              />
            </div>
            {header && <div className="hds-picker-header">{header}</div>}
            {/* cmdk labels its listbox "Suggestions" unless told otherwise —
                an English string in a pt-BR product, read aloud by every
                screen reader that lands here. */}
            {/* The wrapper is what the edge affordances hang off: its two
                pseudo-elements sit at the top and bottom of the *scrolling
                area* rather than of the whole panel, which is the only way to
                place them without hardcoding the search row's height. */}
            <div className="hds-picker-scroll" ref={setScroller}>
              <CommandPrimitive.List ref={setList} className="hds-picker-list" label={ariaLabel}>
                <CommandPrimitive.Empty className="hds-picker-empty">{emptyLabel}</CommandPrimitive.Empty>
                {ordered.map(({ group, items }) => (
                  <CommandPrimitive.Group
                    key={group.id}
                    heading={group.label}
                    className="hds-picker-group"
                  >
                    {items.map((option) => (
                      <Row
                        key={option.id}
                        option={option}
                        selected={option.id === value}
                        onSelect={() => {
                          onChange(option.id)
                          setOpen(false)
                        }}
                        {...(onPinChange
                          ? {
                              pinned: option.id === pinnedId,
                              onPin: () =>
                                onPinChange(option.id === pinnedId ? null : option.id),
                              pinHint,
                              unpinHint
                            }
                          : {})}
                      />
                    ))}
                  </CommandPrimitive.Group>
                ))}
              </CommandPrimitive.List>
            </div>
          </CommandPrimitive>
          {footer && <div className="hds-picker-footer">{footer}</div>}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

function Row({
  option,
  selected,
  onSelect,
  pinned,
  onPin,
  pinHint,
  unpinHint,
}: {
  option: PickerOption
  selected: boolean
  onSelect: () => void
  /** Present only when the consumer enabled pinning (see `onPinChange`). */
  pinned?: boolean
  onPin?: () => void
  pinHint?: (label: string) => string
  unpinHint?: (label: string) => string
}) {
  return (
    <CommandPrimitive.Item
      value={cmdkValue(option)}
      disabled={option.disabled}
      onSelect={onSelect}
      className="hds-picker-item"
      data-selected-option={selected || undefined}
    >
      {option.icon && (
        <span className="hds-picker-icon" aria-hidden="true">
          {option.icon}
        </span>
      )}
      <span className="hds-picker-body">
        <span className="hds-picker-title">
          <span className="hds-picker-label">{option.label}</span>
          {option.tags?.map((tag) => (
            <span key={tag.label} className="hds-picker-tag" data-tone={tag.tone ?? "neutral"}>
              {tag.label}
            </span>
          ))}
        </span>
        {option.description && <span className="hds-picker-desc">{option.description}</span>}
        {option.hint && <span className="hds-picker-hint">{option.hint}</span>}
      </span>
      {option.meta && <span className="hds-picker-meta">{option.meta}</span>}
      {onPin && (
        <PinToggle
          pinned={pinned === true}
          label={
            (pinned === true ? unpinHint : pinHint)?.(option.label) ?? option.label
          }
          onPin={onPin}
        />
      )}
      <span className="hds-picker-check" aria-hidden="true">
        {selected && (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M3.5 8.5l3 3 6-6.5"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </CommandPrimitive.Item>
  )
}

/**
 * The row's pin: "start here next time".
 *
 * It is a button inside a listbox row, which is two things at once, so both
 * are handled explicitly:
 *
 *  - **The click must not choose the row.** cmdk selects on click, and a pin
 *    that also switched the selection would make "keep this for later" and
 *    "use this now" the same gesture. Every pointer event is stopped here.
 *  - **It is not a tab stop.** The panel's keyboard model belongs to cmdk's
 *    input; eighteen buttons in the list would take the arrow keys away from
 *    the list itself. The keyboard reaches the pin through Alt+P on the row
 *    under the cursor (see the Command's `onKeyDown`), which is why the button
 *    still carries a full accessible name.
 *
 * Invisible until the row is hovered or under the cursor — and always visible
 * once pinned, because then it is no longer a control, it is the mark.
 */
function PinToggle({
  pinned,
  label,
  onPin,
}: {
  pinned: boolean
  label: string
  onPin: () => void
}) {
  return (
    <button
      type="button"
      className="hds-picker-pin"
      data-pinned={pinned || undefined}
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      tabIndex={-1}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onPin()
      }}
    >
      {/* A pushpin seen head-on — head, shaft, point. Filled when it holds. */}
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M5.5 1.75h5l-.75 3.85 2.6 2.6c.33.33.1.9-.36.9H3.98c-.46 0-.69-.57-.36-.9l2.6-2.6L5.5 1.75Z"
          fill={pinned ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M8 9.1v5.15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </button>
  )
}

/**
 * The string cmdk knows a row by — its filter haystack *and* its cursor
 * identity, which is why it lives in one place: the panel sets the cursor to
 * the current choice on open, and a cursor computed even slightly differently
 * from the row's own value silently matches nothing.
 *
 * The label alone would not do as a haystack: it would hide a row whose id or
 * vendor is what the user actually typed.
 */
function cmdkValue(option: PickerOption): string {
  return `${option.label} ${option.id} ${option.keywords ?? ""}`
}

/**
 * Buckets options into their declared groups, in the declared order, dropping
 * groups that ended up empty. Anything whose group wasn't declared lands in a
 * trailing unlabelled bucket rather than disappearing — a picker that silently
 * omits a row is a worse bug than one with an unlabelled section.
 */
function orderByGroup(
  options: PickerOption[],
  groups: PickerGroup[] | undefined,
  pinnedId?: string | null,
  pinGroupLabel?: string
): { group: PickerGroup; items: PickerOption[] }[] {
  // The pinned row is lifted out first, so it cannot also appear inside its
  // own tier — one row, in the one place the user was promised it would be.
  const pinned =
    pinGroupLabel !== undefined && pinnedId != null
      ? options.find((option) => option.id === pinnedId)
      : undefined
  const rest = pinned ? options.filter((option) => option !== pinned) : options
  const head = pinned
    ? [{ group: { id: "__pinned", label: pinGroupLabel }, items: [pinned] }]
    : []
  if (!groups || groups.length === 0) {
    return [...head, { group: { id: "__all" }, items: rest }].filter(
      (bucket) => bucket.items.length > 0
    )
  }
  const buckets = groups.map((group) => ({
    group,
    items: rest.filter((option) => option.group === group.id),
  }))
  const known = new Set(groups.map((group) => group.id))
  const ungrouped = rest.filter((option) => !option.group || !known.has(option.group))
  if (ungrouped.length > 0) buckets.push({ group: { id: "__rest" }, items: ungrouped })
  return [...head, ...buckets].filter((bucket) => bucket.items.length > 0)
}
