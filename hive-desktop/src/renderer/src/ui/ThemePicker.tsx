import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@hive/design-system'
import { t } from '../i18n'
import { HiveCellIcon, MoonIcon, SunIcon } from './icons'
import { THEMES, THEME_SWATCHES, isTheme, type Theme } from './theme'

interface ThemePickerProps {
  theme: Theme
  onSelectTheme: (theme: Theme) => void
}

const ICONS: Record<Theme, (props: { size?: number }) => React.JSX.Element> = {
  dark: MoonIcon,
  light: SunIcon,
  hive: HiveCellIcon
}

/**
 * A miniature of the workbench, painted in the colours of the theme it stands
 * for: rail on the left, a document beside it, and the one accent-coloured
 * control at the bottom.
 *
 * This replaces a coloured dot, which was the wrong drawing for the question
 * being asked. Nobody chooses a theme by hue — they choose it by how bright
 * the page is, how far the panels separate from it, and where the saturated
 * colour lands. A dot answers none of those; a scaled-down screenshot answers
 * all three at a glance, which is why every platform that does this well
 * (macOS, VS Code, Linear) draws a tiny window rather than a colour chip.
 *
 * Deliberately literal hex, never role tokens: a preview of the theme you are
 * *not* in cannot be drawn with the tokens of the theme you *are* in. The
 * values live in `theme.ts` next to a contrast test that fails when they drift
 * from `assets/theme.css`.
 */
function ThemePreview({ theme }: { theme: Theme }): React.JSX.Element {
  const { bg, surface, ink, accent } = THEME_SWATCHES[theme]
  return (
    <svg
      className="wb-theme-preview"
      viewBox="0 0 44 30"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* The rail is clipped by the tile's own rounded corner rather than
            given a radius of its own — a panel that rounds away from the
            window edge reads as a floating card, which is not what the app
            does. */}
        <clipPath id={`wb-theme-clip-${theme}`}>
          <rect x="0" y="0" width="44" height="30" rx="5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#wb-theme-clip-${theme})`}>
        <rect x="0" y="0" width="44" height="30" fill={bg} />
        <rect x="0" y="0" width="14" height="30" fill={surface} />
        {/* The rail's active row, then two quiet ones: the accent's real job
            in this app is "where you are", and the preview should say so. */}
        <rect x="3.5" y="7" width="7" height="2" rx="1" fill={accent} />
        <rect x="3.5" y="12" width="7" height="2" rx="1" fill={ink} opacity="0.28" />
        <rect x="3.5" y="17" width="5" height="2" rx="1" fill={ink} opacity="0.28" />
        {/* The document: a heading and two lines of body, then the primary
            control. Widths descend so it reads as prose, not as a chart. */}
        <rect x="18" y="6" width="18" height="2.5" rx="1.25" fill={ink} opacity="0.66" />
        <rect x="18" y="12" width="22" height="2" rx="1" fill={ink} opacity="0.3" />
        <rect x="18" y="16" width="15" height="2" rx="1" fill={ink} opacity="0.3" />
        <rect x="18" y="21.5" width="11" height="4" rx="2" fill={accent} />
      </g>
      <rect
        x="0.5"
        y="0.5"
        width="43"
        height="29"
        rx="4.5"
        fill="none"
        stroke={ink}
        strokeOpacity="0.22"
      />
    </svg>
  )
}

/**
 * Title-bar theme control.
 *
 * A third theme is what turns this from a toggle into a choice, and a toggle
 * that cycles through three states is the wrong affordance for a choice: you
 * can't see what's available, you can't go back, and the control's icon has to
 * answer "where am I?" and "where will I land?" at the same time. So it's a
 * menu of the three, each with a preview that shows what it actually looks
 * like — the fastest way to pick a theme is to see it, not to read its name.
 *
 * Radix's radio group carries the semantics for free (`menuitemradio`,
 * `aria-checked`, arrow-key roving, type-ahead), which is exactly the kind of
 * thing DESIGN.md's D1 says not to hand-roll. The selection mark rides at the
 * *trailing* edge (`indicator="trailing"`, added to the DS for this): with a
 * preview already occupying the leading slot, a second mark to its left put
 * two glyphs side by side and made the reader work out which one meant
 * "current" — and, because the DS then right-aligned the rest of the row, gave
 * every option a different text indent.
 */
export function ThemePicker({ theme, onSelectTheme }: ThemePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const CurrentIcon = ICONS[theme]

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="wb-icon-btn"
          title={t('theme.pickerLabel')}
          aria-label={t('theme.pickerLabelWithCurrent', t(`theme.${theme}`))}
        >
          <CurrentIcon />
        </button>
      </DropdownMenuTrigger>
      {open && (
        <DropdownMenuContent align="end" className="wb-theme-menu">
          <DropdownMenuLabel>{t('theme.pickerLabel')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => {
              if (isTheme(value)) onSelectTheme(value)
            }}
          >
            {THEMES.map((id) => (
              <DropdownMenuRadioItem key={id} value={id} indicator="trailing">
                <ThemePreview theme={id} />
                <span className="wb-theme-option">
                  <span className="wb-theme-option-name">{t(`theme.${id}`)}</span>
                  <span className="wb-theme-option-hint">{t(`theme.${id}Hint`)}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}
