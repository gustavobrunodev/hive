import type { WorkflowCommand } from './agentAdapter'

/**
 * `RoleCatalog` — the source of truth for role-personalization (M9, RP-R1/R3).
 * Maps each user role to an ordered set of launchable actions: BMAD *workflows*
 * plus one "talk to your specialist" *persona* action bound to the role's BMAD
 * agent. See `.specs/features/role-personalization/{spec,design,context}.md`.
 *
 * Skill names are the **verified live** ones observed in a real `bmad-method`
 * install's `.claude/skills/` (the `bmm` module — always installed/recommended
 * per the install catalog — ships every skill named here, including the
 * `bmad-agent-*`/`bmad-tea` personas and the `bmad-testarch-*` QA skills). Only
 * live, non-deprecated names are used (e.g. `bmad-prd`/`bmad-architecture`, not
 * the deprecated `bmad-create-prd`/`bmad-create-architecture` shims). Personas
 * and testarch skills are NOT in `_bmad/_config/bmad-help.csv` (that catalog
 * lists workflow skills only), so they resolve the same way B1/B2 verified:
 * Claude Code matches the natural-language prompt against each `SKILL.md`
 * `description` — no special CLI syntax (see claudeCliAdapter.ts). RP-C4/C5.
 */

export type RoleId = 'pm' | 'tech-lead' | 'ux' | 'qa' | 'dev' | 'general'

/** The closed set of user-selectable roles, in display order (excludes the
 *  internal `general` fallback, which only backs the pre-role default). */
export const SELECTABLE_ROLES: readonly RoleId[] = ['pm', 'tech-lead', 'ux', 'qa', 'dev']

/** Whether a raw persisted string is a valid selectable role. */
export function isSelectableRole(value: string | null | undefined): value is RoleId {
  return value != null && (SELECTABLE_ROLES as readonly string[]).includes(value)
}

/** One action a role can launch. `kind` distinguishes a BMAD workflow from a
 *  "converse with the specialist agent" persona action (styled distinctly). */
export interface RoleActionDef {
  /** Stable key — the renderer keys its i18n label + icon off this. */
  key: string
  /** The BMAD skill this action invokes. */
  skill: string
  kind: 'workflow' | 'persona'
  /** Literal natural-language instruction sent to the agent (names the skill
   *  explicitly — the most robust resolver — plus, for personas, the persona). */
  prompt: string
}

export interface RoleDef {
  id: RoleId
  /** The role's BMAD specialist agent skill (for the persona action). */
  personaSkill?: string
  actions: readonly RoleActionDef[]
}

/** A role action resolved for the renderer: everything it needs to render
 *  (`key`/`kind`) and to launch via the existing `agent.runWorkflow` path. */
export interface ResolvedRoleAction {
  key: string
  kind: 'workflow' | 'persona'
  command: WorkflowCommand
}

function workflow(key: string, skill: string, prompt: string): RoleActionDef {
  return { key, skill, kind: 'workflow', prompt }
}
function persona(key: string, skill: string, prompt: string): RoleActionDef {
  return { key, skill, kind: 'persona', prompt }
}

/**
 * The role → actions table (spec.md "Roles → Actions"). Persona prompts name
 * the specialist so Claude Code resolves the `bmad-agent-*`/`bmad-tea` skill.
 */
