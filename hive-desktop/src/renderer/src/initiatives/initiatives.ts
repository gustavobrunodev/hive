import { slugify } from '../ui/studioPrompts'

/**
 * The initiatives model: a workspace's demands, as they sit on disk.
 *
 * An initiative is **a folder, not a record**. The whole feature mirrors
 * `docs/iniciativas/<release>/<demanda>/` — what the tree shows is what BMAD
 * wrote there, and deleting the folder deletes the initiative. There is no
 * database to drift from the filesystem, which is the property that makes the
 * context panel trustworthy: it cannot show an artifact that isn't there, and
 * it cannot miss one the agent just produced.
 *
 * The one thing a folder pair cannot say is **which year** a release belongs
 * to — `R2` alone is ambiguous the moment a second year exists, and the tree's
 * top level is the year. That (and the human title, which a slug loses the
 * accents and capitals of) is what `iniciativa.json` carries. It is optional:
 * a folder somebody made by hand still shows up, under the current year, named
 * after itself.
 */

/** Where every initiative lives, workspace-relative. */
export const INITIATIVES_ROOT = 'docs/iniciativas'

/** The optional per-initiative metadata file. */
export const MANIFEST_NAME = 'iniciativa.json'

/**
 * The badge hues an initiative can wear.
 *
 * Named, never a raw hex: the badge shows up on three themes, and a colour the
 * user picked against the dark one would be the colour that fails on the light
 * one. A name is a *role* the theme resolves (`--init-<name>`), so picking
 * "âmbar" stays legible everywhere and a theme can re-tune its own ramp without
 * rewriting anybody's `iniciativa.json`.
 */
export const INITIATIVE_COLORS = ['violet', 'sky', 'emerald', 'amber', 'rose', 'slate'] as const

export type InitiativeColor = (typeof INITIATIVE_COLORS)[number]

export function isInitiativeColor(value: unknown): value is InitiativeColor {
  return typeof value === 'string' && (INITIATIVE_COLORS as readonly string[]).includes(value)
}

/**
 * The hue an initiative wears when nobody has picked one.
 *
 * Derived from the folder name rather than a single default, so a workspace
 * that never opens the colour picker still gets a legible set of badges
 * instead of a column of identical pills — which is the whole reason the badge
 * is coloured. Stable across restarts because the slug is.
 */
export function defaultColorFor(slug: string): InitiativeColor {
  let hash = 0
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) % 100_000
  return INITIATIVE_COLORS[hash % INITIATIVE_COLORS.length] as InitiativeColor
}

/** What `iniciativa.json` holds. Data keys, so they stay English like the rest of the app's stored shapes. */
export interface InitiativeManifest {
  title: string
  year: number
  release: string
  createdAt: string
  /** The badge hue. Optional: a folder made by hand still gets `defaultColorFor`. */
  color?: InitiativeColor
}

export interface Initiative {
  /** Workspace-relative folder — `docs/iniciativas/R2/portal-de-cobranca`. Also this initiative's identity. */
  path: string
  /** The folder's own name. */
  slug: string
  /** Human title: the manifest's, else the slug read back as words. */
  title: string
  /** The release folder's name, verbatim — `R2`. */
  release: string
  year: number
  /** The badge hue: the manifest's, else one derived from the slug. */
  color: InitiativeColor
  /** Every file inside, as initiative-relative POSIX paths. What the stage model reads. */
  files: string[]
}

export interface ReleaseGroup {
  release: string
  initiatives: Initiative[]
}

export interface YearGroup {
  year: number
  releases: ReleaseGroup[]
}

/** The minimal shape this module needs from `window.hive.listTree` — declared here so the model stays testable without the bridge. */
export interface TreeNodeLike {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNodeLike[]
}

/**
 * A slug read back as words: `portal-de-cobranca` → `Portal De Cobranca`.
 *
 * Deliberately naive — it capitalizes every word rather than guessing at
 * Portuguese articles, because a wrong guess ("Portal de Cobranca" vs "Portal
 * De Cobranca") is invisible to fix and the manifest is the real answer. This
 * only ever names a folder nobody created through the app.
 */
export function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** A folder name for a demand, or `''` when the name has nothing a directory can hold. */
export function initiativeSlug(title: string): string {
  return slugify(title)
}

/** Where a demand's folder goes. */
export function initiativePath(release: string, slug: string): string {
  return `${INITIATIVES_ROOT}/${release}/${slug}`
}

