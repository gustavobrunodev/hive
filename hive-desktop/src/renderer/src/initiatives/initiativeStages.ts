import type { RoleAction } from '../ui/sidebarNav'

/**
 * The BMAD path from "we have an idea" to "we have stories", as four phases and
 * eight stages — and the rule for telling which of them are done.
 *
 * ## Why the artifacts decide, and not a stored status
 *
 * Because the agent writes the files, and nothing tells the app when it did.
 * A status field would need someone to keep it honest: BMAD would have to
 * report back, or the user would have to tick boxes, and the first time either
 * of those was skipped the tracker would start lying — which is worse than not
 * having one, because the whole point is to be believed about what is left.
 *
 * A file on disk cannot drift. `prd.md` exists or it does not, the answer
 * survives a restart, a `git pull`, an agent run this app never saw, and the
 * user writing the document by hand in another editor. So the tracker asks the
 * folder, every time.
 *
 * The cost is a heuristic: it reads *names*, not contents, so an empty
 * `prd.md` counts as a PRD. That is the right trade — a file the user created
 * on purpose is a statement about where they are, and second-guessing it would
 * mean the tracker arguing with the folder.
 */

/**
 * The four phases of the flow, in order.
 *
 * They are how the plan is *read*, not extra machinery: eight rows in a column
 * is a list you scan, four named chapters of two or three is a method you can
 * hold in your head — and it is the same vocabulary a BMAD-fluent squad already
 * uses out loud ("we're still in solucionamento").
 */
export type PhaseId = 'analysis' | 'planning' | 'solution' | 'implementation'

export const PHASES: readonly PhaseId[] = ['analysis', 'planning', 'solution', 'implementation']

export type StageId =
  'research' | 'brainstorm' | 'prd' | 'ux' | 'architecture' | 'test-design' | 'epics' | 'stories'

export interface StageDefinition {
  id: StageId
  phase: PhaseId
  /** The BMAD skill this stage runs. */
  skill: string
  /**
   * Real work that plenty of demands never need — a spike with no UI has no UX
   * spec, and a demand that arrived fully written needs no brainstorming.
   *
   * It changes two things: the row wears an "Opcional" badge, and the stage can
   * never be the one the tracker points at as *next*. Skipping it has to cost
   * nothing, and an arrow aimed at something you were always free to skip is an
   * instruction the flow did not mean to give.
   */
  optional?: true
  /**
   * Matches an initiative-relative POSIX path that means this stage produced
   * something.
   *
   * Both languages, because BMAD's own skills write English filenames
   * (`prd.md`, `architecture.md`) while a person working in this app writes
   * Portuguese ones — and a tracker that only recognised one of the two would
   * report a stage as pending while staring straight at its output.
   */
  artifact: RegExp
}

/**
 * The eight stages, in the order they are worked.
 *
 * The order is a suggestion the tracker draws, not a rule it enforces: every
 * stage stays launchable whatever the ones before it say. Skipping brainstorming
 * because the demand arrived fully specified is normal, and so is redoing a PRD
 * after the architecture found a hole in it.
 */