export const ROLE_CATALOG: Record<RoleId, RoleDef> = {
  pm: {
    id: 'pm',
    personaSkill: 'bmad-agent-pm',
    actions: [
      workflow(
        'domain-research',
        'bmad-domain-research',
        'Use the bmad-domain-research skill to run domain research for this project.'
      ),
      workflow(
        'brainstorm',
        'bmad-brainstorming',
        'Use the bmad-brainstorming skill to facilitate a brainstorming session.'
      ),
      workflow('prd', 'bmad-prd', 'Use the bmad-prd skill to create a PRD.'),
      workflow(
        'product-brief',
        'bmad-product-brief',
        'Use the bmad-product-brief skill to create a product brief.'
      ),
      workflow(
        'epics-stories',
        'bmad-create-epics-and-stories',
        'Use the bmad-create-epics-and-stories skill to break the requirements into epics and stories.'
      ),
      workflow(
        'story',
        'bmad-create-story',
        'Use the bmad-create-story skill to create the next story.'
      ),
      persona(
        'persona-pm',
        'bmad-agent-pm',
        'I want to talk to John, the BMAD Product Manager agent (the bmad-agent-pm skill).'
      )
    ]
  },
  'tech-lead': {
    id: 'tech-lead',
    personaSkill: 'bmad-agent-architect',
    actions: [
      workflow(
        'architecture',
        'bmad-architecture',
        'Use the bmad-architecture skill to create the technical architecture.'
      ),
      workflow(
        'epics-stories',
        'bmad-create-epics-and-stories',
        'Use the bmad-create-epics-and-stories skill to break the requirements into epics and stories.'
      ),
      workflow(
        'story',
        'bmad-create-story',
        'Use the bmad-create-story skill to create the next story.'
      ),
      persona(
        'persona-architect',
        'bmad-agent-architect',
        'I want to talk to Winston, the BMAD Architect agent (the bmad-agent-architect skill).'
      )
    ]
  },
  ux: {
    id: 'ux',
    personaSkill: 'bmad-agent-ux-designer',
    actions: [
      workflow(
        'ux-spec',
        'bmad-ux',
        'Use the bmad-ux skill to create the UX design specification.'
      ),
      persona(
        'persona-ux',
        'bmad-agent-ux-designer',
        'I want to talk to Sally, the BMAD UX Designer agent (the bmad-agent-ux-designer skill).'
      )
    ]
  },
  qa: {
    id: 'qa',
    personaSkill: 'bmad-tea',
    actions: [
      workflow(
        'test-design',
        'bmad-testarch-test-design',
        'Use the bmad-testarch-test-design skill to design the test plan.'
      ),
      workflow(
        'test-automation',
        'bmad-testarch-automate',
        'Use the bmad-testarch-automate skill to expand automated test coverage.'
      ),
      persona(
        'persona-qa',
        'bmad-tea',
        'I want to talk to Murat, the BMAD Test Architect agent (the bmad-tea skill).'
      )
    ]
  },
  dev: {
    id: 'dev',
    personaSkill: 'bmad-agent-dev',
    actions: [
      workflow(
        'dev-story',
        'bmad-dev-story',
        'Use the bmad-dev-story skill to implement the next story in the sprint plan.'
      ),
      workflow(
        'code-review',
        'bmad-code-review',
        'Use the bmad-code-review skill to review the current code changes.'
      ),
      persona(
        'persona-dev',
        'bmad-agent-dev',
        'I want to talk to Amelia, the BMAD Developer agent (the bmad-agent-dev skill).'
      )
    ]
  },
  // Internal fallback only (never user-selectable). Mirrors the pre-role
  // curated intents so nothing degrades before a role is ever chosen — but the
  // required first-run step (RP-R2) means a real user always lands on one of
  // the five above.
  general: {
    id: 'general',
    actions: [
      workflow('prd', 'bmad-prd', 'Use the bmad-prd skill to create a PRD.'),
      workflow(
        'domain-research',
        'bmad-domain-research',
        'Use the bmad-domain-research skill to run domain research for this project.'
      ),
      workflow(
        'brainstorm',
        'bmad-brainstorming',
        'Use the bmad-brainstorming skill to facilitate a brainstorming session.'
      ),
      workflow(
        'architecture',
        'bmad-architecture',
        'Use the bmad-architecture skill to create the technical architecture.'
      ),
      workflow(
        'story',
        'bmad-create-story',
        'Use the bmad-create-story skill to create the next story.'
      )
    ]
  }
}

/** Normalizes any persisted/passed role string to a known `RoleId`, falling
 *  back to `general` for `null`/unknown values (never throws). */
export function normalizeRole(value: string | null | undefined): RoleId {
  return value != null && value in ROLE_CATALOG ? (value as RoleId) : 'general'
}

/**
 * Resolves a role's ordered actions into the render+launch shape the renderer
 * consumes over IPC (RP-R3.2). Each action's `command` feeds the existing
 * `agent.runWorkflow` path unchanged.
 */
export function resolveRoleActions(role: string | null | undefined): ResolvedRoleAction[] {
  const def = ROLE_CATALOG[normalizeRole(role)]
  return def.actions.map((action) => ({
    key: action.key,
    kind: action.kind,
    command: { key: action.skill, prompt: action.prompt }
  }))
}
