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
  type InitiativeColor,
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

/** What the edit form can change about an existing demand. Every field optional — the dialog sends only what moved. */
export interface InitiativeEdit {
  title?: string
  year?: number
  release?: string
  color?: InitiativeColor
}

export interface InitiativesStore {
  status: InitiativesStatus
  /** Flat, for lookups by path. */
  initiatives: Initiative[]
  /** The same set as the sidebar tree: year → release → demand. */
  years: YearGroup[]
  /** Creates the folder (and its manifest) and resolves with the new initiative's path. */
  create: (draft: { title: string; year: number; release: string }) => Promise<string>
  /**
   * Applies an edit and resolves with the initiative's path **afterwards** —
   * which is a different path when the release changed, because the release is
   * a folder. Callers re-point whatever was holding the old one.
   */
  update: (initiative: Initiative, edit: InitiativeEdit) => Promise<string>
  /** Sends the whole folder to the OS trash. */
  remove: (initiative: Initiative) => Promise<void>
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

  /**
   * Applies an edit to one initiative.
   *
   * The title, the year and the colour are **manifest** edits: the folder's
   * name is left exactly as it is. Renaming the folder to match a new title
   * would look tidier for about a second and then break every reference that
   * points at it — the conversations tagged with this initiative, an open
   * editor tab, the artifacts a BMAD run wrote paths into. The slug is an
   * identity; the title is a label, and this changes the label.
   *
   * The **release** is the exception, because the release is not stored, it is
   * the parent folder — so changing it is a move, and the new path is what this
   * resolves with. The move happens before the manifest write so a failed move
   * leaves the manifest describing where the folder actually is.
   */
  const update = useCallback(
    async (initiative: Initiative, edit: InitiativeEdit): Promise<string> => {
      const release = edit.release ?? initiative.release
      const nextPath = initiativePath(release, initiative.slug)
      if (nextPath !== initiative.path) {
        if (await window.hive.fs.exists(workspace, nextPath))
          throw new InitiativeExistsError(nextPath)
        await window.hive.fs.createDirectory(workspace, `${INITIATIVES_ROOT}/${release}`)
        await window.hive.fs.move(workspace, initiative.path, nextPath)
      }
      const manifest: InitiativeManifest = {
        title: edit.title ?? initiative.title,
        year: edit.year ?? initiative.year,
        release,
        // The one field that is not on `Initiative`: it is only ever read off
        // the manifest, so it is re-read rather than invented here. A folder
        // that never had a manifest gets today's date, which is the truth
        // available — the app has no record of when somebody else made it.
        createdAt: await readCreatedAt(workspace, nextPath),
        color: edit.color ?? initiative.color
      }
      await window.hive.fs.saveFile(
        workspace,
        `${nextPath}/${MANIFEST_NAME}`,
        `${JSON.stringify(manifest, null, 2)}\n`
      )
      refresh()
      return nextPath
    },
    [workspace, refresh]
  )

  const remove = useCallback(
    async (initiative: Initiative): Promise<void> => {
      // The OS trash, not an unlink: an initiative folder holds every artifact
      // a demand produced, and "recoverable" is the only acceptable meaning of
      // delete for that. Same call the file tree's own delete makes.
      await window.hive.fs.trash(workspace, initiative.path)
      refresh()
    },
    [workspace, refresh]
  )

  const years = useMemo(() => groupInitiatives(initiatives), [initiatives])

  return { status, initiatives, years, create, update, remove, refresh }
}

/** The manifest's `createdAt` if there is one, else now — an edit must not invent a history. */
async function readCreatedAt(workspace: string, folder: string): Promise<string> {
  try {
    const existing = readManifest(
      await window.hive.readFile(workspace, `${folder}/${MANIFEST_NAME}`)
    )
    if (existing.createdAt !== undefined) return existing.createdAt
  } catch {
    // No manifest yet — this edit is the one creating it.
  }
  return new Date().toISOString()
}
