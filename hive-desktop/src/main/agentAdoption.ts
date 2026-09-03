import type { AgentMeta } from './agentRegistry'

/**
 * Which agents a fresh detection should switch on by itself.
 *
 * ## The defect
 *
 * *"Apesar de eu já ter o devin cli configurado e funcionando no meu terminal,
 * a aplicação não está conseguindo detectar e permitir que eu use o agente do
 * Devin."*
 *
 * Detection was never the problem. On the reporter's machine the probe answers
 * `available: true, version: "devin 3000.6.14 (18033302)"` — it found the CLI
 * and could name its build. What it could not do was *offer* it: the enabled
 * set on disk read `["claude-cli", "github-copilot"]`, and that list is written
 * exactly once, during first-run onboarding, from whatever happened to be
 * installed that day. Install a CLI afterwards and it is detected on every
 * launch and used on none of them — with no message anywhere saying why, because
 * from the app's side nothing is wrong.
 *
 * The only cure available to the user was the agent list inside the profile
 * sheet, which is three clicks deep and gives no reason to be opened by someone
 * who believes the app simply cannot see their CLI.
 *
 * ## Why "enable everything detected" is the wrong repair
 *
 * It would re-enable, on every launch, precisely the agents the user went into
 * the profile sheet to switch off. A preference that reverts is worse than one
 * that was never offered.
 *
 * So the decision needs a third fact beyond "installed" and "enabled": whether
 * this agent has ever been *offered* before. That is `knownAgents`. An id in it
 * has had its turn — its absence from the enabled set is a choice, and is left
 * alone. An id not in it is new to this machine, and installing a CLI is
 * unambiguous consent to use it (the same reasoning `AgentSetup` already
 * applies to an agent installed from its card).
 *
 * Pure, so the whole policy is testable without a registry, a config file or a
 * single spawn.
 */
export interface AdoptionInput {
  /** What the probe just found, in display order. */
  detected: AgentMeta[]
  /** The enabled set on disk, or `null` when onboarding hasn't run yet. */
  enabled: string[] | null
  /** Agents already offered, or `null` on a config written before this existed. */
  known: string[] | null
}

export interface AdoptionResult {
  /** The enabled set to persist, or `null` when nothing should change. */
  enabled: string[] | null
  /** The offered-agents record to persist, or `null` when unchanged. */
  known: string[] | null
  /** Ids switched on by this reconcile — what the UI announces. */
  adopted: string[]
}

/** Nothing to persist and nothing to say. */
const NO_CHANGE: AdoptionResult = { enabled: null, known: null, adopted: [] }

export function reconcileAgents(input: AdoptionInput): AdoptionResult {
  const availableIds = input.detected.filter((agent) => agent.available).map((agent) => agent.id)

  // Onboarding hasn't run. `AgentSetup` owns the first enabled set — writing
  // one here would let the user skip the step that also picks their default.
  if (input.enabled === null) return NO_CHANGE

  /**
   * What counts as "already offered".
   *
   * A config written before this record existed has `known: null`, and the
   * obvious migration — seed the record from everything detected and adopt
   * nothing this run — is wrong, which was caught by running the policy
   * against the reporter's own config file. Theirs reads
   * `agents: ["claude-cli","github-copilot"]` with `devin` installed and no
   * `knownAgents` at all, so that branch would have recorded Devin as
   * "already offered" and enabled it **never**. The whole fix would have
   * shipped and the reported bug would have survived it.
   *
   * So an absent record is read as *the enabled set*: those have plainly been
   * offered, and anything else on the machine has not. The cost is that an
   * agent someone disabled before this existed comes back on once. That is
   * recoverable in one click — and the choice is then recorded, so it sticks —
   * whereas the alternative silently keeps a working CLI unusable, which is
   * the exact complaint this module answers.
   */
  const knownSet = new Set(input.known ?? input.enabled)
  const enabledSet = new Set(input.enabled)
  const adopted = availableIds.filter((id) => !knownSet.has(id) && !enabledSet.has(id))
  const nextKnown = [...new Set([...knownSet, ...availableIds])]

  if (adopted.length === 0) {
    // Still record anything newly detected, so an agent that appears while
    // already enabled doesn't read as "new" the next time round.
    return nextKnown.length === (input.known?.length ?? -1)
      ? NO_CHANGE
      : { enabled: null, known: nextKnown, adopted: [] }
  }

  return { enabled: [...input.enabled, ...adopted], known: nextKnown, adopted }
}
