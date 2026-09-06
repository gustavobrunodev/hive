import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { insertMention, mentionQueryAt, openMentionAt, rankMentionFiles } from './composerMentions'

export interface MentionsApi {
  /** Every workspace file path, as a set — the validity oracle for `@` tokens. */
  fileSet: ReadonlySet<string>
  /** The mention menu should be on screen. */
  open: boolean
  /** Ranked matches for the open token's query — a page of at most 8. */
  items: string[]
  /** How many files matched in all, so the menu can say when `items` is a page of more. */
  total: number
  /** The open token's query text, for the menu's match highlighting and empty state. */
  query: string
  highlight: number
  setHighlight: (updater: (h: number) => number) => void
  dismiss: () => void
  /** Inserts `items[index]` over the open token and restores focus/caret. */
  select: (index: number) => void
  /**
   * Types an `@` at the caret and opens the menu — the button route to the
   * picker, for a user who never learns the sigil. Same end state as pressing
   * the key, so there is one mention flow and not two.
   */
  trigger: () => void
  /** Re-reads the caret from the textarea (wire to keyup/click/change). */
  syncCaret: () => void
  /** Any edit re-arms the menu and resets the highlight (same contract as the slash menu). */
  onValueEdited: () => void
}

/**
 * The composer's `@` workspace-file mention state (chat-attachments):
 * loads the workspace file list, tracks the caret to detect an open `@`
 * token, ranks matches, and performs the insertion. Extracted from `Chat`
 * as a hook (complexity budget); `composerMentions.ts` owns the pure rules.
 */
export function useMentions(
  workspace: string,
  value: string,
  setValue: (next: string) => void,
  textareaRef: RefObject<HTMLTextAreaElement | null>
): MentionsApi {
  const [files, setFiles] = useState<string[]>([])
  const [caret, setCaret] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [highlight, setHighlightState] = useState(0)
  // Where the caret must land after a mention insertion re-renders the value.
  const pendingCaretRef = useRef<number | null>(null)

  const reloadFiles = useCallback(() => {
    let cancelled = false
    window.hive
      .listFiles(workspace)
      .then((list) => {
        if (!cancelled) setFiles(list)
      })
      .catch(() => {
        if (!cancelled) setFiles([])
      })
    return () => {
      cancelled = true
    }
  }, [workspace])

  useEffect(() => reloadFiles(), [reloadFiles])

  const fileSet = useMemo(() => new Set(files), [files])

  const mention = mentionQueryAt(value, Math.min(caret, value.length))
  const open = mention !== null && !dismissed
  // No memo: ranking a few thousand paths is microseconds, and the composer
  // re-renders per keystroke anyway.
  const matches = open ? rankMentionFiles(files, mention.query) : { items: [], total: 0 }

  // A `@` token just opened the menu: refresh the file list so it reflects
  // artifacts the agent may have produced since the last load (cheap one-shot
  // IPC; no live watcher needed for a picker).
  useEffect(() => {
    if (open) return reloadFiles()
    return undefined
  }, [open, reloadFiles])

  const syncCaret = useCallback(() => {
    const node = textareaRef.current
    if (node) setCaret(node.selectionStart ?? node.value.length)
  }, [textareaRef])

  const onValueEdited = useCallback(() => {
    setDismissed(false)
    setHighlightState(0)
    syncCaret()
  }, [syncCaret])

  const dismiss = useCallback(() => setDismissed(true), [])

  const setHighlight = useCallback((updater: (h: number) => number) => {
    setHighlightState(updater)
  }, [])

  const select = useCallback(
    (index: number) => {
      const path = matches.items[index]
      if (path === undefined || mention === null) return
      const next = insertMention(value, mention, Math.min(caret, value.length), path)
      pendingCaretRef.current = next.caret
      setValue(next.value)
      setHighlightState(0)
    },
    [matches.items, mention, value, caret, setValue]
  )

  const trigger = useCallback(() => {
    const node = textareaRef.current
    const at = node ? (node.selectionStart ?? node.value.length) : value.length
    const next = openMentionAt(value, at)
    // The same three moves a keystroke makes: the caret lands after the sigil
    // (the effect below applies it), a menu the user had dismissed is re-armed,
    // and the highlight goes back to the top of the list.
    pendingCaretRef.current = next.caret
    setDismissed(false)
    setHighlightState(0)
    setValue(next.value)
  }, [value, setValue, textareaRef])

  // Apply the post-insertion caret once the new value has rendered.
  useEffect(() => {
    const target = pendingCaretRef.current
    if (target === null) return
    pendingCaretRef.current = null
    const node = textareaRef.current
    if (node) {
      node.focus()
      node.setSelectionRange(target, target)
    }
    setCaret(target)
  }, [value, textareaRef])

  return {
    fileSet,
    open,
    items: matches.items,
    total: matches.total,
    query: mention?.query ?? '',
    highlight,
    setHighlight,
    dismiss,
    select,
    trigger,
    syncCaret,
    onValueEdited
  }
}
