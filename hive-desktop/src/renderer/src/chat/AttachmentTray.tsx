import React from 'react'
import { Attachment } from '@hive/design-system'
import { HistoryIcon, PaperclipIcon } from '../ui/icons'
import { FileTypeIcon } from '../ui/fileIcons'
import { t } from '../i18n'
import { formatFileSize } from './composerMentions'
import type { AttachmentEntry } from './useAttachments'

/** Parent-folder line for a workspace chip; `undefined` for a root-level file. */
function parentDirOf(path: string): string | undefined {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? undefined : path.slice(0, slash)
}

/**
 * How many files are staged and, when every one has a known size, how much they
 * weigh. Workspace chips carry no size (they are tree rows, not picked files),
 * so a mixed tray reports the count alone rather than a total that silently
 * omits half the list.
 */
function attachmentSummary(items: readonly AttachmentEntry[]): string {
  const count = t('chat.attachmentTrayCount', items.length)
  const total = items.reduce((sum, entry) => sum + entry.size, 0)
  return items.every((entry) => entry.size > 0) && total > 0
    ? `${count} · ${formatFileSize(total)}`
    : count
}

export interface AttachmentTrayProps {
  items: readonly AttachmentEntry[]
  onRemove: (index: number) => void
  onClear: () => void
  /**
   * A draft this conversation had parked has just been handed back — `null`
   * whenever the user filled the composer themselves. Keyed by `at` so
   * returning twice re-plays the notice instead of leaving a stale one.
   */
  restored: { at: number } | null
}

/**
 * The composer's staged files.
 *
 * Attachments are part of a *draft*, and a draft belongs to the conversation it
 * was written for (`composerDraft.ts`). This is where that becomes visible:
 *
 * - **The summary** is the fact a user checks before pressing Enter — how many
 *   files are going and how heavy they are. With one file it is noise, so it
 *   only appears from two upward, and `Limpar` with it: five attachments you
 *   can only dismantle one chip at a time is the state this replaces.
 * - **The restore notice** explains a composer that arrived full. Files
 *   reappearing with no explanation look exactly like the leak this feature
 *   closes, so the tray names what happened and then gets out of the way.
 * - **The chips** truncate in the middle, because the extension is the most
 *   informative token in a file name and end-ellipsis eats it first, and carry
 *   the full path as a title — a basename cannot tell two `README.md`s apart,
 *   and picking the wrong one is the mistake this whole surface is about.
 */
export function AttachmentTray({
  items,
  onRemove,
  onClear,
  restored
}: AttachmentTrayProps): React.JSX.Element | null {
  // Self-deciding: nothing staged and nothing to announce renders nothing at
  // all, so `Chat` hands `PromptInput` this component unconditionally instead
  // of carrying the "is there anything to show" branch at the call site.
  // `PromptInput`'s slot hides itself when empty.
  if (items.length === 0 && restored === null) return null
  const head = items.length > 1 || restored !== null
  return (
    <div className="wb-attach-tray">
      {head && (
        <div className="wb-attach-tray-head">
          {items.length > 0 && (
            <span className="wb-attach-tray-summary">
              <PaperclipIcon size={12} aria-hidden="true" />
              {attachmentSummary(items)}
            </span>
          )}
          {restored !== null && (
            <span
              key={restored.at}
              className="wb-attach-restored"
              role="status"
              data-testid="draft-restored"
            >
              <HistoryIcon size={12} aria-hidden="true" />
              {t('chat.draftRestored')}
            </span>
          )}
          {items.length > 1 && (
            <button
              type="button"
              className="wb-attach-clear"
              onClick={onClear}
              title={t('chat.attachmentClearTitle')}
            >
              {t('chat.attachmentClear')}
            </button>
          )}
        </div>
      )}
      {items.length > 0 && (
        <div className="wb-attach-tray-chips">
          {items.map((entry, index) => (
            <Attachment
              key={entry.path}
              className="wb-composer-chip"
              name={entry.name}
              truncate="middle"
              title={entry.path}
              meta={
                entry.kind === 'workspace' ? parentDirOf(entry.path) : formatFileSize(entry.size)
              }
              data-kind={entry.kind}
              icon={<FileTypeIcon path={entry.path} size={14} />}
              onRemove={() => onRemove(index)}
              removeLabel={t('chat.attachmentRemoveAria', entry.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
