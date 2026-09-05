import * as React from "react"
import { cx } from "../../utils/cx"
import "./StepFlow.css"

/** Where one step of a flow currently stands. */
export type StepStatus = "pending" | "active" | "done" | "failed"

export interface StepFlowStep {
  /** Stable identity — also the React key. */
  id: string
  label: React.ReactNode
  /** One line under the label: what is happening, or what the user must do. */
  hint?: React.ReactNode
  status: StepStatus
}

export interface StepFlowProps extends Omit<React.ComponentPropsWithoutRef<"ol">, "children"> {
  steps: StepFlowStep[]
  /** Accessible name for the flow as a whole. Required: an unnamed list of dots says nothing. */
  label: string
  /** `vertical` (default) reads as a checklist; `horizontal` as a wizard rail. */
  orientation?: "vertical" | "horizontal"
  /**
   * Spoken status words, appended to each step's accessible name.
   *
   * The visual states are colour and shape, which is exactly the information a
   * screen reader gets nothing of — so each step says its own status in words.
   * Overridable because the design system carries no locale of its own beyond
   * these defaults.
   */
  statusLabels?: Record<StepStatus, string>
}

const DEFAULT_STATUS_LABELS: Record<StepStatus, string> = {
  pending: "pendente",
  active: "em andamento",
  done: "concluído",
  failed: "falhou"
}

/** The mark inside a node: a check when done, a cross when failed, nothing otherwise. */
function StepMark({ status }: { status: StepStatus }): React.JSX.Element | null {
  if (status === "done") {
    return (
      <svg viewBox="0 0 12 12" className="hds-stepflow-glyph" aria-hidden="true">
        <path
          d="M2.5 6.2 4.9 8.6 9.5 3.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (status === "failed") {
    return (
      <svg viewBox="0 0 12 12" className="hds-stepflow-glyph" aria-hidden="true">
        <path
          d="M3.6 3.6 8.4 8.4M8.4 3.6 3.6 8.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return null
}

/**
 * A flow of steps that knows where it is.
 *
 * `SteppedList` numbers instructions; this one **reports progress**. The
 * difference is the whole point: an interface that hands a task to something
 * outside itself — a browser sign-in, an install, an upload — has to say which
 * part is finished, which part is happening now, and which part hasn't started,
 * or the user is left watching a spinner and guessing whether it is their turn
 * to act.
 *
 * Four states, and each one is carried by shape as well as colour (a filled
 * check, a breathing ring, a hollow dot, a cross) so the flow survives both a
 * colour-blind reader and a screen reader — `statusLabels` puts the same
 * information into the accessible name.
 *
 * The connector between nodes is filled behind every step that is done, which
 * makes the amount of progress readable at a glance, before any label is read.
 */
export const StepFlow = React.forwardRef<HTMLOListElement, StepFlowProps>(function StepFlow(
  { steps, label, orientation = "vertical", statusLabels, className, ...rest },
  ref
) {
  const words = { ...DEFAULT_STATUS_LABELS, ...statusLabels }
  return (
    <ol
      ref={ref}
      className={cx("hds-stepflow", className)}
      data-orientation={orientation}
      aria-label={label}
      {...rest}
    >
      {steps.map((step, index) => {
        const previous = steps[index - 1]
        return (
          <li
            key={step.id}
            className="hds-stepflow-step"
            data-status={step.status}
            // The wire *into* this step is lit by the step above it, so a flow
            // half-done reads as half-lit rather than as a run of loose dots.
            data-lit={previous?.status === "done" || undefined}
            {...(step.status === "active" ? { "aria-current": "step" as const } : {})}
          >
            <span className="hds-stepflow-rail" aria-hidden="true">
              <span className="hds-stepflow-node">
                <StepMark status={step.status} />
              </span>
            </span>
            <span className="hds-stepflow-body">
              <span className="hds-stepflow-label">
                {step.label}
                <span className="hds-stepflow-status">{`, ${words[step.status]}`}</span>
              </span>
              {step.hint !== undefined && step.hint !== null && (
                <span className="hds-stepflow-hint">{step.hint}</span>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
})

StepFlow.displayName = "StepFlow"
