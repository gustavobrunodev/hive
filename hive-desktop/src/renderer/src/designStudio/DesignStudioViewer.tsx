import { useState } from 'react'
import { Resizable, ResizableHandle, ResizablePanel, Skeleton } from '@hive/design-system'
import { t } from '../i18n'
import { ScreensEmpty, SpecLoadError } from './ScreensEmpty'
import { StudioToolbar } from './StudioToolbar'
import { useDesignStudio } from './useDesignStudio'

/**
 * Design Studio (M18) — T4.3. The tab's shell: the Bancada's three columns.
 *
 * The layout is the decision (D-DS-3): Telas + Árvore on the left, the stage in
 * the middle, the Inspetor on the right, so the Preview reads as an **object on
 * a workbench** rather than as one more IDE panel. The middle column is the one
 * that grows — the two side columns have a floor and a ceiling, because a stage
 * squeezed to nothing is the failure mode the whole layout exists to avoid.
 *
 * The columns are the DS `Resizable`, the same primitive `WorkUI` uses for the
 * window's own panes, so drag-to-resize and its keyboard equivalent come from
 * one implementation instead of two.
 */

export interface DesignStudioViewerProps {
  workspace: string
  /** Workspace-relative path of the UX Spec this tab reads. */
  specPath: string
  /** Opens the Spec in the ordinary editor — the empty state's way out. */
  onOpenSpec: (path: string) => void
}

export function DesignStudioViewer({
  workspace,
  specPath,
  onOpenSpec
}: DesignStudioViewerProps): React.JSX.Element {
  const studio = useDesignStudio(workspace, specPath)
  const [focusMode, setFocusMode] = useState(false)

  return (
    <div
      className="wb-studio"
      role="region"
      aria-label={t('designStudio.tabAria', specPath)}
      data-focus-mode={focusMode || undefined}
    >
      <StudioToolbar
        screens={studio.screens}
        activeScreenId={studio.activeScreenId}
        onSelectScreen={studio.selectScreen}
        viewport={studio.viewport}
        onViewportChange={studio.setViewport}
        canUndo={studio.canUndo}
        canRedo={studio.canRedo}
        onUndo={studio.undo}
        onRedo={studio.redo}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode((current) => !current)}
      />
      <Resizable orientation="horizontal" className="wb-studio-columns">
        <ResizablePanel
          id="studio-left"
          minSize="14%"
          maxSize="34%"
          defaultSize="22%"
          className="wb-studio-side"
        >
          <section className="wb-studio-pane" aria-label={t('designStudio.screensPaneTitle')}>
            <h2 className="wb-studio-pane-title">{t('designStudio.screensPaneTitle')}</h2>
          </section>
          <section className="wb-studio-pane" aria-label={t('designStudio.treePaneTitle')}>
            <h2 className="wb-studio-pane-title">{t('designStudio.treePaneTitle')}</h2>
          </section>
        </ResizablePanel>
        <ResizableHandle withGrip aria-label={t('designStudio.resizeHandleLabel')} />
        <ResizablePanel id="studio-stage" minSize="40%" defaultSize="56%">
          <StudioBody studio={studio} specPath={specPath} onOpenSpec={onOpenSpec} />
        </ResizablePanel>
        <ResizableHandle withGrip aria-label={t('designStudio.resizeHandleLabel')} />
        <ResizablePanel
          id="studio-inspector"
          minSize="14%"
          maxSize="34%"
          defaultSize="22%"
          className="wb-studio-side"
        >
          <section className="wb-studio-pane" aria-label={t('designStudio.inspectorPaneTitle')}>
            <h2 className="wb-studio-pane-title">{t('designStudio.inspectorPaneTitle')}</h2>
          </section>
        </ResizablePanel>
      </Resizable>
    </div>
  )
}

/**
 * The middle column's four states. Loading is a `Skeleton` on the stage rather
 * than a spinner — DS-R2's rule, applied from the first read: the shape of what
 * is coming, not a token that says "wait".
 */
function StudioBody({
  studio,
  specPath,
  onOpenSpec
}: {
  studio: ReturnType<typeof useDesignStudio>
  specPath: string
  onOpenSpec: (path: string) => void
}): React.JSX.Element {
  if (studio.status === 'loading') {
    return (
      <div className="wb-studio-stage" aria-busy="true" aria-label={t('designStudio.loading')}>
        <Skeleton className="wb-studio-stage-skeleton" />
      </div>
    )
  }
  // `error` is the status: a successful read clears it, so there is no third
  // state where the status says "error" and there is nothing to render.
  if (studio.error) {
    return (
      <div className="wb-studio-stage">
        <SpecLoadError error={studio.error} onRetry={studio.reload} />
      </div>
    )
  }
  if (studio.status === 'empty') {
    return (
      <div className="wb-studio-stage">
        <ScreensEmpty probed={studio.probed} onOpenSpec={() => onOpenSpec(specPath)} />
      </div>
    )
  }
  return <div className="wb-studio-stage" aria-label={t('designStudio.stageAria')} />
}
