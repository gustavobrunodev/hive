import type { EnginePhaseView } from './enginePhase'

/**
 * What the local engine is doing, while it is doing it.
 *
 * The determinate/indeterminate split is the whole point. Model download and
 * file loading have real totals, so they get a real bar. Building the ONNX
 * session and running inference do not report anything at all — and the
 * previous UI papered over that by leaving the last known percentage on screen,
 * which is how "Preparando o modelo… 100%" came to sit there while the app
 * still had a minute of work left. An indeterminate bar says "working, no
 * estimate", which is both true and legible.
 */
export function EngineProgress({ view }: { view: EnginePhaseView }): React.JSX.Element {
  const indeterminate = view.pct === null
  return (
    <div className="wb-brain-progress" data-phase={view.kind}>
      <div className="wb-brain-progress-head" aria-live="polite">
        <span className="wb-brain-progress-label">{view.label}</span>
        {!indeterminate && <span className="wb-brain-progress-pct">{view.pct}%</span>}
      </div>
      <div
        className="wb-brain-progress-track"
        role="progressbar"
        aria-label={view.label}
        // ARIA's own convention for "unknown": omit `aria-valuenow` entirely.
        aria-valuenow={indeterminate ? undefined : (view.pct ?? undefined)}
        aria-valuemin={indeterminate ? undefined : 0}
        aria-valuemax={indeterminate ? undefined : 100}
      >
        <span
          className="wb-brain-progress-fill"
          data-indeterminate={indeterminate || undefined}
          style={indeterminate ? undefined : { width: `${view.pct}%` }}
        />
      </div>
      {view.hint !== undefined && <p className="wb-brain-progress-hint">{view.hint}</p>}
    </div>
  )
}
