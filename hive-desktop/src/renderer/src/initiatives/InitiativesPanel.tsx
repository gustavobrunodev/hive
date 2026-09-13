import { useMemo, useState } from 'react'
import { Tree, VisuallyHidden, type TreeNode, type TreeRenderState } from '@hive/design-system'
import { t } from '../i18n'
import { IconButton } from '../ui/IconButton'
import { ChevronDownIcon, InitiativeIcon, PlusIcon, ReleaseIcon } from '../ui/icons'
import { STAGES, resolveStages, stagesDone } from './initiativeStages'
import type { Initiative, YearGroup } from './initiatives'
import type { InitiativesStore } from './useInitiatives'

/**
 * The Iniciativas section, above the conversation history on the Chat & Cowork
 * tab.
 *
 * ## Why it sits above the history
 *
 * Because it is the coarser question. "Which demand am I working on" comes
 * before "which conversation about it", the same way a project comes before its
 * notes — and the history below stays exactly as it was, since plenty of work
 * here belongs to no initiative at all.
 *
 * ## Why a real tree
 *
 * The DS `Tree` brings `role="tree"`, roving focus, arrow-key movement and
 * type-ahead with it, which is the whole reason not to hand-roll three nested
 * lists of buttons. It is also the control the file explorer uses one tab over,
 * so the gesture for opening a folder is the gesture for opening a year.
 */

export interface InitiativesPanelProps {
  store: InitiativesStore
  /** The initiative open in the work area, by folder path. */
  activePath: string | null
  onOpen: (initiative: Initiative) => void
  onCreate: () => void
}

/** How far along an initiative's BMAD plan is — the number the demand row wears. */
function progressOf(initiative: Initiative): { done: number; total: number } {
  return { done: stagesDone(resolveStages(initiative.files)), total: STAGES.length }
}

/** Where the release sits in the tree — years are 1, releases 2, demands 3. */
const RELEASE_LEVEL = 2

function yearNodeId(year: number): string {
  return `year:${year}`
}

function releaseNodeId(year: number, release: string): string {
  return `release:${year}:${release}`
}

/** The year → release → demand hierarchy, as DS tree nodes. */
function buildNodes(years: readonly YearGroup[]): TreeNode[] {
  return years.map((group) => ({
    id: yearNodeId(group.year),
    label: String(group.year),
    // Declared branches, not inferred ones: a release folder with nothing in it
    // still has to open (and still has to show a chevron), or the only way to
    // discover it is empty is to be told by its absence.
    expandable: true,
    children: group.releases.map((release) => ({
      id: releaseNodeId(group.year, release.release),
      label: release.release,
      expandable: true,
      children: release.initiatives.map((initiative) => ({
        id: initiative.path,
        label: initiative.title
      }))
    }))
  }))
}

/** Every demand in the tree, by node id — the lookup a selection turns back into an initiative. */
function indexInitiatives(years: readonly YearGroup[]): Map<string, Initiative> {
  const index = new Map<string, Initiative>()
  for (const group of years) {
    for (const release of group.releases) {
      for (const initiative of release.initiatives) index.set(initiative.path, initiative)
    }
  }
  return index
}

/** How many demands sit under a year, for the count beside it. */
function countOf(group: YearGroup): number {
  return group.releases.reduce((total, release) => total + release.initiatives.length, 0)
}

/**
 * What the section opens on before anyone touches it: the newest year, and
 * every release in the tree.
 *
 * Only years fold. A year is the archive axis — last year's demands are
 * something you go looking for, not something that should be in the way — but a
 * release is pure grouping, and folding it means a year you *did* ask for opens
 * onto another row to click instead of onto the demands you came for.
 */
function defaultExpanded(years: readonly YearGroup[]): string[] {
  const releases = years.flatMap((group) =>
    group.releases.map((release) => releaseNodeId(group.year, release.release))
  )
  return years[0] === undefined ? [] : [yearNodeId(years[0].year), ...releases]
}

