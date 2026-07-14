import { forwardRef, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { CheckIcon } from './icons'

/**
 * A selectable card + an accessible radiogroup wrapper, shared by the agent
 * picker (agent-selection), the role picker (role-personalization) and the
 * profile sheet's two sections. One selectable-card vocabulary across every
 * "pick one" surface (product register: consistent affordances).
 *
 * A genuine single-select affordance with distinct content per option — not
 * the banned identical-icon card grid. Full state vocabulary: default, hover,
 * selected (accent tint + check), disabled ("Em breve" placeholders),
 * focus-visible ring.
 */

export interface ChoiceOption {
  id: string
  icon: ReactNode
  title: string
  description: string
  /** Non-selectable placeholder (e.g. an unavailable agent) — dimmed, skipped in keyboard nav. */
  disabled?: boolean
  /** Small pill inside the title row (e.g. "Em breve"). */
  badge?: string
  /** Extra content under the description (e.g. a role's action preview chips). */
  extra?: ReactNode
}

interface ChoiceCardProps extends ChoiceOption {
  selected: boolean
  tabIndex: number
  onSelect: () => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

const ChoiceCard = forwardRef<HTMLDivElement, ChoiceCardProps>(function ChoiceCard(
  { icon, title, description, disabled, badge, extra, selected, tabIndex, onSelect, onKeyDown },
  ref
) {
  return (
    <div
      ref={ref}
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : tabIndex}
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
      className="wb-choice-card"
      onClick={disabled ? undefined : onSelect}
      onKeyDown={onKeyDown}
    >
      <span className="wb-choice-card-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="wb-choice-card-body">
        <span className="wb-choice-card-title">
          {title}
          {badge && <span className="wb-choice-card-badge">{badge}</span>}
        </span>
        <span className="wb-choice-card-desc">{description}</span>
        {extra}
      </span>
      <span className="wb-choice-card-check" aria-hidden="true">
        <CheckIcon size={13} />
      </span>
    </div>
  )
})

interface ChoiceGridProps {
  ariaLabel: string
  options: ChoiceOption[]
  value: string | null
  onChange: (id: string) => void
  /** Layout hint: `cards` (wide multi-column grid, onboarding) or `list` (single column, in-sheet). */
  variant?: 'cards' | 'list'
}

/**
 * Radiogroup wrapper: roving tabindex (a single tab stop), arrow-key selection
 * over the *enabled* options, Home/End, and Enter/Space to pick — the ARIA
 * radiogroup keyboard pattern. Disabled options are focusable-skipped.
 */
export function ChoiceGrid({
  ariaLabel,
  options,
  value,
  onChange,
  variant = 'cards'
}: ChoiceGridProps): React.JSX.Element {
  const refs = useRef(new Map<string, HTMLDivElement>())
  const enabled = options.filter((option) => !option.disabled)
  // The single tab stop: the selected option if it's enabled, else the first
  // enabled option (so the group is always reachable even before a pick).
  const rovingId = (value && enabled.some((o) => o.id === value) ? value : enabled[0]?.id) ?? null

  function focusAndSelect(id: string): void {
    onChange(id)
    refs.current.get(id)?.focus()
  }

  function moveBy(fromId: string, delta: number): void {
    if (enabled.length === 0) return
    const index = enabled.findIndex((o) => o.id === fromId)
    const start = index === -1 ? 0 : index
    const next = (start + delta + enabled.length) % enabled.length
    focusAndSelect(enabled[next].id)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, id: string): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        moveBy(id, 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        moveBy(id, -1)
        break
      case 'Home':
        event.preventDefault()
        if (enabled[0]) focusAndSelect(enabled[0].id)
        break
      case 'End':
        event.preventDefault()
        if (enabled.length) focusAndSelect(enabled[enabled.length - 1].id)
        break
      case ' ':
      case 'Enter':
        event.preventDefault()
        onChange(id)
        break
    }
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="wb-choice-grid" data-variant={variant}>
      {options.map((option) => (
        <ChoiceCard
          key={option.id}
          {...option}
          ref={(el) => {
            if (el) refs.current.set(option.id, el)
            else refs.current.delete(option.id)
          }}
          selected={value === option.id}
          tabIndex={option.id === rovingId ? 0 : -1}
          onSelect={() => onChange(option.id)}
          onKeyDown={(event) => handleKeyDown(event, option.id)}
        />
      ))}
    </div>
  )
}
