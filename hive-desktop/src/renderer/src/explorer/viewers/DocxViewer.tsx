import { useCallback } from 'react'
import { t } from '../../i18n'
import { DocError, DocLoading } from './docViewerShared'
import { useAsyncDocument } from './docViewerCore'

/**
 * `.docx` viewer. Conversion to HTML happens in main via mammoth (images
 * inlined as `data:` URLs); here we drop that HTML onto a centered "paper"
 * page so a Word document reads like a document — real headings, measured line
 * length, generous margins — rather than a wall of unstyled text. The HTML is
 * inert under the renderer CSP (`script-src 'self'` blocks any embedded
 * script), and mammoth emits no scripts regardless.
 */
export function DocxViewer({
  workspace,
  path
}: {
  workspace: string
  path: string
}): React.JSX.Element {
  const load = useCallback(() => window.hive.fs.readDocx(workspace, path), [workspace, path])
  const { status, data, reload } = useAsyncDocument(load, path)

  if (status === 'loading') return <DocLoading />
  if (status === 'error' || !data) return <DocError onRetry={reload} />

  return (
    <div className="wb-doc wb-docx-viewer">
      <div className="wb-doc-scroll">
        {data.warnings.length > 0 && (
          <p className="wb-docx-warning">
            {t('explorer.viewer.docx.warnings', data.warnings.length)}
          </p>
        )}
        <article
          className="wb-docx-page wb-md"
          // Content is mammoth-generated HTML from a local file; inert under CSP.
          dangerouslySetInnerHTML={{ __html: data.html }}
        />
      </div>
    </div>
  )
}
