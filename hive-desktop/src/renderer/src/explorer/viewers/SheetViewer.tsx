import { useCallback, useMemo, useState } from 'react'
import { Empty } from '@hive/design-system'
import { t } from '../../i18n'
import { DocError, DocLoading, DocToolbar } from './docViewerShared'
import { useAsyncDocument } from './docViewerCore'
// One naming of the columns for every grid in the app: the `.xlsx` reader here
// and the `.csv` editor next door must say "column C" about the same column.
import { columnLabel } from '../csv'

/**
 * Spreadsheet viewer for the binary workbooks (`.xlsx`/`.xls`/`.ods`) —
 * `.csv`/`.tsv` are text and open in the editor's own table mode. SheetJS parses the
 * workbook in main into per-sheet string grids; here each sheet renders as a
 * real grid with the spreadsheet gutters users expect — A/B/C column headers,
 * 1/2/3 row numbers, a sticky frozen header/first-column — plus Excel-style
 * tabs when the workbook has more than one sheet.
 */
export function SheetViewer({
  workspace,
  path
}: {
  workspace: string
  path: string
}): React.JSX.Element {
  const load = useCallback(() => window.hive.fs.readSheet(workspace, path), [workspace, path])
  const { status, data, reload } = useAsyncDocument(load, path)
  const [activeIndex, setActiveIndex] = useState(0)

  const sheet = data?.sheets[Math.min(activeIndex, (data?.sheets.length ?? 1) - 1)]
  const colCount = useMemo(
    () => (sheet ? sheet.rows.reduce((max, row) => Math.max(max, row.length), 0) : 0),
    [sheet]
  )

  if (status === 'loading') return <DocLoading />
  if (status === 'error' || !data || !sheet) return <DocError onRetry={reload} />

  const multiSheet = data.sheets.length > 1

  return (
    <div className="wb-doc wb-sheet-viewer">
      <DocToolbar>
        <span className="wb-doc-meta">
          {t('explorer.viewer.sheet.dimensions', sheet.rowCount, sheet.colCount)}
          {sheet.truncated && (
            <>
              <span className="wb-doc-meta-dot" aria-hidden="true">
                ·
              </span>
              <span className="wb-doc-meta-warn">
                {t('explorer.viewer.sheet.truncated', sheet.rows.length, sheet.rowCount)}
              </span>
            </>
          )}
        </span>
      </DocToolbar>

      <div className="wb-sheet-scroll">
        {sheet.rows.length === 0 ? (
          <div className="wb-pane-center">
            <Empty title={t('explorer.viewer.sheet.empty')} />
          </div>
        ) : (
          <table className="wb-sheet-grid">
            <thead>
              <tr>
                <th className="wb-sheet-corner" aria-hidden="true" />
                {Array.from({ length: colCount }, (_, c) => (
                  <th key={c} className="wb-sheet-colhead" scope="col">
                    {columnLabel(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r}>
                  <th className="wb-sheet-rowhead" scope="row">
                    {r + 1}
                  </th>
                  {Array.from({ length: colCount }, (_, c) => (
                    <td key={c} className="wb-sheet-cell" title={row[c] || undefined}>
                      {row[c] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {multiSheet && (
        <div className="wb-sheet-tabs" role="tablist" aria-label={t('explorer.paneTitle')}>
          {data.sheets.map((s, index) => (
            <button
              key={s.name + index}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? 'wb-sheet-tab is-active' : 'wb-sheet-tab'}
              onClick={() => setActiveIndex(index)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
