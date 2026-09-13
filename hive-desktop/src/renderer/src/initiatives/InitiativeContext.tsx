import { useMemo } from 'react'
import { StageTracker, type StageTrackerGroup, type StageTrackerStage } from '@hive/design-system'
import { t } from '../i18n'
import { FileTree } from '../explorer/Explorer'
import { IconButton } from '../ui/IconButton'
import { PlayIcon, SyncIcon } from '../ui/icons'
import type { RoleAction } from '../ui/sidebarNav'
import {
  PHASES,
  STAGES,
  resolveStages,
  stageAction,
  stagesDone,
  type PhaseId,
  type StageId,
  type StageState,
  type StageStatus
} from './initiativeStages'
import type { Initiative } from './initiatives'

/**
 * The right rail of an open initiative: what the demand has produced, and what
 * it has left to do.
 *
 * ## Why both halves are on screen at once
 *
 * They answer the two halves of the same question. The plan says *where you
 * are*; the files say *what that produced*. Behind a tab switch, checking one
 * against the other becomes a click each way — and the whole reason the plan is
 * inferred from the folder is so the two can never disagree, which is only
 * worth anything if you can see both.
 *
 * The plan sits on top because it is short, fixed-height and it is the guidance;
 * the tree takes the rest of the column and scrolls, because it is the part that
 * grows.
 */

export interface InitiativeContextProps {
  workspace: string
  /** The demand to draw a rail for. `null` renders nothing — see the note on the component. */
  initiative: Initiative | null
  /** The file open in the viewer, so the tree can keep it highlighted. */
  selectedPath: string | null
  onOpenFile: (path: string) => void
  /** Runs one BMAD stage, in a conversation of its own beside this rail. */
  onRunStage: (action: RoleAction) => void
}

/** The eight stages' pt-BR names. A total map, so a new stage cannot ship nameless. */
const STAGE_LABELS: Record<StageId, () => string> = {
  research: () => t('initiatives.stageResearch'),
  brainstorm: () => t('initiatives.stageBrainstorm'),
  prd: () => t('initiatives.stagePrd'),
  ux: () => t('initiatives.stageUx'),
  architecture: () => t('initiatives.stageArchitecture'),
  'test-design': () => t('initiatives.stageTestDesign'),
  epics: () => t('initiatives.stageEpics'),
  stories: () => t('initiatives.stageStories')
}

/** The four phases' pt-BR names. Total for the same reason. */
const PHASE_LABELS: Record<PhaseId, () => string> = {
  analysis: () => t('initiatives.phaseAnalysis'),
  planning: () => t('initiatives.phasePlanning'),
  solution: () => t('initiatives.phaseSolution'),
  implementation: () => t('initiatives.phaseImplementation')
}

/** The last segment of a path — what the artifact chip says. */
function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/**
 * The affordance printed at the end of a row, at rest.
 *
 * The reported defect was that nobody could tell these rows ran anything, so
 * the fix cannot be a hover state: the one stage that is next says its verb in
 * full, the ones still ahead carry a quiet play glyph, and a finished stage
 * gets neither — its row opens the document its hint is already naming, and the
 * re-run lives in the trailing slot where a destructive click has to be meant.
 */
function stageCue(status: StageStatus): React.ReactNode {
  if (status === 'done') return undefined
  if (status === 'active') {
    return (
      <>
        <PlayIcon size={9} aria-hidden="true" />
        {t('initiatives.stageRunCue')}
      </>
    )
  }
  return <PlayIcon size={11} aria-hidden="true" />
}

/** One phase's header tally — how many of its stages have produced something. */
function phaseGroups(states: readonly StageState[]): StageTrackerGroup[] {
  return PHASES.map((phase) => {
    const inPhase = states.filter((state) => state.phase === phase)
    return {
      id: phase,
      label: PHASE_LABELS[phase](),
      meta: t(
        'initiatives.phaseSummary',
        inPhase.filter((state) => state.status === 'done').length,
        inPhase.length
      )
    }
  })
}

