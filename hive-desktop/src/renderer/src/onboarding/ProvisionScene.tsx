import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Progress } from '@hive/design-system'
import { t } from '../i18n'
import { CheckIcon } from '../ui/icons'
import { HiveLogo } from '../ui/HiveLogo'
import { HiveHoneycomb } from './HiveHoneycomb'

/** How long each reassurance line holds before the next one crossfades in. */
const MESSAGE_INTERVAL_MS = 4200

export interface ProvisionStep {
  id: string
  label: string
}

export interface ProvisionSceneProps {
  /** Stable heading — which stage of the preparation this is. */
  title: string
  /**
   * Warm, rotating reassurance. Deliberately separate from `caption`: this
   * says "we're taking care of it", `caption` says what is literally
   * happening. Rotation stops on the last line, so the copy never loops back
   * to "getting started" after five minutes of waiting.
   */
  messages: readonly string[]
  /** The run's real current line (a `progress`/`step` event), verbatim. */
  caption: string | null
  /** Fallback caption while the stream hasn't said anything yet. */
  captionFallback: string
  /** Completed-then-active checklist, when the stream emits steps. */
  steps?: readonly ProvisionStep[]
  /** 1-based position in the whole gate, e.g. `[1, 2]` — how much is left. */
  stage: readonly [number, number]
  /** Set once the run fails; freezes the scene and replaces the progress area. */
  error?: { title: string; message: string } | null
  /** Retry / continue-anyway controls, rendered under either state. */
  actions?: ReactNode
}

/**
 * The surface every "we're setting things up" gate shares — BMAD install,
 * BMAD update, Second Brain provisioning.
 *
 * Before this, each gate was its own small card with a title, an indeterminate
 * bar and a caption, and a first run flashed through three of them in a row;
 * the effect was three anonymous loading screens rather than one preparation.
 * So the composition is fixed here and the three gates supply only their own
 * words: one lattice, one heading, rotating reassurance, the truthful caption,
 * and a stage counter that says how many steps are left.
 *
 * Motion is state, not decoration (PRODUCT.md §5): the lattice runs only while
 * work is in flight and holds still on error, the message crossfade marks the
 * passage of time in a wait with no percentage to show, and both have a
 * `prefers-reduced-motion` fallback in `workbench.css`.
 */
export function ProvisionScene({
  title,
  messages,
  caption,
  captionFallback,
  steps,
  stage,
  error,
  actions
}: ProvisionSceneProps): React.JSX.Element {
  const [messageIndex, setMessageIndex] = useState(0)
  const running = !error

  useEffect(() => {
    // Advance until the last line, then hold it: the final message is written
    // to be true for an arbitrarily long wait, so looping adds nothing.
    if (!running || messageIndex >= messages.length - 1) return
    const timer = window.setTimeout(
      () => setMessageIndex((current) => current + 1),
      MESSAGE_INTERVAL_MS
    )
    return () => window.clearTimeout(timer)
  }, [running, messageIndex, messages.length])

  const [current, total] = stage

  return (
    <main className="wb-gate wb-provision">
      <div className="wb-provision-inner">
        <div className="wb-provision-emblem">
          <HiveHoneycomb running={running} className="wb-honeycomb" />
          <span className="wb-provision-halo" aria-hidden="true" />
          <HiveLogo mark="mark" className="wb-provision-mark" />
        </div>

        <h1 className="wb-gate-title wb-provision-title">{title}</h1>

        {/*
          Rotating copy is reassurance, not information — announcing every
          change would interrupt a screen reader every four seconds with text
          that carries no news. The caption below is the live region instead.
        */}
        <p className="wb-provision-message" aria-live="off" key={messageIndex}>
          {messages[messageIndex]}
        </p>

        {error ? (
          <Alert variant="danger" title={error.title} role="alert" className="wb-provision-alert">
            {error.message}
          </Alert>
        ) : (
          <>
            <Progress value={null} className="wb-provision-progress" />
            <p className="wb-provision-caption" role="status">
              {caption ?? captionFallback}
            </p>
            {steps && steps.length > 0 && (
              <ol className="wb-steps wb-provision-steps">
                {steps.map((step, index) => {
                  const isActive = index === steps.length - 1
                  return (
                    <li key={step.id} className="wb-step" data-state={isActive ? 'active' : 'done'}>
                      <span className="wb-step-marker" aria-hidden="true">
                        {isActive ? <span className="wb-step-pulse" /> : <CheckIcon size={12} />}
                      </span>
                      {step.label}
                    </li>
                  )
                })}
              </ol>
            )}
          </>
        )}

        {actions && <div className="wb-provision-actions">{actions}</div>}

        <p className="wb-provision-stage">{t('onboarding.stageLabel', current, total)}</p>
      </div>
    </main>
  )
}
