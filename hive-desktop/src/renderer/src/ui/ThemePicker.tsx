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
 * Title-bar theme control.
 *
 * A third theme is what turns this from a toggle into a choice, and a toggle
 * that cycles through three states is the wrong affordance for a choice: you
 * can't see what's available, you can't go back, and the control's icon has to
 * answer "where am I?" and "where will I land?" at the same time. So it's a
 * menu of the three, each with the swatch that shows what it actually looks
 * like — the fastest way to pick a theme is to see it, not to read its name.
 *
 * Radix's radio group carries the semantics for free (`menuitemradio`,
 * `aria-checked`, arrow-key roving, type-ahead), which is exactly the kind of
 * thing DESIGN.md's D1 says not to hand-roll.
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
              <DropdownMenuRadioItem key={id} value={id}>
                <span
                  className="wb-theme-swatch"
                  aria-hidden="true"
                  style={{
                    ['--wb-swatch-bg' as string]: THEME_SWATCHES[id].bg,
                    ['--wb-swatch-accent' as string]: THEME_SWATCHES[id].accent
                  }}
                />
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
