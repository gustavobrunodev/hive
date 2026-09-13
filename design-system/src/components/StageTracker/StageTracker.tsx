import * as React from "react"
import { cx } from "../../utils/cx"
import "./StageTracker.css"

/** Where one stage of a plan currently stands. */
export type StageStatus = "done" | "active" | "pending"

export interface StageTrackerStage {
  /** Stable identity — also the React key and what `onSelect` reports. */
  id: string
  label: React.ReactNode
  /** One line under the label: the artifact this stage produces, or what it needs. */
  hint?: React.ReactNode
  status: StageStatus
  /** Nothing to run yet — the row stays a row, and says why through `hint`. */
  disabled?: boolean
  /**
   * Which `groups` entry this stage belongs to. Ignored when `groups` is absent;
   * a stage naming a group that was not declared does not draw at all, rather
   * than being quietly swept into a chapter it does not belong to.
   */
  group?: string
  /**
   * A short qualifier beside the label — "Opcional", "Beta".
   *
   * Folded into the row's accessible name when it is a string, because a badge
   * that only exists as a visual chip is information the screen reader never
   * gets — and "this one you may skip" is exactly the kind of thing a user
   * needs before they commit to a run.
   */
  badge?: React.ReactNode
  /**
   * Inline affordance at the end of the row, **inside** the activation target.
   *
   * The row is a button, and at rest a row of text with a dot beside it does
   * not look like one. This is where the verb goes — a play glyph, a "Iniciar"
   * pill — so the thing that can be clicked says so without being hovered.
   * Decorative by construction (`aria-hidden`): the row's own name already
   * carries the promise for a screen reader.
   */
  cue?: React.ReactNode
  /**
   * Right-hand slot, outside the row's own activation.
   *
   * A stage that already produced something has two different verbs — "run it
   * again" and "show me what it made" — and folding both into one click makes
   * the more destructive of the two the accidental one.
   */
  trailing?: React.ReactNode
}

/**
 * A named chapter of the plan — BMAD's phases, a release's milestones.
 *
 * Groups are declared separately from stages (rather than inferred from a field
 * on the first stage that mentions them) so an empty phase still draws: a plan
 * whose chapters appear and disappear as their contents fill in is a plan you
 * cannot learn the shape of.
 */
export interface StageTrackerGroup {
  id: string
  label: React.ReactNode
  /** Right-hand slot on the header — typically how many of its stages are done. */
  meta?: React.ReactNode
}

// `HTMLAttributes<HTMLElement>` rather than one concrete tag's props: the root
// is an `<ol>` when the plan is flat and a `<div>` of sections when it has
// chapters, and pinning the handlers to either one makes them unspreadable onto
// the other.
export interface StageTrackerProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children" | "onSelect"> {
  stages: StageTrackerStage[]
  /**
   * Splits the plan into named chapters, in this order. Stages are matched to
   * them by their own `group`; without this prop the tracker is one flat list,
   * exactly as before.
   */
  groups?: StageTrackerGroup[]
  /** Accessible name for the plan as a whole. Required: an unnamed column of dots says nothing. */
  label: string
  /** Runs a stage. Rows are only buttons when this is given — without it the tracker is a read-only report. */
  onSelect?: (id: string) => void
  /**
   * The verb each row promises, by status.
   *
   * A row whose name never changes teaches nobody that a finished stage can be
   * run again, and "Executar" over something already done reads as a mistake.
   */
  actionLabels?: Partial<Record<StageStatus, (label: string) => string>>
  /**
   * Spoken status words, appended to each row's accessible name.
   *
   * The visual states are colour and shape, which is exactly what a screen
   * reader gets none of.
   */
  statusLabels?: Record<StageStatus, string>
}

const DEFAULT_STATUS_LABELS: Record<StageStatus, string> = {
  done: "concluída",
  active: "próxima",
  pending: "pendente"
}

