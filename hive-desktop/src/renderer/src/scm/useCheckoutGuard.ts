import { useCallback, useState } from 'react'
import type { EditorTabsState } from '../ui/useEditorTabs'

/** The three-way unsaved-work guard state for a branch checkout (GIT-R6.3). */
export interface CheckoutGuard {
  /** The ref parked behind the guard, or `null` when no dialog is open. */
  pending: string | null
  /** Requests a checkout — parks behind the guard when there are dirty drafts, else runs it. */
  request: (ref: string) => void
  /** Dismisses the guard, abandoning the checkout. */
  cancel: () => void
  /** Discards drafts and checks out. */
  discard: () => void
  /** Saves every dirty draft first, then checks out only if all saves landed. */
  save: () => void
}

/**
 * A branch checkout guarded by the same three-way unsaved-work dialog the
 * workspace switch uses (git-management GIT-R6.3). Extracted from `WorkUI` so
 * the guard's branching lives in one focused, fully-tested unit rather than
 * inflating `WorkUI`'s complexity. `checkout` is the store action that actually
 * switches (git's own dirty-tree refusal, if any, surfaces from there).
 */
export function useCheckoutGuard(
  editor: Pick<EditorTabsState, 'dirtyPaths' | 'saveAllDirty'>,
  checkout: (ref: string) => void
): CheckoutGuard {
  const [pending, setPending] = useState<string | null>(null)

  const request = useCallback(
    (ref: string) => {
      if (editor.dirtyPaths.size > 0) setPending(ref)
      else checkout(ref)
    },
    [editor.dirtyPaths, checkout]
  )
  const cancel = useCallback(() => setPending(null), [])
  const discard = useCallback(() => {
    const ref = pending as string
    setPending(null)
    checkout(ref)
  }, [pending, checkout])
  const save = useCallback(() => {
    const ref = pending as string
    setPending(null)
    void editor.saveAllDirty().then((ok) => {
      if (ok) checkout(ref)
    })
  }, [pending, editor, checkout])

  return { pending, request, cancel, discard, save }
}
