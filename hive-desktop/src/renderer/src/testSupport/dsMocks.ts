import { createElement, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Props `HighlightedTextarea` owns and that must never reach the DOM. React
 * warns about every unknown attribute on a `<textarea>`, and a test whose
 * output is buried in warnings is a test nobody reads.
 */
const OWN_PROPS = new Set(['highlight', 'active', 'minRows', 'maxRows', 'submitOnEnter'])

/**
 * A stand-in for the DS `HighlightedTextarea` in jsdom.
 *
 * The backdrop mirror is the component's own concern and has its own tests;
 * everything a *consumer* test cares about — the value, the change handler, the
 * accessible name — belongs to the real `<textarea>` underneath, so that is all
 * this renders. Shared rather than copied into each `vi.mock` factory: the
 * hand-rolled Whisper stub that drifted from its bridge is the precedent.
 */
export function HighlightedTextareaMock(props: Record<string, unknown>): React.JSX.Element {
  const rest = Object.fromEntries(Object.entries(props).filter(([key]) => !OWN_PROPS.has(key)))
  return createElement('textarea', rest)
}

/**
 * The design-system stand-ins the **run-config** subtree needs — the agent
 * switcher's menu, the engine picker's popover, its effort ramp and its
 * capacity switch, plus the spinner shown while capabilities load.
 *
 * Every surface that starts a session now renders `RunConfigBar`, so three
 * suites that never had to know about the engine control suddenly did. Shared
 * rather than copied into each `vi.mock` factory, for the reason recorded
 * above: a hand-rolled stub per suite is a stub per suite that drifts.
 *
 * They keep the *contract* the consumer depends on and nothing else: a popover
 * that is closed until its trigger is clicked (a mock that rendered every row
 * inline would put each model's label on screen twice), a row per option, and
 * — because pinning is now part of that contract — a pin button per row.
 *
 * Spread into a factory:
 * ```ts
 * vi.mock('@hive/design-system', () => ({ ...runConfigDsMocks(), Button: … }))
 * ```
 */
export function runConfigDsMocks(): Record<string, unknown> {
  return {
    Spinner: ({ label }: { label?: string }) => createElement('span', { role: 'status' }, label),
    // `children` is renamed on the way in: React's own lint refuses a
    // `children` key inside a props object, and the trigger is what it is.
    OptionPicker: ({ children, ...rest }: { children?: ReactNode }) =>
      createElement(PickerMock, { ...rest, trigger: children }),
    RampSelect: ({
      steps,
      value,
      onChange,
      ariaLabel
    }: {
      steps?: { id: string; label: string }[]
      value?: string
      onChange?: (id: string) => void
      ariaLabel?: string
    }) =>
      createElement(
        'div',
        { role: 'radiogroup', 'aria-label': ariaLabel },
        ...(steps ?? []).map((step) =>
          createElement(
            'button',
            {
              key: step.id,
              type: 'button',
              role: 'radio',
              'aria-checked': step.id === value,
              onClick: () => onChange?.(step.id)
            },
            step.label
          )
        )
      ),
    Switch: ({
      checked,
      onCheckedChange,
      ...rest
    }: {
      checked?: boolean
      onCheckedChange?: (checked: boolean) => void
    }) =>
      createElement('button', {
        ...rest,
        type: 'button',
        role: 'switch',
        'aria-checked': checked === true,
        onClick: () => onCheckedChange?.(checked !== true)
      }),
    DropdownMenu: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
    DropdownMenuTrigger: ({ children }: { children?: ReactNode }) =>
      createElement('div', null, children),
    DropdownMenuContent: ({ children }: { children?: ReactNode }) =>
      createElement('div', { role: 'menu' }, children),
    DropdownMenuItem: ({ children, ...rest }: { children?: ReactNode }) =>
      createElement('button', { ...rest, type: 'button', role: 'menuitem' }, children),
    DropdownMenuRadioGroup: ({ children }: { children?: ReactNode }) =>
      createElement('div', null, children),
    DropdownMenuRadioItem: ({
      children,
      value,
      onSelect,
      ...rest
    }: {
      children?: ReactNode
      value?: string
      onSelect?: (event: unknown) => void
    }) =>
      createElement(
        'button',
        { ...rest, type: 'button', role: 'menuitemradio', 'data-value': value, onClick: onSelect },
        children
      ),
    DropdownMenuSeparator: () => createElement('hr', null)
  }
}

/** The popover half of `runConfigDsMocks` — closed until its trigger is used. */
function PickerMock({
  options,
  value,
  onChange,
  trigger,
  footer,
  ariaLabel,
  pinnedId,
  onPinChange,
  pinHint,
  unpinHint
}: {
  options?: { id: string; label: string }[]
  value?: string
  onChange?: (id: string) => void
  /** The `children` the real picker renders as its popover trigger. */
  trigger?: ReactNode
  footer?: ReactNode
  ariaLabel?: string
  pinnedId?: string | null
  onPinChange?: (id: string | null) => void
  pinHint?: (label: string) => string
  unpinHint?: (label: string) => string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return createElement(
    'div',
    { 'data-testid': 'option-picker' },
    createElement('div', { onClick: () => setOpen((current) => !current) }, trigger),
    open &&
      createElement(
        'div',
        { role: 'listbox', 'aria-label': ariaLabel },
        ...(options ?? []).flatMap((option) => [
          createElement(
            'button',
            {
              key: option.id,
              type: 'button',
              role: 'option',
              'aria-selected': option.id === value,
              onClick: () => {
                onChange?.(option.id)
                setOpen(false)
              }
            },
            option.label
          ),
          onPinChange
            ? createElement(
                'button',
                {
                  key: `${option.id}-pin`,
                  type: 'button',
                  'aria-pressed': option.id === pinnedId,
                  'aria-label': (option.id === pinnedId ? unpinHint : pinHint)?.(option.label),
                  onClick: () => onPinChange(option.id === pinnedId ? null : option.id)
                },
                'pin'
              )
            : null
        ]),
        footer
      )
  )
}
