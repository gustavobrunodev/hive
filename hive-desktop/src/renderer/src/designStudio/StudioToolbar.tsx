import {
  Button,
  Input,
  Kbd,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@hive/design-system'
import { t } from '../i18n'
import { IconButton } from '../ui/IconButton'
import {
  HistoryIcon,
  LayersIcon,
  MaximizeIcon,
  MinimizeIcon,
  RefreshIcon,
  SlidersIcon
} from '../ui/icons'
import type { DetectedScreen } from './screens'
import type { Viewport, ViewportPresetId } from './viewport'
import { VIEWPORT_PRESET_ORDER, customViewport, viewportForPreset } from './viewport'

/**
 * Design Studio (M18) — T4.4. The Bancada's one row of controls.
 *
 * Two rules shape it. **The active preset is visible without opening a menu**
 * (DS-R3 AC-1), which is why the device sizes are a `SegmentedControl` and not
 * a dropdown — a menu would hide the single fact the user checks most often.
 * And **undo/redo reflect the real log**: both buttons are disabled from the
 * Tela's actual cursor, so a disabled Undo means there is nothing to undo,
 * never that the wiring is missing.
 *
 * Export (T7.4) opens the picker rather than exporting on the spot: the button
 * has to mean the same thing whether the user wants this Tela or all of them,
 * and a button that silently means "the active one" is right often enough to be
 * a trap. It is disabled only when the Spec named no Tela — there is nothing to
 * export then, and the tooltip still says what the control does.
 */

const PRESET_LABEL: Record<ViewportPresetId, () => string> = {
  mobile: () => t('designStudio.viewportMobile'),
  tablet: () => t('designStudio.viewportTablet'),
  desktop: () => t('designStudio.viewportDesktop')
}

/** The `SegmentedControl` needs an id for "no preset"; `null` is not one. */
const CUSTOM_SEGMENT = 'custom'

export interface StudioToolbarProps {
  screens: DetectedScreen[]
  activeScreenId: string | null
  onSelectScreen: (screenId: string) => void
  viewport: Viewport
  onViewportChange: (viewport: Viewport) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  focusMode: boolean
  onToggleFocusMode: () => void
  /** Shown only in the bands where the Árvore has lost its column (§3.8). */
  onOpenTree?: () => void
  /** Shown only in the bands where the Inspetor has lost its column (§3.8). */
  onOpenInspector?: () => void
  /** The stage is too narrow to be worth using as is — say so, once. */
  focusHint?: boolean
  /** Opens the export picker (T7.4). Disabled while the Spec names no Tela. */
  onExport: () => void
}

export function StudioToolbar({
  screens,
  activeScreenId,
  onSelectScreen,
  viewport,
  onViewportChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  focusMode,
  onToggleFocusMode,
  onOpenTree,
  onOpenInspector,
  focusHint = false,
  onExport
}: StudioToolbarProps): React.JSX.Element {
  return (
    <div className="wb-dstudio-toolbar" role="toolbar" aria-label={t('designStudio.toolbarAria')}>
      <Select value={activeScreenId ?? undefined} onValueChange={onSelectScreen}>
        <SelectTrigger
          className="wb-dstudio-screen-trigger"
          aria-label={t('designStudio.screenPickerAria')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {screens.map((screen) => (
            <SelectItem key={screen.screenId} value={screen.screenId}>
              {screen.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="wb-dstudio-screen-count">
        {t('designStudio.screenCount', screens.length)}
      </span>
      <ViewportControl viewport={viewport} onChange={onViewportChange} />
      <div className="wb-dstudio-toolbar-end">
        {/* A surface without a column is not a surface that is gone (§3.8):
            it keeps a way in, right here, in exactly the bands that took its
            column away. */}
        {onOpenTree && (
          <IconButton label={t('designStudio.openTreeDrawer')} onClick={onOpenTree}>
            <LayersIcon size={15} />
          </IconButton>
        )}
        {onOpenInspector && (
          <IconButton label={t('designStudio.openInspectorDrawer')} onClick={onOpenInspector}>
            <SlidersIcon size={15} />
          </IconButton>
        )}
        {focusHint && (
          <span className="wb-dstudio-focus-hint" role="note">
            {t('designStudio.focusModeNarrowHint')}
          </span>
        )}
        <HistoryButton
          label={t('designStudio.undo')}
          shortcut={['Ctrl', 'Z']}
          disabled={!canUndo}
          onClick={onUndo}
          icon={<HistoryIcon size={15} />}
        />
        <HistoryButton
          label={t('designStudio.redo')}
          shortcut={['Ctrl', 'Shift', 'Z']}
          disabled={!canRedo}
          onClick={onRedo}
          icon={<RefreshIcon size={15} />}
        />
        <HistoryButton
          label={focusMode ? t('designStudio.focusModeExit') : t('designStudio.focusModeEnter')}
          shortcut={['Ctrl', 'Shift', '.']}
          disabled={false}
          onClick={onToggleFocusMode}
          icon={focusMode ? <MinimizeIcon size={15} /> : <MaximizeIcon size={15} />}
        />
        {/* No tooltip on this one, unlike the icon actions beside it. It
            carries its own word, so a tooltip would only repeat it — and a
            Radix tooltip open on a focused trigger eats the first Escape,
            which inside the picker it opens is the keystroke the user meant
            for the dialog (found in T7.7's keyboard run). */}
        <span className="wb-dstudio-export-wrap">
          <Button variant="ghost" disabled={screens.length === 0} onClick={onExport}>
            {t('designStudio.exportLabel')}
          </Button>
        </span>
      </div>
    </div>
  )
}

/** Device sizes: three presets always visible, plus the custom pair (DS-R3). */
function ViewportControl({
  viewport,
  onChange
}: {
  viewport: Viewport
  onChange: (viewport: Viewport) => void
}): React.JSX.Element {
  return (
    <div className="wb-dstudio-viewport">
      <SegmentedControl
        ariaLabel={t('designStudio.viewportAria')}
        value={viewport.presetId ?? CUSTOM_SEGMENT}
        onChange={(id) =>
          onChange(
            id === CUSTOM_SEGMENT
              ? customViewport(viewport)
              : viewportForPreset(id as ViewportPresetId)
          )
        }
        options={[
          ...VIEWPORT_PRESET_ORDER.map((id) => ({ id, label: PRESET_LABEL[id]() })),
          { id: CUSTOM_SEGMENT, label: t('designStudio.viewportCustom') }
        ]}
      />
      {viewport.presetId === null && (
        <span className="wb-dstudio-viewport-custom">
          <Input
            type="number"
            className="wb-dstudio-viewport-field"
            aria-label={t('designStudio.viewportWidthAria')}
            value={String(viewport.width)}
            onChange={(event) =>
              onChange(customViewport({ ...viewport, width: Number(event.target.value) }))
            }
          />
          <Input
            type="number"
            className="wb-dstudio-viewport-field"
            aria-label={t('designStudio.viewportHeightAria')}
            value={String(viewport.height)}
            onChange={(event) =>
              onChange(customViewport({ ...viewport, height: Number(event.target.value) }))
            }
          />
        </span>
      )}
    </div>
  )
}

/** An icon action whose tooltip carries its keystroke as real `Kbd` keys. */
function HistoryButton({
  label,
  shortcut,
  disabled,
  onClick,
  icon
}: {
  label: string
  shortcut: string[]
  disabled: boolean
  onClick: () => void
  icon: React.ReactNode
}): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="wb-dstudio-action-wrap">
            <IconButton label={label} disabled={disabled} onClick={onClick}>
              {icon}
            </IconButton>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="wb-dstudio-shortcut">
            {label}
            {shortcut.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
