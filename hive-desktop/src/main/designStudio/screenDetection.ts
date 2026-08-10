/**
 * Design Studio (M18) — T4.2. Reading the Telas out of a UX Spec.
 *
 * **This runs before the agent, not instead of it (DS-R1 AC-2).** The Spec's
 * Telas have to be on screen *before* any Preview is generated, and an agent
 * round-trip to answer "what is in this file" would put a spinner between the
 * user and the first thing the Studio is supposed to tell them. So the list
 * comes from the markdown itself, synchronously, and generation (DS-R2)
 * happens later per Tela.
 *
 * **The heuristic is calibrated against real UX Specs, not invented ones**
 * (design.md R-8). `bmad-ux` — the flow whose output this reads — writes an
 * EXPERIENCE.md whose surfaces are named in exactly two places, and both are
 * probed here in that order:
 *
 *   1. **A Tela heading** — `## Tela — Login`, `### Screen: Checkout`. The
 *      explicit form; when a Spec has it, it is authoritative.
 *   2. **The Information Architecture table** — the canonical `bmad-ux` spine
 *      section, a table whose first column is `Surface` (or `Screen`/`Tela`)
 *      and whose every body row is one surface. This is what the two real
 *      example spines in `.claude/skills/bmad-ux/assets/` actually use, and
 *      what the detector's tests read off disk.
 *
 * A bare `## Telas` / `## Screens` section header is deliberately **not** a
 * Tela: it names the section that contains them. Treating it as one would put
 * a phantom entry at the top of every well-written Spec.
 *
 * When both probes come up empty the caller gets `screens: []` **and** the
 * list of probes that were run, because DS-R1 AC-3 requires the empty state to
 * say what was looked for — an empty state that only says "nothing found"
 * leaves the user with no move.
 */

/** One way of naming a Tela in a Spec. The empty state renders these by name. */
export type ScreenProbe = 'screenHeading' | 'iaTable'

/** Probes in the order they are tried. The first one that finds anything wins. */
export const SCREEN_PROBES: readonly ScreenProbe[] = ['screenHeading', 'iaTable']

export interface DetectedScreen {
  /** Stable within one Spec; derived from the title, deduplicated. */
  screenId: string
  title: string
  /** Which probe produced it. */
  probe: ScreenProbe
}

export interface ScreenDetectionResult {
  screens: DetectedScreen[]
  /** Every probe that ran, in order — the material for "o que procurou". */
  probed: readonly ScreenProbe[]
}

/** `## Tela — Login`, `### Screen: Checkout`, `## Tela 3`. Level 2..4 only. */
const SCREEN_HEADING = /^#{2,4}\s+((?:telas?|screens?)\b)\s*(.*)$/i

/**
 * A separator between the keyword and the Tela's own name. With one, the name
 * is what follows (`## Tela — Login` → "Login"); without one, the whole
 * heading is the name (`## Tela 3` → "Tela 3"), which is the only reading that
 * does not turn a numbered Tela into an entry called "3".
 */
const HEADING_SEPARATOR = /^[—–\-:.]+\s*(.+)$/

/** The IA table's first column, in either language. */
const SURFACE_COLUMN = /^(?:surfaces?|screens?|telas?|superf[ií]cies?)$/i

/** A markdown table separator row (`| --- | :--- |`). */
const TABLE_SEPARATOR = /^\|?[\s:|-]+\|[\s:|-]*$/

/** Strips the markdown a heading or a table cell may carry around the name itself. */
function plainText(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Splits a markdown table row into its trimmed cells. */
function tableCells(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/**
 * The Spec's lines with fenced code blocks removed. A fence can contain
 * anything — including a table or a `## Tela` line in an example — and
 * counting those would make the Studio offer Telas that the Spec is only
 * quoting.
 */
function contentLines(markdown: string): string[] {
  const lines: string[] = []
  let fenced = false
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    if (!fenced) lines.push(line)
  }
  return lines
}

/** Probe 1: explicit `## Tela …` headings. */
function screensFromHeadings(lines: string[]): string[] {
  const titles: string[] = []
  for (const line of lines) {
    const match = SCREEN_HEADING.exec(line.trim())
    if (!match) continue
    const rest = plainText(match[2])
    // `## Telas` on its own is the section that contains them, not a Tela.
    if (!rest) continue
    const separated = HEADING_SEPARATOR.exec(rest)
    titles.push(separated ? separated[1] : `${plainText(match[1])} ${rest}`)
  }
  return titles
}

/** Probe 2: the first column of the Information Architecture table. */
function screensFromIaTable(lines: string[]): string[] {
  const titles: string[] = []
  let inTable = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) {
      inTable = false
      continue
    }
    if (TABLE_SEPARATOR.test(trimmed)) continue
    const cells = tableCells(trimmed)
    if (!inTable) {
      inTable = SURFACE_COLUMN.test(plainText(cells[0]))
      continue
    }
    const title = plainText(cells[0])
    if (title) titles.push(title)
  }
  return titles
}

/** A url-ish, stable id for a title, unique within one detection run. */
function screenIdFor(title: string, taken: Set<string>): string {
  const base =
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tela'
  let id = base
  let n = 2
  while (taken.has(id)) {
    id = `${base}-${n}`
    n += 1
  }
  taken.add(id)
  return id
}

export function detectScreens(markdown: string): ScreenDetectionResult {
  const lines = contentLines(markdown)
  const probes: { probe: ScreenProbe; titles: string[] }[] = [
    { probe: 'screenHeading', titles: screensFromHeadings(lines) },
    { probe: 'iaTable', titles: screensFromIaTable(lines) }
  ]
  const found = probes.find((entry) => entry.titles.length > 0)
  if (!found) return { screens: [], probed: SCREEN_PROBES }

  const taken = new Set<string>()
  return {
    screens: found.titles.map((title) => ({
      screenId: screenIdFor(title, taken),
      title,
      probe: found.probe
    })),
    probed: SCREEN_PROBES
  }
}
