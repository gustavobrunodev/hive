import type { RoleAction } from '../ui/ActionRail'

/**
 * The Second Brain slash commands the panel/FAB launch through the normal
 * chat-turn path (`ChatHandle.launchAction`, the same mechanism the Skill
 * Studio uses — D-SB-5). Each is a `RoleAction` whose `command.prompt` is the
 * leading-slash invocation Claude Code resolves to the installed skill; the
 * transcript then shows exactly what ran (`/second-brain-ingest`), like typing
 * it in the composer. Labels/buttons around these live in `i18n/pt-BR.ts`.
 */
function secondBrainCommand(key: string): RoleAction {
  return { key, kind: 'workflow', command: { key, prompt: `/${key}` } }
}

/** SB-R2.2 / SB-R3.3: launch the `/second-brain` setup wizard (scaffolds the vault). */
export const SECOND_BRAIN_SETUP = secondBrainCommand('second-brain')
/** SB-R2.4: file staged raw material into the wiki. */
export const SECOND_BRAIN_INGEST = secondBrainCommand('second-brain-ingest')
/** SB-R2.4: answer a question against the knowledge base. */
export const SECOND_BRAIN_QUERY = secondBrainCommand('second-brain-query')
/** SB-R2.4: health-check / organize the wiki. */
export const SECOND_BRAIN_LINT = secondBrainCommand('second-brain-lint')
