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
