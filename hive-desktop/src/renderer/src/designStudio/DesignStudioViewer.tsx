import { useEffect, useRef, useState } from 'react'
import { Resizable, ResizableHandle, ResizablePanel, Skeleton } from '@hive/design-system'
import { t } from '../i18n'
import { ComponentTree } from './ComponentTree'
import { Inspector, type PropValue } from './Inspector'
import { ScreenList } from './ScreenList'
import { ScreensEmpty, SpecLoadError } from './ScreensEmpty'
import { PreviewFrame } from './PreviewFrame'
import { StagePane } from './StagePane'
import { StudioDrawer } from './StudioDrawer'
import { StudioToolbar } from './StudioToolbar'
import { takeFocusHint } from './focusHint'
import { nextGroupId, type CapabilityViolation } from './documentModel'
import { stageLayoutFor, type StageLayout } from './stageBands'
import { useDesignStudio } from './useDesignStudio'
import { useScreenDocument, type ScreenDocumentState } from './useScreenDocument'

/**
 * Design Studio (M18) — T4.3/T4.8. The tab's shell: the Bancada's columns, and
 * what becomes of them when the tab is narrow.
 *
 * The layout is the decision (D-DS-3): Telas + Árvore on the left, the stage in
 * the middle, the Inspetor on the right, so the Preview reads as an **object on
 * a workbench** rather than as one more IDE panel. The middle column is the one
 * that grows — the two side columns have a floor and a ceiling, because a stage
 * squeezed to nothing is the failure mode the whole layout exists to avoid.
 *
 * Below 1100px the columns fold in a fixed order (§3.8) and every folded
 * surface keeps a way in: the Árvore and the Inspetor move to a drawer, and the
 * Telas are in the toolbar in every band. Nothing is ever merely gone.
 */

export interface DesignStudioViewerProps {
  workspace: string
  /** Workspace-relative path of the UX Spec this tab reads. */
  specPath: string
  /** Opens the Spec in the ordinary editor — the empty state's way out. */
  onOpenSpec: (path: string) => void
  /**
   * DS-R16: Focus Mode is the *window's* state, not the tab's — the app shell
   * is what collapses the rail and the chat, and what restores them exactly.
   */
  focusMode: boolean
  onRequestFocusMode: (focus: boolean) => void
}

/** The tab's own width, live — the columns fold against this, not the window's. */
function useStageLayout(ref: React.RefObject<HTMLDivElement | null>): StageLayout {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return stageLayoutFor(width)
}

type OpenDrawer = 'tree' | 'inspector' | null

export function DesignStudioViewer({
  workspace,
  specPath,
  onOpenSpec,
  focusMode,
  onRequestFocusMode
}: DesignStudioViewerProps): React.JSX.Element {
  const studio = useDesignStudio(workspace, specPath)
  const activeTitle =
    studio.screens.find((screen) => screen.screenId === studio.activeScreenId)?.title ?? ''
  const doc = useScreenDocument(workspace, specPath, studio.activeScreenId, activeTitle)
  const rootRef = useRef<HTMLDivElement>(null)
  const layout = useStageLayout(rootRef)
  const [drawer, setDrawer] = useState<OpenDrawer>(null)
  const [hintOffered] = useState(() => takeFocusHint())

  return (
    <div
      className="wb-dstudio"
      role="region"
      aria-label={t('designStudio.tabAria', specPath)}
      data-band={layout.band}
      data-focus-mode={focusMode || undefined}
      ref={rootRef}
    >
      <StudioToolbar
        screens={studio.screens}
        activeScreenId={studio.activeScreenId}
        onSelectScreen={studio.selectScreen}
        viewport={studio.viewport}
        onViewportChange={studio.setViewport}
        canUndo={doc.canUndo}
        canRedo={doc.canRedo}
        onUndo={() => {
          doc.undo()
          studio.undo()
        }}
        onRedo={() => {
          doc.redo()
          studio.redo()
        }}
        focusMode={focusMode}
        onToggleFocusMode={() => onRequestFocusMode(!focusMode)}
        onOpenTree={layout.treeDrawer ? () => setDrawer('tree') : undefined}
        onOpenInspector={layout.inspectorDrawer ? () => setDrawer('inspector') : undefined}
        focusHint={layout.promoteFocusMode && hintOffered && !focusMode}
      />
      <div className="wb-dstudio-body">
        <Resizable orientation="horizontal" className="wb-dstudio-columns">
          {layout.leftColumn && (
            <ResizablePanel
              id="studio-left"
              minSize="14%"
              maxSize="34%"
              defaultSize="22%"
              className="wb-dstudio-side"
            >
              <ScreensPane studio={studio} />
              <TreePane studio={studio} doc={doc} />
            </ResizablePanel>
          )}
          {layout.leftColumn && (
            <ResizableHandle withGrip aria-label={t('designStudio.resizeHandleLabel')} />
          )}
          <ResizablePanel id="studio-stage" minSize="40%">
            <StudioBody studio={studio} doc={doc} specPath={specPath} onOpenSpec={onOpenSpec} />
          </ResizablePanel>
          {layout.inspectorColumn && (
            <ResizableHandle withGrip aria-label={t('designStudio.resizeHandleLabel')} />
          )}
          {layout.inspectorColumn && (
            <ResizablePanel
              id="studio-inspector"
              minSize="14%"
              maxSize="34%"
              defaultSize="22%"
              className="wb-dstudio-side"
            >
              <InspectorPane studio={studio} doc={doc} />
            </ResizablePanel>
          )}
        </Resizable>
        {drawer === 'tree' && (
          <StudioDrawer title={t('designStudio.treePaneTitle')} onClose={() => setDrawer(null)}>
            <TreePane studio={studio} doc={doc} />
          </StudioDrawer>
        )}
        {drawer === 'inspector' && (
          <StudioDrawer
            title={t('designStudio.inspectorPaneTitle')}
            onClose={() => setDrawer(null)}
          >
            <InspectorPane studio={studio} doc={doc} />
          </StudioDrawer>
        )}
      </div>
    </div>
  )
}

