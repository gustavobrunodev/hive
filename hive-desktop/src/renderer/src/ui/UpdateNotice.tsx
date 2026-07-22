import { useCallback, useEffect, useState } from 'react'
import { Progress, Toast, ToastProvider, ToastViewport } from '@hive/design-system'
import { t } from '../i18n'
import { ArrowUpIcon, CheckIcon } from './icons'
import type { UpdateFlowState } from './updateFlow'

export type { UpdateEventIn, UpdateFlowState } from './updateFlow'

/** The subset of states `UpdateNotice` (Tier 2) ever surfaces — design.md §5.2's table. `idle`/`checking`/`upToDate` are silent by design (ND-R2.4: discovery never announces itself until there's real news); `applying` is the fleeting instant before the app quits to let the installer take over, too short-lived to deserve its own frame. */
const RENDERED_STATUSES = new Set<UpdateFlowState['status']>([
  'available',
  'downloading',
  'verifying',
  'downloaded',
  'error'
])

/**
 * A version + status fingerprint for dismissal comparison. Only `available`/
 * `downloaded` carry a `version` — `progress`/`verifying`/`error` don't (see
 * `UpdateEventIn` above, mirroring the real `UpdateEvent`), so those compare
 * by status alone. In practice "Agora não"/"Pular esta versão" only ever
 * render from the `available` state, so this only ever needs to remember
 * one thing: the exact version the user just declined. A live download that
 * starts afterwards (from this notice before being declined, or from
 * `UpdateCenter` independently) is a different fingerprint and shows anyway
 * — declining the *announcement* was never a request to hide a *download in
 * progress*.
 */
function fingerprintOf(state: UpdateFlowState): string {
  if (state.status === 'available' || state.status === 'downloaded') {
    return `${state.status}:${state.version}`
  }
  return state.status
}

/**
 * Assumed conservative throughput for the "≈ 92 MB · cerca de 1 min" duration
 * estimate (design.md §5.2) — no real speed sample exists before a download
 * starts, so this is a rough sense of scale, never a promise. Reverse-derived
 * from the design's own example (92 MB in "cerca de 1 min" implies roughly
 * 1.5 MB/s on a modest connection).
 */
const ASSUMED_MBPS = 1.5

function estimateMinutes(bytes: number): number {
  const seconds = bytes / (ASSUMED_MBPS * 1024 * 1024)
  return Math.max(1, Math.round(seconds / 60))
}

/** Reads `prefers-reduced-motion` reactively (not just once) — a JS-driven data attribute rather than a pure CSS media query, so the reduced path is exercised the same way in tests (mocking `matchMedia`) as it is for a real user (ND-R6.5). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export interface UpdateNoticeProps {
  /** The current step of the update flow — anything outside `RENDERED_STATUSES` renders nothing. */
  state: UpdateFlowState
  /** `AppInfo.version` — the version currently installed, for the "0.1.0 → 0.2.0" transition line. `null` before `app:info` resolves. */
  currentVersion: string | null
  /** `AppInfo.canApply` — whether this platform can finish the install itself (ND-C6); gates the `downloaded` state's manual-open fallback. */
  canApply: boolean
  /** "Atualizar agora" (`available`) and "Reiniciar e instalar" (`downloaded`) — both are "accept the next step" for whichever state is showing; the caller knows (from its own state) whether that means `downloadUpdate()` or `installUpdate()`. */
  onUpdateNow: () => void
  /** "Agora não" (`available`) / "Depois" (`downloaded`) — decline for now, session-scoped (ND-R5.3). */
  onNotNow: () => void
  /** "Pular esta versão" — persists the skip via `skipVersion` (ND-R5.4); the caller owns the actual IPC call. */
  onSkip: () => void
  /** "Cancelar" (`downloading`). */
  onCancel: () => void
  /** "Tentar de novo" (`error`). */
  onRetry: () => void
  /** "Abrir instalador" (`error`, and `downloaded` when `!canApply`, ND-R4.3). */
  onOpenInstaller: () => void
  /** "Ver novidades" — opens `UpdateCenter` to the release notes (`available`, when notes exist). */
  onViewNotes: () => void
}

/**
 * Tier 2 of design.md §5.1's three-tier escalation — the announcement. Built
 * from DS Toast **primitives** directly (`Toast`/`ToastProvider`/
 * `ToastViewport`), deliberately NOT `useToast()`'s imperative API (which only
 * takes a string title/description — too narrow for this card's rich,
 * morphing body). Mounts its own `ToastProvider` scope with `viewport={false}`
 * — `ToastProvider` otherwise always renders its own default (bottom-right)
 * `<ToastViewport>` internally regardless of what's passed as `children`, and
 * since it mounts *after* children in the JSX tree, that default would
 * register itself as Radix's active portal target *last*, silently stealing
 * every toast away from this component's own dedicated, bottom-left-
 * positioned `ToastViewport` (above the rail gear, `wb-update-toast-viewport`
 * in workbench.css) — found by visual validation (T15): the notice rendered
 * bottom-right instead of bottom-left until `viewport={false}` was added.
 *
 * Session-scoped dismissal (ND-R5.3) lives here, as component state
 * (`dismissedFingerprint`) — it survives the parent re-rendering with new
 * props (a plain `useState` does, as long as this component instance stays
 * mounted), but a genuinely newer version's `available` fingerprint won't
 * match, so it announces normally.
 */
