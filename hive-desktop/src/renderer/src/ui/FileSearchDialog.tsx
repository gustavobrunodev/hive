import { useEffect, useState } from 'react'
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from '@hive/design-system'
import { t } from '../i18n'
import { FileTypeIcon } from './fileIcons'

interface FileSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absolute path of the active workspace — the search space. */
  workspace: string
  /** Opens the picked file in the editor pane (workspace-relative path). */
  onOpenFile: (path: string) => void
}

/** Last path segment / everything before it — the row shows name over its folder. */
function splitPath(path: string): { name: string; dir: string | null } {
  const slash = path.lastIndexOf('/')
  return slash === -1
    ? { name: path, dir: null }
    : { name: path.slice(slash + 1), dir: path.slice(0, slash) }
}

/**
 * Workspace file search — a Ctrl+P quick-open palette (the VS Code muscle
 * memory PRODUCT.md's "OS-grade file management" principle asks for), living
 * where the rail's role shortcuts used to be. Reuses the DS `CommandDialog`
 * (cmdk fuzzy filter + Dialog focus trap) over the same flat file list that
 * feeds the composer's `#` mentions; picking a row opens the file in the
 * editor pane.
 */
export function FileSearchDialog({
  open,
  onOpenChange,
  workspace,
  onOpenFile
}: FileSearchDialogProps): React.JSX.Element {
  const [files, setFiles] = useState<string[]>([])

  // Fresh list on every open — agents create artifacts constantly, and the
  // palette must see them without a reload.
  useEffect(() => {
    if (!open) return
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
  }, [open, workspace])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      label={t('fileSearch.dialogLabel')}
      className="wb-filesearch"
    >
      <CommandInput placeholder={t('fileSearch.placeholder')} />
      <CommandList>
        <CommandEmpty>{t('fileSearch.empty')}</CommandEmpty>
        {files.map((path) => {
          const { name, dir } = splitPath(path)
          return (
            <CommandItem
              key={path}
              value={path}
              onSelect={() => {
                onOpenFile(path)
                onOpenChange(false)
              }}
              aria-label={t('fileSearch.openAria', path)}
            >
              <span className="wb-filesearch-icon" aria-hidden="true">
                <FileTypeIcon path={path} size={15} />
              </span>
              <span className="wb-filesearch-text">
                <span className="wb-filesearch-name">{name}</span>
                {dir !== null && <span className="wb-filesearch-dir">{dir}</span>}
              </span>
            </CommandItem>
          )
        })}
      </CommandList>
      <p className="wb-filesearch-hint" aria-hidden="true">
        {t('fileSearch.hint')}
      </p>
    </CommandDialog>
  )
}
