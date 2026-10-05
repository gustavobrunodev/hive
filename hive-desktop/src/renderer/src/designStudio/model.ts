import { t } from '../i18n'

/**
 * The module's pure rules — the decisions that have no business inside a
 * component: what "Recentes" shows, how the home greets, which Fonte a
 * Relatório's path names.
 */

/** How many conversations "Recentes" lists (criterion 9). */
export const RECENTES_LIMIT = 7

/**
 * The conversations "Recentes" lists: the most recently updated first, at most
 * seven. A new array — the listing it came from is left as it was.
 */
export function recentConversations<T extends { updatedAt: number }>(
  conversations: readonly T[],
  limit: number = RECENTES_LIMIT
): T[] {
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit)
}

/**
 * The home's salutation for an hour of the day (criterion 32): before noon,
 * before six in the evening, after.
 */
export function salutation(hour: number): string {
  if (hour < 12) return t('designStudio.home.morning')
  if (hour < 18) return t('designStudio.home.afternoon')
  return t('designStudio.home.evening')
}

/** The three Fontes, by the folder decision 3 gives each. */
export const FONTES = ['likert', 'voz', 'fullstory'] as const
export type FonteId = (typeof FONTES)[number]

function isFonte(value: string): value is FonteId {
  return (FONTES as readonly string[]).includes(value)
}

/**
 * The Fonte a Relatório's path names: `<Produto>/relatorios/<fonte>/<arquivo>`
 * (decision 3). Anything else names none.
 */
export function fonteOfPath(relatorio: string): FonteId | null {
  const [, folder, fonte, file] = relatorio.split(/[\\/]/)
  return folder === 'relatorios' && file !== undefined && isFonte(fonte) ? fonte : null
}

/** A Fonte's display name. */
export function fonteName(fonte: FonteId): string {
  const names: Record<FonteId, string> = {
    likert: t('designStudio.fontes.likert'),
    voz: t('designStudio.fontes.voz'),
    fullstory: t('designStudio.fontes.fullstory')
  }
  return names[fonte]
}

/** The agents the module runs, in the order "the first available" picks from (Unresolved 14). */
export const MODULE_AGENTS = ['claude-cli', 'devin'] as const
export type ModuleAgentId = (typeof MODULE_AGENTS)[number]

/** The agent a module turn runs on: its id, the name a person knows it by, and its pinned model. */
export interface ModuleAgent {
  id: ModuleAgentId
  nome: string
  modelo: string | null
}

function isModuleAgent(id: string | null): id is ModuleAgentId {
  return id !== null && (MODULE_AGENTS as readonly string[]).includes(id)
}

/** The display name of a module agent. */
export function moduleAgentName(id: ModuleAgentId): string {
  return id === 'devin' ? t('designStudio.agentes.devin') : t('designStudio.agentes.claude')
}

/**
 * The module's default agent (Unresolved 14, written default): the Hive's
 * default agent when it is Claude or Devin; otherwise the first of the two
 * that is available — Copilot is not in the module. The model is that agent's
 * pin. With neither available, Claude: the turn then fails the way any turn on
 * a missing agent does, with the Hive's own repair.
 */
export function moduleDefaultAgent(
  hiveDefault: string | null,
  available: ReadonlyArray<{ id: string; available: boolean }>,
  pins: Readonly<Record<string, { model: string } | undefined>>
): ModuleAgent {
  const id: ModuleAgentId = isModuleAgent(hiveDefault)
    ? hiveDefault
    : (MODULE_AGENTS.find((agent) => available.some((a) => a.id === agent && a.available)) ??
      'claude-cli')
  return { id, nome: moduleAgentName(id), modelo: pins[id]?.model ?? null }
}