export function UpdateNotice({
  state,
  currentVersion,
  canApply,
  onUpdateNow,
  onNotNow,
  onSkip,
  onCancel,
  onRetry,
  onOpenInstaller,
  onViewNotes
}: UpdateNoticeProps): React.JSX.Element {
  const [dismissedFingerprint, setDismissedFingerprint] = useState<string | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  const visible =
    RENDERED_STATUSES.has(state.status) && fingerprintOf(state) !== dismissedFingerprint

  const handleNotNow = useCallback(() => {
    setDismissedFingerprint(fingerprintOf(state))
    onNotNow()
  }, [state, onNotNow])

  const handleSkip = useCallback(() => {
    setDismissedFingerprint(fingerprintOf(state))
    onSkip()
  }, [state, onSkip])

  function renderBody(): React.JSX.Element | null {
    switch (state.status) {
      case 'available': {
        const minutes = state.bytes !== null ? estimateMinutes(state.bytes) : null
        return (
          <>
            <p className="wb-update-toast-version">
              {t('update.versionTransition', currentVersion ?? '—', state.version)}
            </p>
            {state.bytes !== null && minutes !== null && (
              <p className="wb-update-toast-meta">
                {t('update.sizeEstimate', state.bytes, minutes)}
              </p>
            )}
            {state.notes !== null && (
              <p className="wb-update-toast-notes">{t('update.notesTeaser', state.notes)}</p>
            )}
            {state.notes !== null && (
              <button type="button" className="wb-update-toast-textlink" onClick={onViewNotes}>
                {t('update.viewNotesCta')}
              </button>
            )}
            <div className="wb-update-toast-actions">
              <button
                type="button"
                className="wb-update-toast-btn wb-update-toast-btn-primary"
                onClick={onUpdateNow}
              >
                {t('update.updateNowCta')}
              </button>
              <button type="button" className="wb-update-toast-btn" onClick={handleNotNow}>
                {t('update.notNowCta')}
              </button>
            </div>
            <button type="button" className="wb-update-toast-skip" onClick={handleSkip}>
              {t('update.skipVersionCta')}
            </button>
          </>
        )
      }
      case 'downloading':
        return (
          <>
            <p className="wb-update-toast-meta wb-update-toast-progress-label">
              {t('update.downloadProgress', state.transferred, state.total, state.percent)}
            </p>
            <Progress value={state.percent} aria-label={t('update.downloadProgressAria')} />
            <div className="wb-update-toast-actions">
              <button type="button" className="wb-update-toast-btn" onClick={onCancel}>
                {t('update.cancelCta')}
              </button>
            </div>
          </>
        )
      case 'verifying':
        return (
          <>
            <p className="wb-update-toast-meta">{t('update.verifyingLabel')}</p>
            <Progress value={100} aria-label={t('update.verifyingLabel')} />
          </>
        )
      case 'downloaded':
        return (
          <>
            <p className="wb-update-toast-version" data-tone="ok">
              <CheckIcon size={13} />
              {t('update.readyTitle')}
            </p>
            <p className="wb-update-toast-meta">
              {canApply ? t('update.readyBody') : t('update.readyManualBody')}
            </p>
            <div className="wb-update-toast-actions">
              {canApply ? (
                <button
                  type="button"
                  className="wb-update-toast-btn wb-update-toast-btn-primary"
                  onClick={onUpdateNow}
                >
                  {t('update.restartCta')}
                </button>
              ) : (
                <button
                  type="button"
                  className="wb-update-toast-btn wb-update-toast-btn-primary"
                  onClick={onOpenInstaller}
                >
                  {t('update.openInstallerCta')}
                </button>
              )}
              <button type="button" className="wb-update-toast-btn" onClick={handleNotNow}>
                {t('update.laterCta')}
              </button>
            </div>
          </>
        )
      case 'error':
        return (
          <>
            {/* A background tint, never a stripe (design.md §5.2) — and `role="status"`
                on the shared body wrapper below is enough of a live-region cue; an
                inner `alert` would double-announce and reads more alarming than
                ND-R6.7's "invitation, never a warning" register wants. */}
            <p className="wb-update-toast-error">
              {state.kind === 'integrity' ? t('update.errorIntegrity') : t('update.errorGeneric')}
            </p>
            <div className="wb-update-toast-actions">
              <button
                type="button"
                className="wb-update-toast-btn wb-update-toast-btn-primary"
                onClick={onRetry}
              >
                {t('update.retryCta')}
              </button>
              <button type="button" className="wb-update-toast-btn" onClick={onOpenInstaller}>
                {t('update.openInstallerCta')}
              </button>
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <ToastProvider duration={Infinity} swipeDirection="left" viewport={false}>
      <Toast
        open={visible}
        onOpenChange={(open) => {
          if (!open) handleNotNow()
        }}
        duration={Infinity}
        className="wb-update-toast"
        data-reduced-motion={reducedMotion || undefined}
      >
        <div className="wb-update-toast-header">
          <ArrowUpIcon size={14} className="wb-update-toast-glyph" />
          <span className="wb-update-toast-title">{t('update.noticeTitle')}</span>
        </div>
        <div className="wb-update-toast-body" role="status">
          {renderBody()}
        </div>
      </Toast>
      <ToastViewport className="wb-update-toast-viewport" label={t('update.viewportLabel')} />
    </ToastProvider>
  )
}
