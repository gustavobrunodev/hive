import { Empty } from '@hive/design-system'
import { t } from '../i18n'
import { FileTypeIcon } from '../ui/fileIcons'
import { richViewerKind } from './richViewer'
import { ImageViewer } from './viewers/ImageViewer'
import { PdfViewer } from './viewers/PdfViewer'
import { DocxViewer } from './viewers/DocxViewer'
import { SheetViewer } from './viewers/SheetViewer'
import { SlidesViewer } from './viewers/SlidesViewer'

/** Fallback for a binary we can't preview yet — a calm card, not garbled text, with an escape hatch to the OS. */
function UnsupportedViewer({
  workspace,
  path
}: {
  workspace: string
  path: string
}): React.JSX.Element {
  const openExternal = (): void => {
    void window.hive.openExternal(`file://${encodeURI(`${workspace}/${path}`)}`)
  }
  return (
    <div className="wb-doc wb-doc-unsupported">
      <div className="wb-pane-center">
        <div className="wb-doc-unsupported-card">
          <span className="wb-doc-unsupported-icon" aria-hidden="true">
            <FileTypeIcon path={path} size={40} />
          </span>
          <Empty
            title={t('explorer.viewer.unsupportedTitle')}
            description={t('explorer.viewer.unsupportedDescription')}
          />
          <button type="button" className="wb-btn hds-btn-primary" onClick={openExternal}>
            {t('explorer.viewer.openExternal')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Router for the rich file viewer: picks the visual viewer for a file's kind
 * (image / pdf / docx / spreadsheet / pptx), or a graceful "can't preview
 * this" card for any other binary. Each viewer owns its own loading, error and
 * toolbar; this component is purely the dispatch. It replaces the previous
 * behavior of dumping a binary file's raw bytes into a text `CodeBlock`.
 */
export function DocumentViewer({
  workspace,
  path
}: {
  workspace: string
  path: string
}): React.JSX.Element {
  switch (richViewerKind(path)) {
    case 'image':
      return <ImageViewer workspace={workspace} path={path} />
    case 'pdf':
      return <PdfViewer workspace={workspace} path={path} />
    case 'docx':
      return <DocxViewer workspace={workspace} path={path} />
    case 'sheet':
      return <SheetViewer workspace={workspace} path={path} />
    case 'pptx':
      return <SlidesViewer workspace={workspace} path={path} />
    default:
      return <UnsupportedViewer workspace={workspace} path={path} />
  }
}