function ScreensPane({
  studio
}: {
  studio: ReturnType<typeof useDesignStudio>
}): React.JSX.Element {
  return (
    <section className="wb-dstudio-pane" aria-label={t('designStudio.screensPaneTitle')}>
      <h2 className="wb-dstudio-pane-title">{t('designStudio.screensPaneTitle')}</h2>
      <ScreenList
        screens={studio.screens}
        activeScreenId={studio.activeScreenId}
        sessions={studio.sessions}
        onSelect={studio.selectScreen}
      />
    </section>
  )
}

/** The Tela's structure, and one of the two ends of the selection (T5.1). */
function TreePane({
  studio,
  doc
}: {
  studio: ReturnType<typeof useDesignStudio>
  doc: ScreenDocumentState
}): React.JSX.Element {
  return (
    <section className="wb-dstudio-pane" aria-label={t('designStudio.treePaneTitle')}>
      <h2 className="wb-dstudio-pane-title">{t('designStudio.treePaneTitle')}</h2>
      <ComponentTree
        document={doc.document}
        selectedComponentId={studio.selectedComponentId}
        onSelect={studio.selectComponent}
      />
    </section>
  )
}

/**
 * The selected Component's props (T5.2/T5.3). One change is **one** `SetProp`
 * in its own group, so it undoes on its own (DS-R6 AC-3, AD-2); a refusal comes
 * straight back to the Field that caused it, with nothing applied.
 */
function InspectorPane({
  studio,
  doc
}: {
  studio: ReturnType<typeof useDesignStudio>
  doc: ScreenDocumentState
}): React.JSX.Element {
  const setProp = async (key: string, value: PropValue): Promise<CapabilityViolation | null> => {
    const componentId = studio.selectedComponentId
    if (componentId === null) return null
    const groupId = nextGroupId()
    const violation = await doc.dispatch([{ type: 'SetProp', componentId, key, value }], groupId)
    // The Tela counts as edited only for a change that landed — a refused value
    // never entered the log, so it must not mark the Tela either (DS-R4 AC-3).
    if (violation === null) studio.recordStep(groupId)
    return violation
  }

  return (
    <section className="wb-dstudio-pane" aria-label={t('designStudio.inspectorPaneTitle')}>
      <h2 className="wb-dstudio-pane-title">{t('designStudio.inspectorPaneTitle')}</h2>
      <Inspector
        catalog={doc.catalog}
        document={doc.document}
        selectedComponentId={studio.selectedComponentId}
        onChange={setProp}
      />
    </section>
  )
}

/**
 * The middle column's four states. Loading is a `Skeleton` on the stage rather
 * than a spinner — DS-R2's rule, applied from the first read: the shape of what
 * is coming, not a token that says "wait".
 */
function StudioBody({
  studio,
  doc,
  specPath,
  onOpenSpec
}: {
  studio: ReturnType<typeof useDesignStudio>
  doc: ScreenDocumentState
  specPath: string
  onOpenSpec: (path: string) => void
}): React.JSX.Element {
  if (studio.status === 'loading') {
    return (
      <div className="wb-dstudio-stage" aria-busy="true" aria-label={t('designStudio.loading')}>
        <Skeleton className="wb-dstudio-stage-skeleton" />
      </div>
    )
  }
  // `error` is the status: a successful read clears it, so there is no third
  // state where the status says "error" and there is nothing to render.
  if (studio.error) {
    return (
      <div className="wb-dstudio-stage">
        <SpecLoadError error={studio.error} onRetry={studio.reload} />
      </div>
    )
  }
  if (studio.status === 'empty') {
    return (
      <div className="wb-dstudio-stage">
        <ScreensEmpty probed={studio.probed} onOpenSpec={() => onOpenSpec(specPath)} />
      </div>
    )
  }
  return (
    <StagePane viewport={studio.viewport}>
      <PreviewFrame
        size={studio.viewport}
        document={doc.document}
        selectedComponentId={studio.selectedComponentId}
        onSelectComponent={studio.selectComponent}
      />
    </StagePane>
  )
}
