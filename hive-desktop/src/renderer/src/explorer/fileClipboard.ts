/**
 * The Explorer's file clipboard — the model behind Ctrl+X / Ctrl+C / Ctrl+V
 * on tree rows (VS Code / OS file-manager parity).
 *
 * Kept as pure functions in their own module, away from `Explorer.tsx`: the
 * two decisions that actually make paste feel right (where does it land, and
 * what is it called when the name is taken) are worth testing directly, and
 * neither of them needs React, the bridge, or the DOM.
 */

/** What a pending cut/copy holds: the mode, and the workspace-relative paths it covers. */
export interface FileClipboard {
  mode: 'cut' | 'copy'
  paths: string[]
}

/** Splits a leaf name into the stem the suffix attaches to and the extension it keeps. */
function splitName(name: string): { stem: string; ext: string } {
  // `lastIndexOf` from index 1, so a dotfile (`.env`, `.gitignore`) is all
  // stem: `.env` is not "a file named nothing with extension env", and
  // ` cópia` belongs after it, not in the middle of it.
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { stem: name, ext: '' }
  return { stem: name.slice(0, dot), ext: name.slice(dot) }
}

/** The copy-suffix pattern, so re-copying `nota cópia.md` yields `nota cópia 2.md` rather than `nota cópia cópia.md`. */
const COPY_SUFFIX_RE = / cópia(?: (\d+))?$/

/**
 * The name a pasted entry takes when `name` is already used in the
 * destination — Windows Explorer / Finder / VS Code behavior, in pt-BR:
 * `nota.md` → `nota cópia.md` → `nota cópia 2.md` → `nota cópia 3.md`.
 *
 * `taken` is the set of leaf names already in the destination directory.
 * Returns `name` unchanged when nothing collides, so callers can run every
 * paste through it without branching first.
 */
export function nextCopyName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name
  const { stem, ext } = splitName(name)
  // Strip an existing suffix before adding one: the series continues, it does
  // not nest.
  const base = stem.replace(COPY_SUFFIX_RE, '')
  for (let n = 1; n < 1000; n += 1) {
    const candidate = `${base}${n === 1 ? ' cópia' : ` cópia ${n}`}${ext}`
    if (!taken.has(candidate)) return candidate
  }
  // Unreachable for any real directory; a timestamp still beats throwing.
  return `${base} cópia ${Date.now()}${ext}`
}

/**
 * Where a paste lands, given the current selection.
 *
 * The rule is the one every file manager uses, and the one the toolbar's
 * "Novo arquivo" already follows: a selected *folder* is the destination, a
 * selected *file* means its folder, and anything else (nothing selected, a
 * mixed multi-selection) falls back to the directory the Explorer already
 * considers active. `''` is the workspace root.
 */
export function pasteDestination(
  selectedIds: readonly string[],
  fileTypes: ReadonlyMap<string, 'file' | 'directory'>,
  activeDirPath: string
): string {
  if (selectedIds.length === 1) {
    const only = selectedIds[0]
    if (only !== undefined && fileTypes.has(only)) {
      if (fileTypes.get(only) === 'directory') return only
      const slash = only.lastIndexOf('/')
      return slash === -1 ? '' : only.slice(0, slash)
    }
  }
  return activeDirPath
}

/**
 * The leaf names already present directly inside `destDir`, derived from the
 * flat path→type map the Explorer already keeps for the whole tree. Used to
 * pick a free name without a round trip per candidate.
 */
export function namesIn(
  destDir: string,
  fileTypes: ReadonlyMap<string, 'file' | 'directory'>
): Set<string> {
  const prefix = destDir ? `${destDir}/` : ''
  const names = new Set<string>()
  for (const path of fileTypes.keys()) {
    if (!path.startsWith(prefix)) continue
    const rest = path.slice(prefix.length)
    if (rest === '' || rest.includes('/')) continue
    names.add(rest)
  }
  return names
}

/**
 * Drops any source that would be pasted into itself or into its own subtree —
 * the same guard the drag-and-drop move already applies, applied here too
 * because the keyboard can express the move that the pointer cannot reach
 * (cut a folder, expand it, select a child, paste).
 */
export function pasteableSources(paths: readonly string[], destDir: string): string[] {
  return paths.filter((path) => destDir !== path && !destDir.startsWith(`${path}/`))
}