export const STAGES: readonly StageDefinition[] = [
  {
    id: 'research',
    phase: 'analysis',
    skill: 'bmad-domain-research',
    optional: true,
    artifact: /(^|\/)(pesquisa[-_]?(de[-_]?)?dominio|domain[-_]?research|research)[^/]*\.md$/i
  },
  {
    id: 'brainstorm',
    phase: 'analysis',
    skill: 'bmad-brainstorming',
    optional: true,
    artifact: /(^|\/)(brainstorm|ideacao)[^/]*\.md$/i
  },
  { id: 'prd', phase: 'planning', skill: 'bmad-prd', artifact: /(^|\/)prd[^/]*\.md$/i },
  {
    id: 'ux',
    phase: 'planning',
    skill: 'bmad-ux',
    optional: true,
    // `bmad-ux` writes `DESIGN.md`, so that exact name counts — but only that
    // one. A looser `design[^/]*` would also swallow `design-de-testes.md`, the
    // Portuguese name for the *test* stage's output two rows below, and the UX
    // row would light up for work nobody did.
    artifact: /(^|\/)(design\.md|ux[^/]*\.md|[a-z0-9]+[-_]ux[^/]*\.md)$/i
  },
  {
    id: 'architecture',
    phase: 'solution',
    skill: 'bmad-architecture',
    artifact: /(^|\/)(architecture|arquitetura|solution[-_]?design)[^/]*\.md$/i
  },
  {
    id: 'test-design',
    phase: 'solution',
    skill: 'bmad-testarch-test-design',
    artifact:
      /(^|\/)(test[-_]?design|design[-_]?de[-_]?testes?|plano[-_]?de[-_]?teste|test[-_]?plan)[^/]*\.md$/i
  },
  {
    id: 'epics',
    phase: 'solution',
    skill: 'bmad-create-epics-and-stories',
    artifact: /(^|\/)(epics?|epicos?|épicos?)[^/]*\.md$/i
  },
  {
    id: 'stories',
    phase: 'implementation',
    skill: 'bmad-create-story',
    // A directory of them, not one file: stories are the one stage whose output
    // is a growing set, and `historias/` with anything in it is the signal.
    artifact: /(^|\/)(historias|histórias|stories)\/[^/]+$/i
  }
]

export type StageStatus = 'done' | 'active' | 'pending'

export interface StageState {
  id: StageId
  phase: PhaseId
  skill: string
  optional: boolean
  status: StageStatus
  /** The file that proves this stage ran, initiative-relative — `null` when it hasn't. */
  artifact: string | null
}

/**
 * Where each stage stands, given the initiative's files.
 *
 * At most one stage is `active`: the first *required* one with no artifact.
 * Everything after it is `pending` even if it happens to have an artifact of
 * its own — because "next" is a single place to point at, and two of them is no
 * guidance at all. A stage that ran out of order still reads as `done`; it just
 * doesn't get to be the arrow, and neither does an optional stage, which nobody
 * is behind on for having skipped.
 */
export function resolveStages(files: readonly string[]): StageState[] {
  const found = STAGES.map((stage) => ({
    stage,
    artifact: files.find((file) => stage.artifact.test(file)) ?? null
  }))
  const nextIndex = found.findIndex(
    (entry) => entry.artifact === null && entry.stage.optional !== true
  )
  return found.map(({ stage, artifact }, index) => ({
    id: stage.id,
    phase: stage.phase,
    skill: stage.skill,
    optional: stage.optional === true,
    artifact,
    status: artifact !== null ? 'done' : index === nextIndex ? 'active' : 'pending'
  }))
}

/** How far along the whole plan is, as a count of finished stages. */
export function stagesDone(states: readonly StageState[]): number {
  return states.filter((state) => state.status === 'done').length
}

/**
 * The turn that runs one stage for one initiative.
 *
 * A slash invocation, like every other launch in this app, so the transcript
 * shows exactly what ran. What rides along is the one thing the skill cannot
 * work out for itself: **which folder this is about**. Without it BMAD picks
 * its own default output location and the artifacts land outside the
 * initiative — where this app's tracker will never see them, and where the
 * user will not think to look.
 *
 * The reading clause is deliberately *on demand* rather than an instruction to
 * read the folder up front. A stage that opens every artifact before it starts
 * spends the context window on documents it may never need — the architecture
 * run does not want the whole PRD in the prompt, it wants the two sections it
 * is about to contradict. "Sob demanda quando necessário" leaves the choice
 * with the skill, which is the only thing that knows what it is about to do.
 */
export function stageAction(skill: string, title: string, folder: string): RoleAction {
  return {
    key: skill,
    kind: 'workflow',
    command: {
      key: skill,
      prompt:
        `/${skill} Iniciativa "${title}". Trabalhe no contexto da pasta ${folder} — ` +
        `leia os artefatos que já existem lá sob demanda quando necessário.`
    }
  }
}
