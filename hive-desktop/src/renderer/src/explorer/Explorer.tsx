import { useCallback, useEffect, useMemo, useState } from 'react'
import { CodeBlock, Empty, ScrollArea, Spinner, Tree } from '@hive/design-system'
import { t } from '../i18n'
import { renderMarkdown } from './markdown'

/**
 * Structural mirror of `main/fsService.ts`'s `TreeNode` (design.md §2). Kept
 * local — rather than importing across the main/renderer boundary — so this
 * component stays self-contained inside `explorer/**`, per T12's touch
 * scope. `window.hive.listTree()`'s resolved value is structurally
 * identical (same field names/shapes), so nothing here needs a cast.
 */
interface FsTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FsTreeNode[]
}

export interface ExplorerProps {
  /** Absolute path to the workspace root to browse (design.md §4 "File explorer"/"File viewer", R5.1–R5.4). */
  workspace: string
}

type TreeState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; nodes: FsTreeNode[] }

type ViewerState =
  | { status: 'idle' }
  | { status: 'loading'; path: string }
  | { status: 'error'; path: string }
  | { status: 'ready'; path: string; content: string }

interface DsTreeNodeShape {
  id: string
  label: string
  children?: DsTreeNodeShape[]
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith('.md')
}

/** Flattens the tree into a `path -> type` lookup so selecting a tree row can tell files from directories. */
function collectFileTypes(nodes: FsTreeNode[], into: Map<string, FsTreeNode['type']>): void {
  for (const node of nodes) {
    into.set(node.path, node.type)
    if (node.children) collectFileTypes(node.children, into)
  }
}

/** Maps `FsTreeNode`s onto the shape the DS `Tree` component expects (`id`/`label`/`children`). */
function toDsNodes(nodes: FsTreeNode[]): DsTreeNodeShape[] {
  return nodes.map((node) => ({
    id: node.path,
    label: node.name,
    children: node.type === 'directory' ? toDsNodes(node.children ?? []) : undefined
  }))
}

/**
 * Self-contained file explorer + viewer (task T12, design.md §4). Lists a
 * workspace's folder structure in a DS `Tree`, shows the selected file's
 * content in a viewer pane (`.md` in a minimal readable render, everything
 * else in `CodeBlock`), and keeps the tree live via `watchWorkspace`.
 *
 * Deliberately **not** wired into `App.tsx` yet — a later integration task
 * composes this alongside chat (T15) into the 3-pane app shell once both
 * exist; this component only needs a `workspace` path to be fully
 * functional on its own.
 */
export function Explorer({ workspace }: ExplorerProps): React.JSX.Element {
  const [treeState, setTreeState] = useState<TreeState>({ status: 'loading' })
  const [viewerState, setViewerState] = useState<ViewerState>({ status: 'idle' })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [refreshToken, setRefreshToken] = useState(0)

  // Initial load + re-fetch whenever `refreshToken` bumps (from the watcher
  // below) or the workspace changes. The loading-state reset lives inside
  // `load()` (a callback), not as a direct statement in the effect body, per
  // react-hooks/set-state-in-effect — calling setState synchronously at the
  // top of an effect can trigger cascading renders.
  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setTreeState({ status: 'loading' })
      try {
        const nodes = await window.hive.listTree(workspace)
        if (!cancelled) setTreeState({ status: 'ready', nodes })
      } catch {
        if (!cancelled) setTreeState({ status: 'error' })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [workspace, refreshToken])

  // Live updates (R5.3): a change anywhere under the workspace re-fetches
  // the tree so files created by an agent workflow (T19) show up without a
  // manual reload. Unsubscribes on unmount / workspace change.
  useEffect(() => {
    const unsubscribe = window.hive.watchWorkspace(workspace, () => {
      setRefreshToken((current) => current + 1)
    })
    return unsubscribe
  }, [workspace])

  const fileTypes = useMemo(() => {
    const map = new Map<string, FsTreeNode['type']>()
    if (treeState.status === 'ready') collectFileTypes(treeState.nodes, map)
    return map
  }, [treeState])

  const dsNodes = useMemo(
    () => (treeState.status === 'ready' ? toDsNodes(treeState.nodes) : []),
    [treeState]
  )

  const handleSelectedIdsChange = useCallback(
    (ids: string[]) => {
      setSelectedIds(ids)
      const path = ids[0]
      if (path === undefined || fileTypes.get(path) !== 'file') return
      setViewerState({ status: 'loading', path })
      window.hive.readFile(workspace, path).then(
        (content: string) => setViewerState({ status: 'ready', path, content }),
        () => setViewerState({ status: 'error', path })
      )
    },
    [workspace, fileTypes]
  )

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div
        style={{
          width: 280,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          minHeight: 0,
          display: 'flex'
        }}
      >
        {renderTreePane()}
      </div>
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
        {renderViewerPane()}
      </div>
    </div>
  )

  function renderTreePane(): React.JSX.Element {
    if (treeState.status === 'loading') {
      return <PaneCenter>{<Spinner label={t('explorer.treeLoading')} />}</PaneCenter>
    }

    if (treeState.status === 'error') {
      return (
        <PaneCenter>
          <Empty
            title={t('explorer.treeErrorTitle')}
            description={t('explorer.treeErrorDescription')}
          />
        </PaneCenter>
      )
    }

    if (dsNodes.length === 0) {
      return (
        <PaneCenter>
          <Empty
            title={t('explorer.treeEmptyTitle')}
            description={t('explorer.treeEmptyDescription')}
          />
        </PaneCenter>
      )
    }

    return (
      <ScrollArea style={{ width: '100%', height: '100%' }}>
        <Tree
          nodes={dsNodes}
          selectedIds={selectedIds}
          onSelectedIdsChange={handleSelectedIdsChange}
          aria-label={t('explorer.treeAriaLabel')}
        />
      </ScrollArea>
    )
  }

  function renderViewerPane(): React.JSX.Element {
    if (viewerState.status === 'idle') {
      return (
        <PaneCenter>
          <Empty
            title={t('explorer.viewerEmptyTitle')}
            description={t('explorer.viewerEmptyDescription')}
          />
        </PaneCenter>
      )
    }

    if (viewerState.status === 'loading') {
      return <PaneCenter>{<Spinner label={t('explorer.viewerLoading')} />}</PaneCenter>
    }

    if (viewerState.status === 'error') {
      return (
        <PaneCenter>
          <Empty
            title={t('explorer.viewerErrorTitle')}
            description={t('explorer.viewerErrorDescription')}
          />
        </PaneCenter>
      )
    }

    if (isMarkdownPath(viewerState.path)) {
      return (
        <ScrollArea style={{ width: '100%', height: '100%' }}>
          <div className="hds-markdown" data-testid="markdown-viewer">
            {renderMarkdown(viewerState.content)}
          </div>
        </ScrollArea>
      )
    }

    return (
      <ScrollArea style={{ width: '100%', height: '100%' }}>
        <CodeBlock
          copyText={viewerState.content}
          copyLabel={t('explorer.copyLabel')}
          copiedLabel={t('explorer.copiedLabel')}
        >
          {viewerState.content}
        </CodeBlock>
      </ScrollArea>
    )
  }
}

/** Centers a pane's `Empty`/`Spinner` state within the available space. */
function PaneCenter({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
    >
      {children}
    </div>
  )
}