/** The mark inside a node: a check when done, the ordinal otherwise. */
function StageMark({
  status,
  ordinal
}: {
  status: StageStatus
  ordinal: number
}): React.JSX.Element {
  if (status === "done") {
    return (
      <svg viewBox="0 0 12 12" className="hds-stage-glyph" aria-hidden="true">
        <path
          d="M2.5 6.2 4.9 8.6 9.5 3.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return <span className="hds-stage-ordinal">{ordinal}</span>
}

/**
 * A plan that knows where it is — and lets you act on it.
 *
 * `StepFlow` reports a flow the interface is driving on the user's behalf: it
 * is a status display, and every one of its steps is inert by construction.
 * This is the other half of that idea. Here the stages are the user's to run,
 * in an order the tracker only *suggests*: what is finished, what comes next,
 * and what is still ahead — with the next one a single click away and the ones
 * behind it still reachable, because "you skipped a step" and "you want to redo
 * one" are both ordinary and neither is an error.
 *
 * Three states, each carried by shape as well as colour (a filled check, a
 * ringed ordinal, a quiet outline) so the column survives a colour-blind reader,
 * with `statusLabels` putting the same information into the accessible name.
 * The wire between nodes is lit behind everything done, which makes the amount
 * of progress readable before a single label is.
 *
 * Pass `groups` and the same plan reads as chapters: one wire per phase, a
 * header that can carry the phase's own tally, and ordinals that keep counting
 * across the breaks — because the phases are a way of reading the flow, not
 * four separate flows.
 */
export const StageTracker = React.forwardRef<HTMLElement, StageTrackerProps>(
  function StageTracker(
    { stages, groups, label, onSelect, actionLabels, statusLabels, className, ...rest },
    ref
  ) {
    const words = { ...DEFAULT_STATUS_LABELS, ...statusLabels }
    // The ordinal is the stage's place in the whole plan, resolved before any
    // grouping: a phase that starts at "5" is telling the truth about where its
    // first step falls, and restarting each chapter at 1 would turn one
    // eight-step flow into four little ones.
    const ordinals = new Map(stages.map((stage, index) => [stage.id, index + 1]))

    function renderRows(rows: StageTrackerStage[]): React.JSX.Element[] {
      return rows.map((stage, index) => {
        const previous = rows[index - 1]
        const interactive = onSelect !== undefined && stage.disabled !== true
        const verb = actionLabels?.[stage.status]
        const named = verb !== undefined && typeof stage.label === "string"
        const name = named
          ? typeof stage.badge === "string"
            ? `${verb(stage.label as string)}, ${stage.badge}`
            : verb(stage.label as string)
          : undefined
        return (
          <li
            key={stage.id}
            className="hds-stage"
            data-status={stage.status}
            // The wire *into* a row is lit by the row above it, so a plan
            // half-done reads as half-lit rather than as a run of loose dots.
            data-lit={previous?.status === "done" || undefined}
            {...(stage.status === "active" ? { "aria-current": "step" as const } : {})}
          >
            <RowTag
              interactive={interactive}
              onSelect={onSelect === undefined ? undefined : () => onSelect(stage.id)}
              name={name}
            >
              <span className="hds-stage-rail" aria-hidden="true">
                <span className="hds-stage-node">
                  <StageMark status={stage.status} ordinal={ordinals.get(stage.id) ?? index + 1} />
                </span>
              </span>
              <span className="hds-stage-body">
                <span className="hds-stage-label">
                  <span className="hds-stage-name">{stage.label}</span>
                  {stage.badge !== undefined && stage.badge !== null && (
                    <span className="hds-stage-badge">{stage.badge}</span>
                  )}
                  <span className="hds-stage-status">{`, ${words[stage.status]}`}</span>
                </span>
                {stage.hint !== undefined && stage.hint !== null && (
                  <span className="hds-stage-hint">{stage.hint}</span>
                )}
              </span>
              {stage.cue !== undefined && stage.cue !== null && (
                <span className="hds-stage-cue" aria-hidden="true">
                  {stage.cue}
                </span>
              )}
            </RowTag>
            {stage.trailing !== undefined && stage.trailing !== null && (
              <span className="hds-stage-trailing">{stage.trailing}</span>
            )}
          </li>
        )
      })
    }

    if (groups === undefined || groups.length === 0) {
      return (
        <ol
          ref={ref as React.Ref<HTMLOListElement>}
          className={cx("hds-stages", className)}
          aria-label={label}
          {...rest}
        >
          {renderRows(stages)}
        </ol>
      )
    }

    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        role="group"
        aria-label={label}
        className={cx("hds-stages-grouped", className)}
        {...rest}
      >
        {groups.map((group) => (
          <section key={group.id} className="hds-stage-group">
            <p className="hds-stage-group-head" id={`hds-stage-group-${group.id}`}>
              <span className="hds-stage-group-label">{group.label}</span>
              {group.meta !== undefined && group.meta !== null && (
                <span className="hds-stage-group-meta">{group.meta}</span>
              )}
            </p>
            <ol className="hds-stages" aria-labelledby={`hds-stage-group-${group.id}`}>
              {renderRows(stages.filter((stage) => stage.group === group.id))}
            </ol>
          </section>
        ))}
      </div>
    )
  }
)

StageTracker.displayName = "StageTracker"

/** The row itself — a button where there is something to run, a plain span where there is not. */
function RowTag({
  interactive,
  onSelect,
  name,
  children
}: {
  interactive: boolean
  onSelect?: () => void
  name?: string
  children: React.ReactNode
}): React.JSX.Element {
  if (!interactive) {
    return <span className="hds-stage-row">{children}</span>
  }
  return (
    <button type="button" className="hds-stage-row" aria-label={name} onClick={onSelect}>
      {children}
    </button>
  )
}
