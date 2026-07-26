import { useCallback, useEffect, useState } from 'react'
import { t } from '../i18n'
import { ChevronDownIcon, FileTextIcon, FolderIcon } from '../ui/icons'

/** Mirror of the bridge's tree node (renderer never imports `src/main/*`). */
type TreeNode = Awaited<ReturnType<Window['hive']['listTree']>>[number]

interface WikiTreeProps {
  /** Active workspace root — `listTree`'s root. */
  workspace: string
  /** Workspace-relative directory to browse (the vault's `wiki/`). */
  rootRelPath: string
  /** Opens a file in the editor (SB-R2.3). */
  onOpenFile: (path: string) => void
  /**
   * A root-level filename the caller already surfaces itself (the panel gives
   * `index.md` its own prominent "Índice" row). Hidden here so the same file
   * doesn't appear twice in one list.
   */
  omitRootFile?: string
}

/** One row: a file (opens in the editor) or a folder (expands lazily). */
function WikiNode({
  node,
  workspace,
  depth,
  onOpenFile
}: {
  node: TreeNode
  workspace: string
  depth: number
  onOpenFile: (path: string) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<TreeNode[] | null>(null)

  const toggle = useCallback(() => {
    const next = !expanded
    setExpanded(next)
    if (next && children === null) {
      void window.hive.listTree(workspace, node.path).then(setChildren)
    }
  }, [expanded, children, workspace, node.path])

  if (node.type === 'file') {
    return (
      <button
        type="button"
        className="wb-brain-wiki-row"
        style={{ paddingLeft: `calc(var(--s-3) + ${depth} * var(--s-3))` }}
        onClick={() => onOpenFile(node.path)}
        aria-label={t('secondBrain.openFileAria', node.path)}
      >
        <FileTextIcon size={14} className="wb-brain-wiki-icon" />
        <span className="wb-brain-wiki-name">{node.name}</span>
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="wb-brain-wiki-row"
        style={{ paddingLeft: `calc(var(--s-3) + ${depth} * var(--s-3))` }}
        onClick={toggle}
        aria-expanded={expanded}
      >
        <ChevronDownIcon
          size={12}
          className="wb-brain-wiki-chevron"
          data-expanded={expanded || undefined}
        />
        <FolderIcon size={14} className="wb-brain-wiki-icon" />
        <span className="wb-brain-wiki-name">{node.name}</span>
      </button>
      {expanded &&
        children?.map((child) => (
          <WikiNode
            key={child.path}
            node={child}
            workspace={workspace}
            depth={depth + 1}
            onOpenFile={onOpenFile}
          />
        ))}
    </>
  )
}

/**
 * A compact, lazily-expanding browser of the vault's `wiki/` tree (SB-R2.3).
 * Purpose-built rather than reusing the explorer's `FileTree`: that one is
 * workspace-rooted and carries explorer-only behavior (context menus, drag-move,
 * multi-select, rename-in-place) that would be wrong inside this panel. Clicking
 * a file opens it in the **existing editor/viewer** (so Markdown gets M7's real
 * preview) — the tree here only navigates.
 */
export function WikiTree({
  workspace,
  rootRelPath,
  onOpenFile,
  omitRootFile
}: WikiTreeProps): React.JSX.Element {
  const [nodes, setNodes] = useState<TreeNode[] | null>(null)
  // Whether the directory itself was empty, as opposed to emptied by
  // `omitRootFile` — a wiki holding only `index.md` is NOT an empty wiki, and
  // saying so right under the Índice row would contradict what's on screen.
  const [dirEmpty, setDirEmpty] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.hive
      .listTree(workspace, rootRelPath)
      .then((entries) => {
        if (cancelled) return
        setDirEmpty(entries.length === 0)
        setNodes(omitRootFile ? entries.filter((entry) => entry.name !== omitRootFile) : entries)
      })
      .catch(() => {
        if (cancelled) return
        setDirEmpty(true)
        setNodes([])
      })
    return () => {
      cancelled = true
    }
  }, [workspace, rootRelPath, omitRootFile])

  if (dirEmpty && nodes !== null) {
    return <p className="wb-brain-wiki-empty">{t('secondBrain.wikiEmpty')}</p>
  }

  return (
    <div className="wb-brain-wiki-list">
      {nodes?.map((node) => (
        <WikiNode
          key={node.path}
          node={node}
          workspace={workspace}
          depth={0}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  )
}
