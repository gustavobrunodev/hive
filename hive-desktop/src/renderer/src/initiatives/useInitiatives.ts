import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { watchWorkspaceShared } from '../workspaceWatch'
import {
  INITIATIVES_ROOT,
  MANIFEST_NAME,
  buildManifest,
  groupInitiatives,
  initiativePath,
  initiativeSlug,
  readInitiatives,
  readManifest,
  type Initiative,
  type InitiativeManifest,
  type TreeNodeLike,
  type YearGroup
} from './initiatives'

/** A demand folder of that name already exists in that release — the one failure the create form has words for. */
export class InitiativeExistsError extends Error {
  constructor(readonly folder: string) {
    super(`Initiative already exists: ${folder}`)
    this.name = 'InitiativeExistsError'
  }
}

export type InitiativesStatus = 'loading' | 'ready'

export interface InitiativesStore {
  status: InitiativesStatus
  /** Flat, for lookups by path. */
  initiatives: Initiative[]
  /** The same set as the sidebar tree: year → release → demand. */
  years: YearGroup[]
  /** Creates the folder (and its manifest) and resolves with the new initiative's path. */
  create: (draft: { title: string; year: number; release: string }) => Promise<string>
  refresh: () => void
}

/** The workspace-relative paths of every manifest in a tree walk. */
function manifestPaths(initiatives: readonly { path: string; files: string[] }[]): string[] {
  return initiatives
    .filter((entry) => entry.files.includes(MANIFEST_NAME))
    .map((entry) => `${entry.path}/${MANIFEST_NAME}`)
}

/**
 * The workspace's initiatives, live.
 *
 * Two reads, not one: the tree walk finds the folders, and only the folders
 * that actually have an `iniciativa.json` get a second read for it. A workspace
 * with no manifests at all costs exactly one IPC call, which is the common case
 * for a `docs/iniciativas/` that BMAD or a colleague created.
 *
 * `docs/iniciativas/` not existing is the *first-run* state, not a failure —
 * `listTree` throws on a missing path, and "none yet" is the honest reading of
 * that. Every other way the walk can fail lands there too, deliberately: the
 * workspace root is already open and readable by the time this runs, so a
 * throw here means the folder is not there. There is no error state because
 * there is no error worth a different sentence.
 */
export function useInitiatives(workspace: string): InitiativesStore {
  const [status, setStatus] = useState<InitiativesStatus>('loading')
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [token, setToken] = useState(0)
  const refresh = useCallback(() => setToken((value) => value + 1), [])
  // A tree walk is cheap but not free, and the agent writing a stage's output
  // fires a burst of change events. The generation guard keeps the last walk's
  // answer from being overwritten by an earlier one that finished late.
  const generation = useRef(0)

  useEffect(() => {
    const mine = ++generation.current
    let cancelled = false

    async function load(): Promise<void> {
      let tree: TreeNodeLike[]
      try {
        tree = await window.hive.listTree(workspace, INITIATIVES_ROOT)
      } catch {
        // No `docs/iniciativas/` yet — the ordinary first-run answer.
        if (!cancelled && mine === generation.current) {
          setInitiatives([])
          setStatus('ready')
        }
        return
      }

      const bare = readInitiatives(tree, {}, new Date().getFullYear())
      const manifests: Record<string, Partial<InitiativeManifest>> = {}
      await Promise.all(
        manifestPaths(bare).map(async (path) => {
          try {
            const text = await window.hive.readFile(workspace, path)
            manifests[path.slice(0, -(MANIFEST_NAME.length + 1))] = readManifest(text)
          } catch {
            // A manifest that cannot be read leaves its initiative on the
            // defaults — it is still a folder that exists.
          }
        })
      )

      if (cancelled || mine !== generation.current) return
      setInitiatives(readInitiatives(tree, manifests, new Date().getFullYear()))
      setStatus('ready')
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [workspace, token])

  // Everything that writes into an initiative is somebody else — BMAD through
  // the agent, a `git pull`, the user's own editor — so the panel cannot wait
  // to be told. It watches, and re-walks when something under the root moves.
  useEffect(() => {
    return watchWorkspaceShared(workspace, (event) => {
      if (event.path.startsWith(`${INITIATIVES_ROOT}/`)) refresh()
    })
  }, [workspace, refresh])

  const create = useCallback(
    async (draft: { title: string; year: number; release: string }): Promise<string> => {
      const folder = initiativePath(draft.release, initiativeSlug(draft.title))
      // `createDirectory` is recursive and idempotent, so it happily lands on
      // an existing folder. That is the wrong answer here — creating an
      // initiative over one that exists would look like it worked and quietly
      // adopt somebody else's artifacts — so the collision is caught first.
      if (await window.hive.fs.exists(workspace, folder)) throw new InitiativeExistsError(folder)
      await window.hive.fs.createDirectory(workspace, folder)
      await window.hive.fs.saveFile(
        workspace,
        `${folder}/${MANIFEST_NAME}`,
        `${JSON.stringify(buildManifest(draft.title, draft.year, draft.release, new Date()), null, 2)}\n`
      )
      refresh()
      return folder
    },
    [workspace, refresh]
  )

  const years = useMemo(() => groupInitiatives(initiatives), [initiatives])

  return { status, initiatives, years, create, refresh }
}
