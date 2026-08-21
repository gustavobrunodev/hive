import { useEffect, useState } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@hive/design-system'
import { t } from '../i18n'
import { FileTypeIcon } from './fileIcons'
import { LayersIcon } from './icons'

/** Keeps a Studio row's cmdk value unique against the file row for the same path. */
const STUDIO_VALUE_SUFFIX = 'design studio'

interface FileSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absolute path of the active workspace — the search space. */
  workspace: string
  /** Opens the picked file in the editor pane (workspace-relative path). */
  onOpenFile: (path: string) => void
  /**
   * design-studio (DS-R1 AC-1): the palette's second way into the Studio —
   * a group listing the workspace's Markdown Specs. Omitted when absent, so
   * the palette still works for callers that don't wire the Studio.
   */
  onOpenDesignStudio?: (path: string) => void
}

/** design-studio DS-R1: the Studio's input is a Markdown Spec. */
function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith('.md')
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
 * feeds the composer's `@` mentions; picking a row opens the file in the
 * editor pane.
 */
export function FileSearchDialog({
  open,
  onOpenChange,
  workspace,
  onOpenFile,
  onOpenDesignStudio
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
        {/* design-studio (DS-R1 AC-1). A second group rather than a second
            action on each row: the palette's rows are "open this file", and
            the Studio is a different destination, not a different way to open
            the same one. Values are suffixed so cmdk still sees one unique
            value per item while a search for the filename matches both. */}
        {onOpenDesignStudio && (
          <CommandGroup heading={t('fileSearch.designStudioGroup')}>
            {files.filter(isMarkdownPath).map((path) => {
              const { name, dir } = splitPath(path)
              return (
                <CommandItem
                  key={`studio:${path}`}
                  value={`${path} ${STUDIO_VALUE_SUFFIX}`}
                  onSelect={() => {
                    onOpenDesignStudio(path)
                    onOpenChange(false)
                  }}
                  aria-label={t('fileSearch.openDesignStudioAria', path)}
                >
                  <span className="wb-filesearch-icon" aria-hidden="true">
                    <LayersIcon size={15} />
                  </span>
                  {/* The folder, exactly as the files group above renders it —
                      not the whole path. Printing `path` here repeated the
                      name the line already starts with, so a root-level Spec
                      read "README.md   README.md" and a nested one repeated
                      its folder *and* its name. */}
                  <span className="wb-filesearch-text">
                    <span className="wb-filesearch-name">{name}</span>
                    {dir !== null && <span className="wb-filesearch-dir">{dir}</span>}
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
      <p className="wb-filesearch-hint" aria-hidden="true">
        {t('fileSearch.hint')}
      </p>
    </CommandDialog>
  )
}
