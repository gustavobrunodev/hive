import { useState, type KeyboardEvent } from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Textarea
} from '@hive/design-system'
import { t } from '../i18n'
import { ChevronDownIcon } from '../ui/icons'
import { changeCount, groupChanges } from './gitStatus'
import { useGit } from './useGit'

/**
 * The inline commit box (GIT-R5) — a multi-line message + a primary split
 * button (design.md §5.2). Behavior mirrors VS Code:
 *  - empty message → disabled with a reason;
 *  - staged changes → "Commit";
 *  - nothing staged but the tree is dirty → "Preparar tudo e commitar"
 *    (stage-all + commit, GIT-R5.3), not a silent failure;
 *  - the ▾ menu offers amend (pre-filling the last message, GIT-R5.4) and an
 *    explicit stage-all & commit;
 *  - Ctrl/Cmd+Enter commits.
 * Reads/acts entirely through the shared `useGit` store.
 */
export function CommitBox(): React.JSX.Element {
  const git = useGit()
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)

  const groups = groupChanges(git.status)
  const hasStaged = groups.staged.length > 0
  const hasChanges = changeCount(git.status) > 0
  const trimmed = message.trim()

  // Resolve the primary button's label + whether it stages-all + why it's disabled.
  let label: string = t('git.commit')
  let stageAll = false
  let disabledReason: string | null = null
  if (!trimmed) {
    disabledReason = t('git.commitDisabledEmpty')
  } else if (amend) {
    label = t('git.commitAmend')
  } else if (hasStaged) {
    label = t('git.commit')
  } else if (hasChanges) {
    label = t('git.commitStageAll')
    stageAll = true
  } else {
    disabledReason = t('git.commitDisabledNothing')
  }
  const disabled = disabledReason !== null

  function reset(): void {
    setMessage('')
    setAmend(false)
  }

  function doCommit(): void {
    if (disabled) return
    void git.commit(trimmed, { amend, stageAll })
    reset()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      doCommit()
    }
  }

  async function enableAmend(): Promise<void> {
    setAmend(true)
    // Pre-fill the previous commit's subject when the box is empty (GIT-R5.4).
    if (message === '') {
      const log = await window.hive?.git?.log(git.workspace, { limit: 1 })
      if (log && log[0]) setMessage(log[0].subject)
    }
  }

  function stageAllAndCommit(): void {
    if (!trimmed) return
    void git.commit(trimmed, { stageAll: true })
    reset()
  }

  return (
    <div className="wb-commit">
      <Textarea
        className="wb-commit-input"
        placeholder={t('git.commitPlaceholder')}
        aria-label={t('git.commitPlaceholder')}
        value={message}
        minRows={2}
        data-amend={amend ? 'true' : undefined}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="wb-commit-actions">
        <Button
          className="wb-btn hds-btn-primary wb-commit-btn"
          disabled={disabled}
          title={disabledReason ?? label}
          onClick={doCommit}
        >
          {label}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="wb-btn hds-btn-primary wb-commit-caret"
              aria-label={t('git.commitMenuLabel')}
            >
              <ChevronDownIcon size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* `indicator="trailing"`, not the default leading gutter. A
                CheckboxItem reserves 20px on its left for the check, and the
                plain item below it does not — so in a two-row menu the amend
                row started a fifth of an inch to the right of its neighbour and
                read as a rendering mistake. Moving the mark to the far edge is
                what puts both labels on one left edge, and it costs nothing
                here: there is a single checkable row, so there is no column of
                marks for the eye to scan down. */}
            <DropdownMenuCheckboxItem
              indicator="trailing"
              checked={amend}
              onCheckedChange={(next: boolean) => (next ? void enableAmend() : setAmend(false))}
            >
              {t('git.amendToggle')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem onSelect={stageAllAndCommit}>
              {t('git.stageAllAndCommit')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
