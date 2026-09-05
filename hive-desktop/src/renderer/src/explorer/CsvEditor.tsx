import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  DataGrid,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Empty,
  type DataGridColumn,
  type DataGridCursor
} from '@hive/design-system'
import { t } from '../i18n'
import { IconButton } from '../ui/IconButton'
import { ColumnPlusIcon, MoreIcon, RowPlusIcon, TrashIcon } from '../ui/icons'
import {
  columnCount,
  columnLabel,
  insertColumn,
  insertRow,
  looksLikeHeader,
  parseCsv,
  removeColumn,
  removeRow,
  rowAtLine,
  rowStartLines,
  serializeCsv,
  setCell,
  type CsvDocument
} from './csv'

/**
 * Above this many rows the table steps aside for the text editor.
 *
 * Every row is real DOM here, and a grid that takes a second to paint on
 * every keystroke is a worse editor than the one it replaced. The ceiling is
 * far above the artifacts this app actually produces (a BMAD backlog export
 * runs to hundreds of rows) and the escape hatch is one click away, named.
 */
const CSV_TABLE_CEILING = 5000

/** How the file's separator is said out loud in the meta line. */
function delimiterName(delimiter: string): string {
  if (delimiter === ';') return t('explorer.csv.delimiterSemicolon')
  if (delimiter === '\t') return t('explorer.csv.delimiterTab')
  if (delimiter === '|') return t('explorer.csv.delimiterPipe')
  return t('explorer.csv.delimiterComma')
}

/**
 * Whether a column holds numbers — every value that is there parses as one.
 *
 * Right-aligned, tabular figures are what makes a column of numbers readable
 * down its last digit, and getting that wrong for a column of ids or dates is
 * worse than not doing it at all: the test is deliberately strict, and one
 * word anywhere in the column turns it back off.
 */
function isNumericColumn(rows: string[][], column: number): boolean {
  let seen = 0
  for (const row of rows) {
    const value = (row[column] ?? '').trim()
    if (value === '') continue
    if (Number.isNaN(Number(value))) return false
    seen++
  }
  return seen > 0
}

interface CsvEditorProps {
  /** The draft text — the same string the raw editor edits. */
  value: string
  /** A new draft, already serialized back to delimited text. */
  onChange: (next: string) => void
  /** The file's name, for the grid's accessible name. */
  fileName: string
  /** Sends the reader to the raw-text half of the pane (the ceiling's escape hatch). */
  onOpenText: () => void
  /**
   * The source line the reader was on in the other mode — the cursor lands on
   * the record that line belongs to. `null` opens at the top.
   *
   * **1-based**, which is the line vocabulary the pane and `scrollSync` speak
   * (`lineAtOffset` returns 1 for the first line). `csv.ts` counts from zero,
   * like the array it is indexing; the conversion happens here, at the border
   * between the two, and nowhere else.
   */
  initialLine?: number | null
  /** The source line (1-based) the cursor is on now, so the pane can carry it back. */
  onLineChange?: (line: number) => void
}

/**
 * The table half of a `.csv` file.
 *
 * ## Why a table at all
 *
 * Because a spreadsheet exported to CSV is a table that lost its grid, and
 * everyone who opens one in a text editor spends the first minute counting
 * commas to find out which field is which. The people this app is for — PMs
 * and analysts reading a backlog export or a metrics dump — do not owe anyone
 * that minute.
 *
 * ## Why it edits the same string the text editor does
 *
 * Because then it inherits everything the pane already knows how to do:
 * the dirty dot, Ctrl+S, the discard button, the unsaved-changes guard, the
 * concurrent-write (STALE) detection. A cell edit is a text edit — parse,
 * change one field, serialize — and the two modes are two ways of looking at
 * one draft rather than two editors that have to be kept in sync.
 *
 * `csv.ts` is what makes that safe: an untouched row is written back byte for
 * byte, quoting included, so opening the table does not rewrite the file.
 */
