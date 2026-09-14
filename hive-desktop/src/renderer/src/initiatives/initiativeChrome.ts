import type { Swatch } from '@hive/design-system'
import { t } from '../i18n'
import { INITIATIVE_COLORS, type InitiativeColor } from './initiatives'

/**
 * The pieces of an initiative's *appearance* that more than one surface needs:
 * its hue as a CSS value, the palette the pickers offer, and the two closed
 * sets the create and edit forms share.
 *
 * They live together because they have to agree. The badge in the conversation
 * list and the swatch in the edit dialog are the same colour making the same
 * promise — "this conversation belongs to that demand" — and the moment they
 * are computed in two places that promise is one refactor from breaking.
 *
 * The badge itself is the one thing NOT here: `InitiativeBadge.tsx` holds it,
 * because a module that exports both a component and the constants around it
 * turns off fast refresh for every file that imports it
 * (`react-refresh/only-export-components`).
 */

/**
 * The releases a demand can be planted in.
 *
 * Four, because that is what the team ships in a year. Offered as a closed set
 * rather than a text field for the same reason a month is a picker: `R2`, `r2`
 * and `R 2` would be three folders on disk and three releases in the tree — a
 * typo nobody sees until the demand is missing from where they looked.
 */
export const RELEASES = ['R1', 'R2', 'R3', 'R4'] as const

/** How many years back the pickers offer. Enough for last year's tail end, not an archive. */
export const YEAR_SPAN = 2

/** The CSS variable a hue name resolves through — defined per theme in `assets/theme.css`. */
export function colorVar(color: InitiativeColor): string {
  return `var(--init-${color})`
}

/** The hue names as pt-BR labels. A total map, so a new hue cannot ship nameless. */
const COLOR_LABELS: Record<InitiativeColor, () => string> = {
  violet: () => t('initiatives.colorViolet'),
  sky: () => t('initiatives.colorSky'),
  emerald: () => t('initiatives.colorEmerald'),
  amber: () => t('initiatives.colorAmber'),
  rose: () => t('initiatives.colorRose'),
  slate: () => t('initiatives.colorSlate')
}

/** The palette, shaped for the DS `SwatchPicker`. */
export function colorSwatches(): Swatch[] {
  return INITIATIVE_COLORS.map((color) => ({
    id: color,
    label: COLOR_LABELS[color](),
    color: colorVar(color)
  }))
}

/**
 * What a *conversation row* needs to know about the demand it belongs to.
 *
 * Deliberately not the whole `Initiative`: a row needs a name and a hue, and
 * handing it the file list too would tie the conversation list to a type that
 * changes whenever the folder does.
 */
export interface InitiativeMark {
  title: string
  color: InitiativeColor
}

/** Demands by folder path — the lookup a list of conversations resolves its badges through. */
export type InitiativeMarks = Readonly<Record<string, InitiativeMark>>

/** Builds that lookup from the workspace's initiatives. */
export function initiativeMarks(
  initiatives: readonly { path: string; title: string; color: InitiativeColor }[]
): InitiativeMarks {
  const marks: Record<string, InitiativeMark> = {}
  for (const entry of initiatives) marks[entry.path] = { title: entry.title, color: entry.color }
  return marks
}
