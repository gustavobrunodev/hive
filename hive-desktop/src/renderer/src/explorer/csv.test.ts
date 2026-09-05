import { describe, expect, it } from 'vitest'
import {
  columnCount,
  insertColumn,
  insertRow,
  looksLikeHeader,
  parseCsv,
  removeColumn,
  removeRow,
  rowAtLine,
  rowStartLines,
  serializeCsv,
  setCell
} from './csv'

/** Parse → serialize, which must be the identity for a file nobody edited. */
function roundTrip(text: string): string {
  return serializeCsv(parseCsv(text))
}

describe('parseCsv', () => {
  it('reads plain rows and fields', () => {
    const doc = parseCsv('nome,papel\nAda,engenheira\n')
    expect(doc.rows).toEqual([
      ['nome', 'papel'],
      ['Ada', 'engenheira']
    ])
    expect(doc.delimiter).toBe(',')
    expect(doc.trailingNewline).toBe(true)
  })

  it('keeps a quoted field whole: delimiters, line breaks and doubled quotes inside it', () => {
    const doc = parseCsv('a,"Curie, Marie","diz ""olá""","duas\nlinhas"\n')
    expect(doc.rows).toEqual([['a', 'Curie, Marie', 'diz "olá"', 'duas\nlinhas']])
    expect(doc.quoted[0]).toEqual([false, true, true, true])
  })

  it('treats a quote inside an unquoted field as data', () => {
    expect(parseCsv('12" de tela,b\n').rows).toEqual([['12" de tela', 'b']])
  })

  it('follows the file’s own delimiter and line ending', () => {
    const semi = parseCsv('a;b\r\n1;2\r\n')
    expect(semi.delimiter).toBe(';')
    expect(semi.eol).toBe('\r\n')
    expect(semi.rows).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
    expect(parseCsv('a\tb\n1\t2\n').delimiter).toBe('\t')
  })

  it('notices a BOM and does not leak it into the first field', () => {
    const doc = parseCsv('﻿nome,papel\n')
    expect(doc.bom).toBe(true)
    expect(doc.rows).toEqual([['nome', 'papel']])
  })

  it('is empty for an empty file, not one blank cell', () => {
    const doc = parseCsv('')
    expect(doc.rows).toEqual([])
    expect(columnCount(doc)).toBe(0)
  })

  it('keeps a last row that has no line ending', () => {
    expect(parseCsv('a,b\nc,d').rows).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
  })

  it('keeps a blank line as an empty row', () => {
    expect(parseCsv('a,b\n\nc,d\n').rows).toEqual([['a', 'b'], [''], ['c', 'd']])
  })
})

describe('serializeCsv', () => {
  it('quotes only what would otherwise be misread', () => {
    const doc = parseCsv('a,b\n')
    const edited = setCell(setCell(doc, 0, 0, 'x,y'), 0, 1, 'diz "oi"')
    expect(serializeCsv(edited)).toBe('"x,y","diz ""oi"""\n')
  })

  it('leaves an untouched file byte for byte, unnecessary quotes included', () => {
    const source = '"nome","papel"\r\n"Ada",engenheira\r\n'
    expect(roundTrip(source)).toBe(source)
  })

  it.each([
    ['sem quebra final', 'a,b\nc,d'],
    ['ponto e vírgula', 'a;b;c\n1;2;3\n'],
    ['tabulação', 'a\tb\n1\t2\n'],
    ['campo com quebra de linha', 'a,"duas\nlinhas"\n'],
    ['BOM do Excel', '﻿a,b\n1,2\n'],
    ['linha em branco no meio', 'a,b\n\nc,d\n'],
    ['arquivo vazio', ''],
    ['uma coluna só', 'uma\nduas\n']
  ])('round-trips %s unchanged', (_label, source) => {
    expect(roundTrip(source)).toBe(source)
  })

  it('drops the quoting hint of the cell that was edited, and only that one', () => {
    const doc = parseCsv('"a","b"\n')
    expect(serializeCsv(setCell(doc, 0, 0, 'z'))).toBe('z,"b"\n')
  })
})