export function InitiativesPanel({
  store,
  activePath,
  onOpen,
  onCreate
}: InitiativesPanelProps): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const nodes = useMemo(() => buildNodes(store.years), [store.years])
  const index = useMemo(() => indexInitiatives(store.years), [store.years])
  // The newest year and its releases start open, so the section lands on
  // something rather than on a closed row the user has to guess is worth a
  // click. `null` until the user touches it — seeding `useState` from
  // `store.years` would seed it from the *loading* state, which is empty, and
  // the section would then open on nothing for the rest of the session.
  const [expanded, setExpanded] = useState<string[] | null>(null)
  const openIds = expanded ?? defaultExpanded(store.years)

  function renderLabel(node: TreeNode, state: TreeRenderState): React.JSX.Element {
    const initiative = index.get(node.id)
    const group = store.years.find((entry) => yearNodeId(entry.year) === node.id)
    return (
      <>
        {state.expandable ? (
          <span
            className="wb-inits-chev"
            data-open={state.expanded || undefined}
            aria-hidden="true"
          >
            <ChevronDownIcon size={12} />
          </span>
        ) : (
          <span className="wb-inits-leaf-icon" aria-hidden="true">
            <InitiativeIcon size={13} />
          </span>
        )}
        {/* `TreeRenderState.level` is 1-based (the DS tree's root items are
            level 1, matching their `aria-level`), so the release is 2. */}
        {state.level === RELEASE_LEVEL && (
          <span className="wb-inits-release-icon" aria-hidden="true">
            <ReleaseIcon size={13} />
          </span>
        )}
        <span className="wb-inits-name">{node.label}</span>
        {initiative !== undefined && <ProgressChip initiative={initiative} />}
        {group !== undefined && (
          <>
            <span className="wb-inits-count" aria-hidden="true">
              {countOf(group)}
            </span>
            {/* A bare number beside a year is a visual-only cue — the row's
                name has to say what it counts. */}
            <VisuallyHidden>{t('initiatives.countAria', countOf(group))}</VisuallyHidden>
          </>
        )}
      </>
    )
  }

  return (
    <section className="wb-inits" data-open={open || undefined}>
      <div className="wb-inits-head">
        <button
          type="button"
          className="wb-inits-toggle"
          aria-expanded={open}
          aria-controls="wb-inits-body"
          aria-label={open ? t('initiatives.collapse') : t('initiatives.expand')}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="wb-inits-chev" data-open={open || undefined} aria-hidden="true">
            <ChevronDownIcon size={12} />
          </span>
          <span className="wb-sidebar-group-label">{t('initiatives.sectionLabel')}</span>
        </button>
        <IconButton
          className="wb-inits-new"
          label={t('initiatives.newLabel')}
          onClick={onCreate}
          data-tour="initiatives"
        >
          <PlusIcon size={14} />
        </IconButton>
      </div>

      <div className="wb-inits-body" id="wb-inits-body" hidden={!open}>
        {store.status === 'loading' ? (
          <p className="wb-inits-status">{t('initiatives.loading')}</p>
        ) : store.years.length === 0 ? (
          <div className="wb-inits-empty">
            <p className="wb-inits-empty-title">{t('initiatives.emptyTitle')}</p>
            <p className="wb-inits-empty-body">{t('initiatives.emptyBody')}</p>
            <button type="button" className="wb-inits-empty-cta" onClick={onCreate}>
              <PlusIcon size={13} aria-hidden="true" />
              {t('initiatives.emptyCta')}
            </button>
          </div>
        ) : (
          <Tree
            className="wb-inits-tree"
            aria-label={t('initiatives.treeLabel')}
            nodes={nodes}
            selectedIds={activePath === null ? [] : [activePath]}
            expandedIds={openIds}
            onExpandedIdsChange={setExpanded}
            onSelectedIdsChange={(ids) => {
              const initiative = ids.map((id) => index.get(id)).find((entry) => entry !== undefined)
              if (initiative !== undefined) onOpen(initiative)
            }}
            renderLabel={renderLabel}
          />
        )}
      </div>
    </section>
  )
}

/**
 * A demand's progress, as `4/8`.
 *
 * Not a bar: at this width a bar is four pixels of colour that answers "roughly
 * how far" and nothing else, while the pair of numbers answers "how far" *and*
 * "out of how many stages" — and the second half is the part a newcomer to
 * BMAD does not know yet. The `aria-label` spells both out, since `4/8` read
 * aloud is "four slash seven".
 */
function ProgressChip({ initiative }: { initiative: Initiative }): React.JSX.Element {
  const { done, total } = progressOf(initiative)
  return (
    <span
      className="wb-inits-progress"
      data-complete={done === total || undefined}
      data-started={done > 0 || undefined}
      aria-label={t('initiatives.progressAria', done, total)}
    >
      {t('initiatives.progress', done, total)}
    </span>
  )
}