export function CsvEditor({
  value,
  onChange,
  fileName,
  onOpenText,
  initialLine,
  onLineChange
}: CsvEditorProps): React.JSX.Element {
  const doc = useMemo(() => parseCsv(value), [value])
  const width = columnCount(doc)
  const starts = useMemo(() => rowStartLines(doc), [doc])
  const [header, setHeader] = useState(() => looksLikeHeader(doc))
  // Opening on the record the reader was reading in the other mode. Read once,
  // on mount: after that the cursor is the user's, not the carry's.
  const [cursor, setCursor] = useState<DataGridCursor>(() => {
    if (initialLine === undefined || initialLine === null) return { row: 0, column: 0 }
    const offsetAtMount = looksLikeHeader(doc) ? 1 : 0
    const row = rowAtLine(rowStartLines(doc), initialLine - 1)
    return { row: Math.max(row - offsetAtMount, 0), column: 0 }
  })
  const [renaming, setRenaming] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  const offset = header ? 1 : 0
  const bodyRows = useMemo(() => doc.rows.slice(offset), [doc, offset])
  /** The document row the grid's row `index` stands for. */
  const docRow = useCallback((index: number) => index + offset, [offset])

  const write = useCallback((next: CsvDocument) => onChange(serializeCsv(next)), [onChange])

  // A row deleted out from under the cursor would otherwise leave it pointing
  // past the end — the grid clamps its own movement, but not a shrinking table.
  useEffect(() => {
    const clamp = (): void => {
      setCursor((current) => {
        const row = Math.min(current.row, Math.max(bodyRows.length - 1, 0))
        const column = Math.min(current.column, Math.max(width - 1, 0))
        return row === current.row && column === current.column ? current : { row, column }
      })
    }
    clamp()
  }, [bodyRows.length, width])

  useEffect(() => {
    if (renaming !== null) renameRef.current?.select()
  }, [renaming])

  // The other half of the carry: whatever record the cursor is on is the line
  // the raw editor should open at.
  useEffect(() => {
    const report = (): void => onLineChange?.((starts[cursor.row + offset] ?? 0) + 1)
    report()
  }, [cursor.row, offset, starts, onLineChange])

  const commitRename = useCallback(() => {
    if (renaming === null) return
    write(setCell(doc, 0, renaming, renameValue))
    setRenaming(null)
  }, [renaming, renameValue, doc, write])

  const columns: DataGridColumn[] = useMemo(
    () =>
      Array.from({ length: Math.max(width, 1) }, (_, index) => {
        const letter = columnLabel(index)
        const name = header ? (doc.rows[0]?.[index] ?? '') : letter
        return {
          id: `c${index}`,
          label:
            renaming === index ? (
              <input
                ref={renameRef}
                className="wb-csv-rename"
                value={renameValue}
                aria-label={t('explorer.csv.renameColumn')}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitRename()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setRenaming(null)
                  }
                }}
              />
            ) : (
              name || t('explorer.csv.unnamedColumn')
            ),
          // With a header row the letters still earn their place: they are how
          // you say "column C" to someone looking at the same file in Excel.
          hint: header ? letter : undefined,
          numeric: isNumericColumn(bodyRows, index)
        }
      }),
    [width, header, doc, bodyRows, renaming, renameValue, commitRename]
  )

  /** The column the cursor is in, named the way the menu will say it. */
  const cursorColumnName = header
    ? doc.rows[0]?.[cursor.column] || columnLabel(cursor.column)
    : columnLabel(cursor.column)

  const addRow = useCallback(
    (at: number) => {
      write(insertRow(doc, at))
      setCursor((current) => ({ row: Math.max(at - offset, 0), column: current.column }))
    },
    [doc, write, offset]
  )

  const tooLarge = doc.rows.length > CSV_TABLE_CEILING

  if (tooLarge) {
    return (
      <div className="wb-csv" data-testid="csv-editor">
        <div className="wb-pane-center">
          <Empty
            title={t('explorer.csv.tooLargeTitle')}
            description={t('explorer.csv.tooLargeDescription', doc.rows.length)}
          />
          <Button className="wb-btn hds-btn-primary" onClick={onOpenText}>
            {t('explorer.csv.tooLargeCta')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="wb-csv" data-testid="csv-editor">
      <div className="wb-csv-toolbar">
        <p className="wb-csv-meta">
          <span className="wb-csv-shape">
            {t('explorer.csv.shape', bodyRows.length, Math.max(width, 1))}
          </span>
          <span className="wb-csv-dot" aria-hidden="true">
            ·
          </span>
          <span className="wb-csv-delimiter">{delimiterName(doc.delimiter)}</span>
        </p>
        <div className="wb-csv-actions">
          <button
            type="button"
            className="wb-csv-toggle"
            aria-pressed={header}
            onClick={() => setHeader((current) => !current)}
          >
            {t('explorer.csv.headerToggle')}
          </button>
          <IconButton
            label={t('explorer.csv.addRow')}
            onClick={() => addRow(docRow(cursor.row) + 1)}
          >
            <RowPlusIcon />
          </IconButton>
          <IconButton
            label={t('explorer.csv.addColumn')}
            onClick={() => write(insertColumn(doc, cursor.column + 1))}
          >
            <ColumnPlusIcon />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t('explorer.csv.moreLabel')}>
                <MoreIcon />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => addRow(docRow(cursor.row))}>
                {t('explorer.csv.insertRowAbove')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => write(removeRow(doc, docRow(cursor.row)))}
                disabled={bodyRows.length === 0}
              >
                <TrashIcon />
                {t('explorer.csv.deleteRow', cursor.row + 1)}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => write(insertColumn(doc, cursor.column))}>
                {t('explorer.csv.insertColumnBefore')}
              </DropdownMenuItem>
              {header && (
                <DropdownMenuItem
                  onSelect={() => {
                    setRenameValue(doc.rows[0]?.[cursor.column] ?? '')
                    setRenaming(cursor.column)
                  }}
                >
                  {t('explorer.csv.renameColumnNamed', cursorColumnName)}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => write(removeColumn(doc, cursor.column))}
                disabled={width <= 1}
              >
                <TrashIcon />
                {t('explorer.csv.deleteColumn', cursorColumnName)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DataGrid
        className="wb-csv-grid"
        ariaLabel={t('explorer.csv.gridLabel', fileName)}
        columns={columns}
        rows={bodyRows}
        cursor={cursor}
        onCursorChange={setCursor}
        colorColumns
        onCellChange={(row, column, next) => write(setCell(doc, docRow(row), column, next))}
        empty={
          <Empty
            title={t('explorer.csv.emptyTitle')}
            description={t('explorer.csv.emptyDescription')}
          />
        }
        footer={
          <button type="button" className="wb-csv-addrow" onClick={() => addRow(doc.rows.length)}>
            <RowPlusIcon />
            {t('explorer.csv.addRowFooter')}
          </button>
        }
      />
    </div>
  )
}