describe('row and column edits', () => {
  const doc = parseCsv('nome,papel\nAda,engenheira\nGrace,almirante\n')

  it('sets a cell without touching its neighbours', () => {
    const next = setCell(doc, 1, 1, 'condessa')
    expect(next.rows[1]).toEqual(['Ada', 'condessa'])
    expect(next.rows[2]).toEqual(['Grace', 'almirante'])
  })

  it('pads a short row before writing past its end', () => {
    const short = parseCsv('a\nb,c\n')
    const next = setCell(short, 0, 1, 'novo')
    expect(next.rows[0]).toEqual(['a', 'novo'])
    expect(serializeCsv(next)).toBe('a,novo\nb,c\n')
  })

  it('inserts a blank row as wide as the table, at the position asked for', () => {
    const next = insertRow(doc, 1)
    expect(next.rows[1]).toEqual(['', ''])
    expect(next.rows[2]).toEqual(['Ada', 'engenheira'])
    expect(insertRow(doc, 99).rows).toHaveLength(4)
    expect(insertRow(doc, -3).rows[0]).toEqual(['', ''])
  })

  it('inserts a blank row into an empty document', () => {
    expect(insertRow(parseCsv(''), 0).rows).toEqual([['']])
  })

  it('removes a row', () => {
    const next = removeRow(doc, 0)
    expect(next.rows).toEqual([
      ['Ada', 'engenheira'],
      ['Grace', 'almirante']
    ])
    expect(next.quoted).toHaveLength(2)
  })

  it('inserts a column into every row, short ones included', () => {
    const ragged = parseCsv('a,b\nc\n')
    const next = insertColumn(ragged, 1)
    expect(next.rows).toEqual([
      ['a', '', 'b'],
      ['c', '', '']
    ])
    expect(columnCount(next)).toBe(3)
    expect(insertColumn(ragged, 99).rows[0]).toEqual(['a', 'b', ''])
  })

  it('removes a column from every row', () => {
    const next = removeColumn(doc, 0)
    expect(next.rows).toEqual([['papel'], ['engenheira'], ['almirante']])
    expect(serializeCsv(next)).toBe('papel\nengenheira\nalmirante\n')
  })
})

describe('looksLikeHeader', () => {
  it('accepts a row of distinct, non-numeric labels over data', () => {
    expect(looksLikeHeader(parseCsv('nome,papel\nAda,engenheira\n'))).toBe(true)
  })

  it('rejects a row that carries a number, a blank, or a repeat', () => {
    expect(looksLikeHeader(parseCsv('2024,vendas\n2025,120\n'))).toBe(false)
    expect(looksLikeHeader(parseCsv('nome,\nAda,x\n'))).toBe(false)
    expect(looksLikeHeader(parseCsv('nome,nome\nAda,x\n'))).toBe(false)
  })

  it('rejects a file with nothing under the first row', () => {
    expect(looksLikeHeader(parseCsv('nome,papel\n'))).toBe(false)
    expect(looksLikeHeader(parseCsv(''))).toBe(false)
  })
})

describe('rowStartLines / rowAtLine', () => {
  it('counts one line per row when nothing is wrapped', () => {
    expect(rowStartLines(parseCsv('a\nb\nc\n'))).toEqual([0, 1, 2])
  })

  it('gives a row with an embedded line break the lines it actually occupies', () => {
    const doc = parseCsv('a,b\nc,"duas\nlinhas"\nd,e\n')
    expect(rowStartLines(doc)).toEqual([0, 1, 3])
  })

  it('maps a line back to the row that owns it', () => {
    const starts = [0, 1, 3]
    expect(rowAtLine(starts, 0)).toBe(0)
    expect(rowAtLine(starts, 2)).toBe(1)
    expect(rowAtLine(starts, 3)).toBe(2)
    expect(rowAtLine(starts, 99)).toBe(2)
    expect(rowAtLine([], 4)).toBe(0)
  })
})