/** Every file under a node, as paths relative to that node. */
function filesUnder(node: TreeNodeLike, prefix = ''): string[] {
  const files: string[] = []
  for (const child of node.children ?? []) {
    const relative = prefix === '' ? child.name : `${prefix}/${child.name}`
    if (child.type === 'file') files.push(relative)
    else files.push(...filesUnder(child, relative))
  }
  return files
}

/**
 * Reads the two-level tree under `docs/iniciativas/` into initiatives.
 *
 * `manifests` is keyed by initiative path; a missing entry is the ordinary
 * case, not an error. Files directly under `docs/iniciativas/` (a stray
 * README) and files directly under a release are ignored — an initiative is a
 * directory two levels down, and nothing else is.
 */
export function readInitiatives(
  root: TreeNodeLike[],
  manifests: Readonly<Record<string, Partial<InitiativeManifest>>>,
  currentYear: number
): Initiative[] {
  const initiatives: Initiative[] = []
  for (const release of root) {
    if (release.type !== 'directory') continue
    for (const folder of release.children ?? []) {
      if (folder.type !== 'directory') continue
      const manifest = manifests[folder.path]
      initiatives.push({
        path: folder.path,
        slug: folder.name,
        title: manifest?.title ?? titleFromSlug(folder.name),
        release: release.name,
        year: manifest?.year ?? currentYear,
        color: manifest?.color ?? defaultColorFor(folder.name),
        files: filesUnder(folder)
      })
    }
  }
  return initiatives
}

/**
 * The leading number of a release folder, or `null` for one that has none.
 *
 * `R10` has to sort after `R9`, which string order gets wrong, and a release
 * folder somebody named `hotfix` still has to appear rather than being dropped
 * for not matching a pattern — so this sorts, it does not filter.
 */
function releaseNumber(release: string): number | null {
  const match = /^R(\d+)$/i.exec(release)
  return match ? Number(match[1]) : null
}

/** `R1` before `R2` before `hotfix`: numbered releases in order, then the rest alphabetically. */
export function compareReleases(a: string, b: string): number {
  const left = releaseNumber(a)
  const right = releaseNumber(b)
  if (left !== null && right !== null) return left - right
  if (left !== null) return -1
  if (right !== null) return 1
  return a.localeCompare(b, 'pt-BR')
}

/**
 * Groups initiatives into the tree the sidebar draws: year, then release, then
 * demand.
 *
 * Newest year first — the year you are working in is the one you want open,
 * and last year's releases are an archive you scroll to. Releases inside a year
 * run forward (R1 → R4) because that is the order they ship in, and demands are
 * alphabetical because nothing else about them implies an order.
 */
export function groupInitiatives(initiatives: readonly Initiative[]): YearGroup[] {
  const byYear = new Map<number, Map<string, Initiative[]>>()
  for (const initiative of initiatives) {
    const releases = byYear.get(initiative.year) ?? new Map<string, Initiative[]>()
    byYear.set(initiative.year, releases)
    releases.set(initiative.release, [...(releases.get(initiative.release) ?? []), initiative])
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, releases]) => ({
      year,
      releases: [...releases.entries()]
        .sort(([a], [b]) => compareReleases(a, b))
        .map(([release, entries]) => ({
          release,
          initiatives: [...entries].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
        }))
    }))
}

/**
 * Parses `iniciativa.json` field by field.
 *
 * Returns a *partial* manifest on purpose: a hand-edited file that lost its
 * year still has a usable title, and one that lost both still names an
 * initiative that exists on disk. One bad field costs that field, never the
 * folder — the folder is the initiative.
 */
export function readManifest(text: string): Partial<InitiativeManifest> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const raw = parsed as Record<string, unknown>
  const manifest: Partial<InitiativeManifest> = {}
  if (typeof raw.title === 'string' && raw.title.trim() !== '') manifest.title = raw.title.trim()
  if (typeof raw.year === 'number' && Number.isFinite(raw.year))
    manifest.year = Math.trunc(raw.year)
  if (typeof raw.release === 'string' && raw.release !== '') manifest.release = raw.release
  if (typeof raw.createdAt === 'string') manifest.createdAt = raw.createdAt
  // An unknown colour name is dropped, not repaired: the initiative then falls
  // back to `defaultColorFor`, which is a legible hue, where keeping the
  // unknown string would resolve to a `var()` nothing defines.
  if (isInitiativeColor(raw.color)) manifest.color = raw.color
  return manifest
}

/** The manifest an initiative is created with. */
export function buildManifest(
  title: string,
  year: number,
  release: string,
  now: Date,
  color?: InitiativeColor
): InitiativeManifest {
  return {
    title,
    year,
    release,
    createdAt: now.toISOString(),
    color: color ?? defaultColorFor(initiativeSlug(title))
  }
}
