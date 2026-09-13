import type { ReactNode } from 'react'
import { TooltipProvider } from '@hive/design-system'
import { t } from '../i18n'
import { HiveLogo } from './HiveLogo'
import { ThemePicker } from './ThemePicker'
import { TooltipIconButton } from './TooltipIconButton'
import { PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon } from './icons'
import type { Theme } from './theme'
import { SIDEBAR_REGION_ID } from './sidebarNav'

export interface AppNavbarProps {
  /** Whether the sidebar panel is on screen — drives the toggle's icon, name and pressed state. */
  sidebarOpen: boolean
  onToggleSidebar: () => void
  /** Opens the workspace file/folder search — the same palette Ctrl+P opens. */
  onOpenSearch: () => void
  /** The search palette is open — the button reports the dialog it owns. */
  searchOpen: boolean
  theme: Theme
  onSelectTheme: (theme: Theme) => void
  /**
   * The workspace switcher, injected rather than built here.
   *
   * The chip is a menu over the host's own state — recents, the unsaved-work
   * guard, "Recarregar janela" — and none of that is navbar business. Passing
   * it in keeps this component presentational and keeps the switch's behaviour
   * byte-for-byte what it was before the redesign.
   */
  workspaceChip: ReactNode
}

/**
 * The app's navigation bar — compact, floating, top-left.
 *
 * It replaced a full-width title bar that carried the wordmark lockup, the
 * workspace chip, 500px of empty space, a theme control and an avatar. Three
 * problems, all of them the width's fault: the bar spent the whole top edge of
 * the window to hold four controls; the avatar sat as far from the user's work
 * as it is possible to sit; and nothing in the row said anything about how the
 * app is organised.
 *
 * ## Why it floats over the sidebar rather than above everything
 *
 * The controls in here are all about the **left column**: show/hide it, jump to
 * its file surface, and switch the workspace the whole column describes. Chrome
 * belongs next to what it operates, so the bar is the sidebar's own top edge —
 * which is also what gives the work area the full height of the window instead
 * of starting 46px down.
 *
 * It stays functional with the sidebar away: the bar is positioned against the
 * shell, not parented into the collapsible panel, so hiding the sidebar leaves
 * the button that brings it back exactly where the hand let go of it.
 *
 * ## Order
 *
 * Identity, then the two controls that decide what is on screen, then
 * appearance, then the workspace. Left to right is "who → where → how it looks
 * → what it's looking at": the mark is the only thing that never changes, and
 * the workspace is the only one whose label grows, so it goes last where it can
 * truncate without moving anything.
 *
 * ## Why search and not a shortcut to the Explorer
 *
 * The second slot went to the file tree at first, and it was the wrong pick: a
 * button that only re-selects a tab two rows below itself is a shortcut to
 * something already on screen. Search is the affordance that has no other home
 * — it answers "where is that file" without knowing the folder, works with the
 * sidebar away, and is the one file question a user asks from inside a
 * conversation. The Explorer keeps its own row in the Arquivos tab and its
 * Ctrl+Shift+E, so nothing was lost by giving the slot to the harder question.
 */
export function AppNavbar({
  sidebarOpen,
  onToggleSidebar,
  onOpenSearch,
  searchOpen,
  theme,
  onSelectTheme,
  workspaceChip
}: AppNavbarProps): React.JSX.Element {
  const toggleLabel = sidebarOpen ? t('nav.hideSidebar') : t('nav.showSidebar')
  return (
    // `header`, and the app's only one: this strip is the banner the pane
    // toolbars deliberately are not (see PaneHeader's note on landmark count).
    <header className="wb-navbar">
      <TooltipProvider>
        {/* The mark alone, at 18px. The wordmark left with the full-width bar:
            a lockup that says "Hive" in a window whose title already does is
            the most expensive way to spend the top-left corner, and the symbol
            is the part that carries the identity at chrome size. */}
        <HiveLogo mark="mark" className="wb-navbar-logo" aria-label={t('app.title')} />
        <TooltipIconButton
          label={toggleLabel}
          className="wb-navbar-btn"
          aria-expanded={sidebarOpen}
          aria-controls={SIDEBAR_REGION_ID}
          aria-keyshortcuts="Control+B"
          onClick={onToggleSidebar}
        >
          {sidebarOpen ? <PanelLeftCloseIcon size={16} /> : <PanelLeftOpenIcon size={16} />}
        </TooltipIconButton>
        {/* The palette is a dialog, not a panel: `aria-haspopup` promises the
            overlay and `aria-expanded` reports whether it is up — the same
            contract the theme control and the workspace chip beside it use. */}
        <TooltipIconButton
          label={t('nav.searchLabel')}
          hint={`${t('nav.searchLabel')} (Ctrl+P)`}
          className="wb-navbar-btn"
          active={searchOpen}
          aria-haspopup="dialog"
          aria-expanded={searchOpen}
          aria-keyshortcuts="Control+P"
          onClick={onOpenSearch}
        >
          <SearchIcon size={16} />
        </TooltipIconButton>
        <ThemePicker theme={theme} onSelectTheme={onSelectTheme} className="wb-navbar-btn" />
        <span className="wb-navbar-sep" aria-hidden="true" />
        {workspaceChip}
      </TooltipProvider>
    </header>
  )
}
