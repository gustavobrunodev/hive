import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../i18n'

/**
 * The anchorable tour stops, in narrative order. Each id resolves to a
 * `[data-tour="<id>"]` element at open time; a stop whose anchor isn't on
 * screen (e.g. no shortcuts before role actions load) is silently dropped —
 * the tour adapts to whatever the first-run screen actually shows.
 */
const TOUR_ANCHORS = ['shortcuts', 'composer', 'rail', 'files', 'profile'] as const

type TourStepId = 'welcome' | (typeof TOUR_ANCHORS)[number]

interface TourStep {
  id: TourStepId
  element: HTMLElement | null
}

interface SpotRect {
  top: number
  left: number
  width: number
  height: number
}

type CardPlacement = 'center' | 'below' | 'above' | 'right'

interface GuidedTourProps {
  open: boolean
  /** Display name — warms up the welcome step when known. */
  userName?: string | null
  /** Fired on skip AND on finish — the caller marks the tour as seen either way. */
  onClose: () => void
}

/** Estimated card box for placement math (real card is clamped to ~340px). */
const CARD_WIDTH = 344
const CARD_MARGIN = 16
const EDGE = 12

/** First name only — same greeting rule as the chat hero (IntentGrid). */
function firstNameOf(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0]
  return first && first.length > 0 ? first : null
}

function stepTitle(id: TourStepId, userName: string | null): string {
  const firstName = firstNameOf(userName)
  switch (id) {
    case 'welcome':
      return firstName ? t('tour.welcomeTitleNamed', firstName) : t('tour.welcomeTitle')
    case 'shortcuts':
      return t('tour.shortcutsTitle')
    case 'composer':
      return t('tour.composerTitle')
    case 'rail':
      return t('tour.railTitle')
    case 'files':
      return t('tour.filesTitle')
    case 'profile':
      return t('tour.profileTitle')
  }
}

function stepBody(id: TourStepId): string {
  switch (id) {
    case 'welcome':
      return t('tour.welcomeBody')
    case 'shortcuts':
      return t('tour.shortcutsBody')
    case 'composer':
      return t('tour.composerBody')
    case 'rail':
      return t('tour.railBody')
    case 'files':
      return t('tour.filesBody')
    case 'profile':
      return t('tour.profileBody')
  }
}

/** Where the card should sit relative to the spotlighted rect. */
function placeCard(rect: SpotRect | null): {
  placement: CardPlacement
  top: number
  left: number
} {
  if (rect === null) return { placement: 'center', top: 0, left: 0 }
  const viewW = window.innerWidth
  const viewH = window.innerHeight
  const centerX = rect.left + rect.width / 2
  const clampedLeft = Math.min(
    Math.max(centerX - CARD_WIDTH / 2, EDGE),
    Math.max(viewW - CARD_WIDTH - EDGE, EDGE)
  )
  const spaceBelow = viewH - (rect.top + rect.height)
  if (spaceBelow >= 240) {
    return { placement: 'below', top: rect.top + rect.height + CARD_MARGIN, left: clampedLeft }
  }
  const spaceRight = viewW - (rect.left + rect.width)
  if (spaceRight >= CARD_WIDTH + CARD_MARGIN + EDGE) {
    return {
      placement: 'right',
      top: Math.min(Math.max(rect.top + rect.height / 2, 120), viewH - 120),
      left: rect.left + rect.width + CARD_MARGIN
    }
  }
  return { placement: 'above', top: rect.top - CARD_MARGIN, left: clampedLeft }
}

/**
 * First-run guided tour: a spotlight overlay that walks the main surfaces
 * (shortcuts → composer → rail → files → profile), skippable at any moment
 * ("Pular tour", Esc, or ← → to navigate). The spotlight is one element with
 * a viewport-sized shadow, so moving between stops is a single smooth
 * transition (crossfade under `prefers-reduced-motion`). The overlay blocks
 * the app behind it — the tour is modal, but never more than one click (or
 * one Esc) away from done.
 */
