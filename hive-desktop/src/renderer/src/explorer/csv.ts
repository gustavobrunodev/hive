import { detectDelimiter, type CsvDelimiter } from '@hive/design-system'

/**
 * A parsed delimited file, plus everything about the bytes it came from that
 * has to survive being written back.
 *
 * The table editor works on `rows`, but the file on disk is version-controlled
 * text that other people (and other tools) read. So the parse keeps the
 * *shape* of the original — its delimiter, its line ending, whether it ended
 * with a newline, whether it carried a BOM, and which fields were quoted even
 * though they did not have to be. Without that last one, opening a spreadsheet
 * and fixing one cell rewrites the quoting of every row in the file, and the
 * diff of a one-word change is the whole document.
 */
export interface CsvDocument {
  rows: string[][]
  /**
   * Parallel to `rows`: whether the source had this field wrapped in quotes.
   *
   * A hint, not a rule — `serializeCsv` still quotes anything that *needs* it.
   * An edited cell drops its hint (see `setCell`), so a value the user typed
   * is quoted by necessity alone.
   */
  quoted: boolean[][]
  delimiter: CsvDelimiter
  eol: '\n' | '\r\n'
  /** Whether the file ended with a line break — POSIX text files do. */
  trailingNewline: boolean
  /** A UTF-8 byte-order mark led the file. Excel writes them; dropping it breaks Excel. */
  bom: boolean
}

const BOM = '﻿'

/** Which line ending dominates — the one a new row should use. */
function detectEol(text: string): '\n' | '\r\n' {
  const crlf = (text.match(/\r\n/g) ?? []).length
  const lf = (text.match(/\n/g) ?? []).length - crlf
  return crlf > lf ? '\r\n' : '\n'
}

/**
 * Delimited text → rows.
 *
 * RFC 4180 with the tolerances every real file needs: a quoted field may hold
 * the delimiter, a line break and doubled quotes; an unquoted field runs to
 * the next delimiter or line break; and a stray `"` inside an unquoted field
 * is data, not the start of a quoted one.
 */
export function parseCsv(text: string): CsvDocument {
  const bom = text.startsWith(BOM)
  const body = bom ? text.slice(BOM.length) : text
  const delimiter = detectDelimiter(body)
  const eol = detectEol(body)
  const trailingNewline = body.endsWith('\n')

  // An empty file has no rows and no line-ending convention of its own. It is
  // given the POSIX one for the moment it stops being empty — serializing zero
  // rows still produces zero bytes, so an empty file that nobody touched
  // round-trips to an empty file either way.
  if (body === '') return { rows: [], quoted: [], delimiter, eol, trailingNewline: true, bom }

  const rows: string[][] = []
  const quoted: boolean[][] = []
  let row: string[] = []
  let rowQuoted: boolean[] = []
  let field = ''
  let fieldQuoted = false
  let inQuotes = false
  let fieldStart = true

  const endField = (): void => {
    row.push(field)
    rowQuoted.push(fieldQuoted)
    field = ''
    fieldQuoted = false
    fieldStart = true
  }
  const endRow = (): void => {
    endField()
    rows.push(row)
    quoted.push(rowQuoted)
    row = []
    rowQuoted = []
  }

  /**
   * One character inside a quoted field. Returns how many characters it
   * consumed, so the loop can step over the second half of a doubled quote.
   *
   * Lifted out of the loop below rather than inlined: the scan is already at
   * the ceiling the lint rule allows, and this half of it — where a `"` is a
   * literal and where it ends the field — is the half worth reading alone.
   */
  const stepQuoted = (char: string, next: string | undefined): number => {
    if (char !== '"') {
      field += char
      return 1
    }
    // `""` inside a quoted field is one literal quote; a lone `"` closes it.
    if (next === '"') {
      field += '"'
      return 2
    }
    inQuotes = false
    return 1
  }

  for (let at = 0; at < body.length; at++) {
    const char = body[at] as string
    if (inQuotes) {
      at += stepQuoted(char, body[at + 1]) - 1
      continue
    }
    if (char === '"' && fieldStart) {
      inQuotes = true
      fieldQuoted = true
      fieldStart = false
      continue
    }
    if (char === delimiter) {
      endField()
      continue
    }
    if (char === '\r' && body[at + 1] === '\n') continue
    if (char === '\n') {
      endRow()
      continue
    }
    field += char
    fieldStart = false
  }

  // A file ending in a newline has already closed its last row; anything left
  // in the buffer is a final row without one.
  if (!trailingNewline || field !== '' || row.length > 0) endRow()

  return { rows, quoted, delimiter, eol, trailingNewline, bom }
}

/** Whether a value cannot be written bare — it holds structure the reader would misread. */
function needsQuotes(value: string, delimiter: string): boolean {
  return (
    value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')
  )
}

/** Rows → delimited text, in the shape the file already had. */
export function serializeCsv(doc: CsvDocument): string {
  const lines = doc.rows.map((row, rowIndex) =>
    row
      .map((value, columnIndex) => {
        if (needsQuotes(value, doc.delimiter)) return `"${value.replace(/"/g, '""')}"`
        // Kept as it was found: a field the author chose to quote stays
        // quoted, so an untouched row is written back byte for byte.
        return doc.quoted[rowIndex]?.[columnIndex] ? `"${value}"` : value
      })
      .join(doc.delimiter)
  )
  const text = lines.join(doc.eol) + (doc.trailingNewline && lines.length > 0 ? doc.eol : '')
  return doc.bom ? BOM + text : text
}

