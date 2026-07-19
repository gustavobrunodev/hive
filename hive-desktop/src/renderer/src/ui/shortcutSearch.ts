/**
 * The shortcut customizer's search filter (shortcut-customization) — its own
 * module (not ShortcutCustomizer.tsx) so the component file exports only
 * components (react-refresh/only-export-components).
 */

/** Lowercases and strips diacritics, so "historia" finds "História" (and vice versa). */
function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Plain substring matching over label + keywords instead of cmdk's fuzzy
 * scorer: with long description keywords, fuzzy matching lights up nearly
 * every row for any query ("teste" matching all seven agents), which reads
 * as broken search. Binary scores also keep the catalog's own order stable.
 */
export function commandFilter(value: string, search: string, keywords?: string[]): number {
  const haystack = normalizeSearch(`${value} ${(keywords ?? []).join(' ')}`)
  return haystack.includes(normalizeSearch(search.trim())) ? 1 : 0
}