export function GuidedTour({
  open,
  userName = null,
  onClose
}: GuidedTourProps): React.JSX.Element | null {
  const [steps, setSteps] = useState<TourStep[]>([])
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<SpotRect | null>(null)
  const primaryRef = useRef<HTMLButtonElement | null>(null)

  // Resolve the anchors fresh on every open — the tour adapts to the screen.
  useEffect(() => {
    if (!open) return
    // Locally-defined function invoked immediately (the repo's GuidedInstall
    // `load()` pattern) — react-hooks/set-state-in-effect.
    function resolveSteps(): void {
      const resolved: TourStep[] = [{ id: 'welcome', element: null }]
      for (const id of TOUR_ANCHORS) {
        const element = document.querySelector<HTMLElement>(`[data-tour="${id}"]`)
        if (element) resolved.push({ id, element })
      }
      setSteps(resolved)
      setIndex(0)
    }
    resolveSteps()
  }, [open])

  const step = steps[index] ?? null

  // Measure (and re-measure on resize) the current stop's anchor.
  useEffect(() => {
    if (!open || !step) return
    function measure(): void {
      const element = step?.element ?? null
      if (!element || !element.isConnected) {
        setRect(null)
        return
      }
      const r = element.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, step])

  const isLast = index === steps.length - 1
  const goNext = useCallback(() => {
    if (index >= steps.length - 1) {
      onClose()
    } else {
      setIndex((current) => current + 1)
    }
  }, [index, steps.length, onClose])
  const goBack = useCallback(() => setIndex((current) => Math.max(0, current - 1)), [])

  // Keyboard: Esc skips, arrows navigate — available from anywhere (the
  // overlay is modal; no other surface should be reacting to keys).
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent): void {
      switch (event.key) {
        case 'Escape':
          event.preventDefault()
          onClose()
          break
        case 'ArrowRight':
          event.preventDefault()
          goNext()
          break
        case 'ArrowLeft':
          event.preventDefault()
          goBack()
          break
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, goNext, goBack, onClose])

  // Keep focus on the primary action as the steps advance.
  useEffect(() => {
    if (open) primaryRef.current?.focus()
  }, [open, index])

  if (!open || step === null) return null

  const { placement, top, left } = placeCard(rect)
  const cardStyle = placement === 'center' ? undefined : { top: `${top}px`, left: `${left}px` }

  const primaryLabel =
    step.id === 'welcome' ? t('tour.startCta') : isLast ? t('tour.doneCta') : t('tour.nextCta')

  return (
    <div
      className="wb-tour"
      role="dialog"
      aria-modal="true"
      aria-label={t('tour.ariaLabel')}
      data-spotless={rect === null || undefined}
    >
      {rect !== null && (
        <div
          className="wb-tour-spotlight"
          style={{
            top: `${rect.top - 8}px`,
            left: `${rect.left - 8}px`,
            width: `${rect.width + 16}px`,
            height: `${rect.height + 16}px`
          }}
          aria-hidden="true"
        />
      )}
      <div className="wb-tour-card" data-placement={placement} style={cardStyle} key={step.id}>
        <p className="wb-tour-step-count" aria-live="polite">
          {t('tour.progressLabel', index + 1, steps.length)}
        </p>
        <h2 className="wb-tour-title">{stepTitle(step.id, userName)}</h2>
        <p className="wb-tour-body">{stepBody(step.id)}</p>
        <div className="wb-tour-dots" aria-hidden="true">
          {steps.map((entry, dotIndex) => (
            <span
              key={entry.id}
              className="wb-tour-dot"
              data-active={dotIndex === index || undefined}
            />
          ))}
        </div>
        <div className="wb-tour-actions">
          <button type="button" className="wb-tour-skip" onClick={onClose}>
            {t('tour.skipCta')}
          </button>
          <div className="wb-tour-nav">
            {index > 0 && (
              <button type="button" className="wb-tour-btn" onClick={goBack}>
                {t('tour.backCta')}
              </button>
            )}
            <button
              type="button"
              ref={primaryRef}
              className="wb-tour-btn wb-tour-btn-primary"
              onClick={goNext}
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