export function InitiativeContext({
  workspace,
  initiative,
  selectedPath,
  onOpenFile,
  onRunStage
}: InitiativeContextProps): React.JSX.Element | null {
  // The "no demand open" case is answered here rather than by a `&&` at the
  // call site: that call site is `WorkUI`, which is at its `complexity`
  // ceiling, and "there is no rail when there is no initiative" is this
  // component's own statement about itself anyway.
  const states = useMemo(() => resolveStages(initiative?.files ?? []), [initiative])
  const done = stagesDone(states)

  const folder = initiative?.path ?? ''
  const title = initiative?.title ?? ''
  const stages: StageTrackerStage[] = states.map((state) => ({
    id: state.id,
    group: state.phase,
    label: STAGE_LABELS[state.id](),
    badge: state.optional ? t('initiatives.stageOptional') : undefined,
    // Only where there is something to say. The filename under a finished
    // stage is what makes "the row opens the document" obvious, and "Próxima
    // etapa" belongs to the one row that is next — but a stage that has not run
    // has no news, and eight rows repeating so is a column of noise standing
    // between the reader and the four phases.
    hint:
      state.artifact !== null
        ? basename(state.artifact)
        : state.status === 'active'
          ? t('initiatives.flowHintNext')
          : undefined,
    status: state.status,
    cue: stageCue(state.status),
    // Re-running is the *trailing* action on a finished stage, never the row:
    // the row is 300px wide and a BMAD skill re-run overwrites the document the
    // hint is naming. Recoverable (every agent write goes through the change
    // review) but not something a stray click should start.
    trailing:
      state.artifact === null ? undefined : (
        <IconButton
          className="wb-initctx-redo"
          label={t('initiatives.redoStage', STAGE_LABELS[state.id]())}
          onClick={() => onRunStage(stageAction(state.skill, title, folder))}
        >
          <SyncIcon size={13} />
        </IconButton>
      )
  }))

  if (initiative === null) return null

  return (
    <aside className="wb-initctx" aria-label={t('initiatives.contextLabel')}>
      {/* The demand's identity lives here, not over the transcript: this rail
          *is* the initiative, and the pane header on the left already says
          which one is open without spending a second strip of chrome on it. */}
      <div className="wb-initctx-id">
        <p className="wb-initctx-crumbs" aria-label={t('initiatives.breadcrumbLabel')}>
          <span>{initiative.year}</span>
          <span className="wb-initctx-crumb-sep" aria-hidden="true">
            /
          </span>
          <span>{initiative.release}</span>
        </p>
        <h2 className="wb-initctx-name">{initiative.title}</h2>
      </div>

      <section className="wb-initctx-flow">
        <header className="wb-initctx-head">
          <h3 className="wb-initctx-title">{t('initiatives.flowTitle')}</h3>
          <span className="wb-initctx-count">
            {t('initiatives.flowSummary', done, STAGES.length)}
          </span>
        </header>
        {/* The rows were already buttons and nobody could tell. One line above
            the plan answers both halves of that — they run, and running one
            never takes over the conversation you are reading. */}
        <p className="wb-initctx-flow-hint">{t('initiatives.flowHint')}</p>
        <StageTracker
          className="wb-initctx-stages"
          label={t('initiatives.flowLabel')}
          stages={stages}
          groups={phaseGroups(states)}
          statusLabels={{
            done: t('initiatives.stageDone'),
            active: t('initiatives.stageActive'),
            pending: t('initiatives.stagePending')
          }}
          actionLabels={{
            done: (label) => t('initiatives.openStage', label),
            active: (label) => t('initiatives.runStage', label),
            pending: (label) => t('initiatives.runStage', label)
          }}
          // One rule for the row: it takes you to the stage. That is the
          // document once the stage has made one, and the run that would make
          // it until then — which is also what every list of finished things
          // does when you click a finished thing.
          onSelect={(id) => {
            const state = states.find((entry) => entry.id === id)
            if (state === undefined) return
            if (state.artifact !== null) onOpenFile(`${folder}/${state.artifact}`)
            else onRunStage(stageAction(state.skill, title, folder))
          }}
        />
      </section>

      {/* The same file manager as the Arquivos tab, rooted at the demand — one
          set of file behaviours in the product, not a second, poorer tree that
          only knows how to open things. */}
      <section className="wb-initctx-files">
        <FileTree
          workspace={workspace}
          rootPath={initiative.path}
          title={t('initiatives.contextTitle')}
          selectedPath={selectedPath}
          onOpenFile={onOpenFile}
        />
      </section>
    </aside>
  )
}