/**
 * Spreadsheet column label for a zero-based index (0→A, 25→Z, 26→AA).
 *
 * How a column is named when the file does not name it — and how it is named
 * *anyway*, beside the header, so that "column C" means the same thing here
 * and in the Excel window next to it.
 */
export function columnLabel(index: number): string {
  let label = ''
  let n = index
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

/** The widest row — the column count the table has to render. */
export function columnCount(doc: CsvDocument): number {
  return doc.rows.reduce((max, row) => Math.max(max, row.length), 0)
}

/** A copy of `row` padded out to `width` with empty fields. */
function padded(row: string[] | undefined, width: number): string[] {
  const next = [...(row ?? [])]
  while (next.length < width) next.push('')
  return next
}

/** The same, for the parallel quoting hints. */
function paddedFlags(row: boolean[] | undefined, width: number): boolean[] {
  const next = [...(row ?? [])]
  while (next.length < width) next.push(false)
  return next
}

/**
 * The document with one cell replaced.
 *
 * Writing into a short row pads it out to the grid's width first: a table
 * shows a cell there, so the file has to have one. The edited cell loses its
 * quoting hint — what the user typed is quoted only if it needs to be.
 */
export function setCell(doc: CsvDocument, row: number, column: number, value: string): CsvDocument {
  return {
    ...doc,
    rows: doc.rows.map((existing, index) => {
      if (index !== row) return existing
      const next = padded(existing, Math.max(existing.length, column + 1))
      next[column] = value
      return next
    }),
    quoted: doc.quoted.map((existing, index) => {
      if (index !== row) return existing
      const next = paddedFlags(existing, column + 1)
      next[column] = false
      return next
    })
  }
}

/** The document with an empty row inserted at `at` (clamped into range). */
export function insertRow(doc: CsvDocument, at: number): CsvDocument {
  const index = Math.max(0, Math.min(at, doc.rows.length))
  const width = Math.max(columnCount(doc), 1)
  const blank = Array.from({ length: width }, () => '')
  return {
    ...doc,
    rows: [...doc.rows.slice(0, index), blank, ...doc.rows.slice(index)],
    quoted: [...doc.quoted.slice(0, index), blank.map(() => false), ...doc.quoted.slice(index)]
  }
}

/** The document without row `at`. */
export function removeRow(doc: CsvDocument, at: number): CsvDocument {
  return {
    ...doc,
    rows: doc.rows.filter((_, index) => index !== at),
    quoted: doc.quoted.filter((_, index) => index !== at)
  }
}

/**
 * The document with an empty column inserted at `at`.
 *
 * Every row gets one, including the short ones — a column that exists in some
 * rows and not others is exactly the corruption a table editor must not
 * introduce.
 */
export function insertColumn(doc: CsvDocument, at: number): CsvDocument {
  const width = columnCount(doc)
  const index = Math.max(0, Math.min(at, width))
  return {
    ...doc,
    rows: doc.rows.map((row) => {
      const next = padded(row, width)
      next.splice(index, 0, '')
      return next
    }),
    quoted: doc.quoted.map((row) => {
      const next = paddedFlags(row, width)
      next.splice(index, 0, false)
      return next
    })
  }
}

/** The document without column `at`, in every row. */
export function removeColumn(doc: CsvDocument, at: number): CsvDocument {
  return {
    ...doc,
    rows: doc.rows.map((row) => row.filter((_, index) => index !== at)),
    quoted: doc.quoted.map((row) => row.filter((_, index) => index !== at))
  }
}

/**
 * The source line each row starts on.
 *
 * Not the row's index: a quoted field may hold line breaks, and then one row
 * of the table is three lines of the file. This is what lets the pane carry
 * the reader's place across the table⇄text switch — you leave looking at a
 * record and arrive looking at the same one.
 */
export function rowStartLines(doc: CsvDocument): number[] {
  const out: number[] = []
  let line = 0
  for (const row of doc.rows) {
    out.push(line)
    line += 1 + row.reduce((count, field) => count + (field.match(/\n/g) ?? []).length, 0)
  }
  return out
}

/** The row that owns source line `line` (the last one starting at or before it). */
export function rowAtLine(starts: readonly number[], line: number): number {
  let found = 0
  for (let index = 0; index < starts.length; index++) {
    if ((starts[index] as number) > line) break
    found = index
  }
  return found
}

/**
 * Whether the first row reads as a header rather than as data.
 *
 * The question has no certain answer, so this is a default the user can
 * override, not a verdict: a header row is one where nothing is a number,
 * nothing is blank, and no two fields are the same. Real headers pass all
 * three; a row of measurements fails the first, and a partly-filled row of
 * data fails the second.
 */
export function looksLikeHeader(doc: CsvDocument): boolean {
  const first = doc.rows[0]
  if (!first || first.length === 0 || doc.rows.length < 2) return false
  const trimmed = first.map((value) => value.trim())
  if (trimmed.some((value) => value === '')) return false
  if (trimmed.some((value) => value !== '' && !Number.isNaN(Number(value)))) return false
  return new Set(trimmed).size === trimmed.length
}
