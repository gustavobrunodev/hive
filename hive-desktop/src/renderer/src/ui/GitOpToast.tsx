import { Toast, ToastProvider, ToastViewport } from '@hive/design-system'
import { t } from '../i18n'
import type { GitOpResult } from '../scm/useGitRemote'
import { AlertTriangleIcon, CheckCircleIcon, CloseIcon } from './icons'

interface GitOpToastProps {
  result: GitOpResult | null
  onClose: () => void
}

/**
 * Toasts the outcome of a git remote op (GIT-R7.6). A success auto-dismisses;
 * an error stays until dismissed and offers a "Detalhes" disclosure with git's
 * verbatim stderr (G3 — truthful, never swallowed). Mounts its own
 * `ToastProvider` scope with a bottom-right viewport, mirroring `UpdateNotice`.
 */
export function GitOpToast({ result, onClose }: GitOpToastProps): React.JSX.Element {
  const isError = result?.type === 'error'
  return (
    <ToastProvider duration={isError ? Infinity : 4000} swipeDirection="right" viewport={false}>
      <Toast
        open={result !== null}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        duration={isError ? Infinity : 4000}
        className="wb-git-toast"
        data-kind={result?.type}
      >
        <div className="wb-git-toast-row">
          <span className="wb-git-toast-glyph" aria-hidden="true">
            {isError ? <AlertTriangleIcon size={15} /> : <CheckCircleIcon size={15} />}
          </span>
          <span className="wb-git-toast-title">{result?.message}</span>
          <button
            type="button"
            className="wb-git-toast-close"
            aria-label={t('git.opToastClose')}
            onClick={onClose}
          >
            <CloseIcon size={13} />
          </button>
        </div>
        {isError && result?.detail && (
          <details className="wb-git-toast-details">
            <summary>{t('git.opDetails')}</summary>
            <pre className="wb-git-toast-stderr">{result.detail}</pre>
          </details>
        )}
      </Toast>
      <ToastViewport className="wb-git-toast-viewport" label={t('git.opToastLabel')} />
    </ToastProvider>
  )
}
