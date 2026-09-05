// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, useState, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CsvEditor } from './CsvEditor'

/**
 * The CSV table's own suite.
 *
 * `Explorer.test.ts` covers the wiring (a `.csv` opens here, an edit makes the
 * pane dirty, the mode switch says Tabela/Texto). What is tested here is the
 * editor itself: what it does to the *file* when someone adds a row, deletes a
 * column, or decides the first line was data after all.
 *
 * The design system is doubled the same way it is there — the real bundle
 * would load a second React from its own `node_modules` and crash on an
 * invalid hook call — except for `detectDelimiter`, which is the pure function
 * `csv.ts` parses with and must not be re-implemented here.
 */
vi.mock('@hive/design-system', async () => ({
  detectDelimiter: (
    await vi.importActual<typeof import('@hive/design-system')>('@hive/design-system')
  ).detectDelimiter,
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', { type: 'button', ...rest }, children),
  Empty: ({ title, description }: { title?: ReactNode; description?: ReactNode }) =>
    createElement(
      'div',
      null,
      createElement('h2', null, title),
      description ? createElement('p', null, description) : null
    ),
  DataGrid: ({
    columns,
    rows,
    ariaLabel,
    cursor,
    onCursorChange,
    onCellChange,
    empty,
    footer
  }: {
    columns: Array<{ id: string; label: ReactNode; hint?: ReactNode; numeric?: boolean }>
    rows: ReadonlyArray<ReadonlyArray<string>>
    ariaLabel: string
    cursor?: { row: number; column: number }
    onCursorChange?: (next: { row: number; column: number }) => void
    onCellChange?: (row: number, column: number, value: string) => void
    empty?: ReactNode
    footer?: ReactNode
  }) =>
    createElement(
      'div',
      { role: 'grid', 'aria-label': ariaLabel },
      createElement(
        'div',
        { role: 'row' },
        columns.map((column, index) =>
          createElement(
            'span',
            {
              key: column.id,
              role: 'columnheader',
              'data-numeric': column.numeric || undefined,
              onClick: () => onCursorChange?.({ row: cursor?.row ?? 0, column: index })
            },
            column.label,
            column.hint
          )
        )
      ),
      rows.length === 0
        ? empty
        : rows.map((row, rowIndex) =>
            createElement(
              'div',
              { key: rowIndex, role: 'row' },
              columns.map((column, columnIndex) =>
                createElement('input', {
                  key: column.id,
                  'aria-label': `cel ${rowIndex},${columnIndex}`,
                  value: row[columnIndex] ?? '',
                  onClick: () => onCursorChange?.({ row: rowIndex, column: columnIndex }),
                  onChange: (event: { target: { value: string } }) =>
                    onCellChange?.(rowIndex, columnIndex, event.target.value)
                })
              )
            )
          ),
      footer
    ),
  // The menu is always open here: what these tests are about is what each item
  // does to the file, not Radix's open/close (covered in the DS).
  DropdownMenu: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  DropdownMenuContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'menu' }, children),
  DropdownMenuItem: ({
    children,
    onSelect,
    disabled
  }: {
    children?: ReactNode
    onSelect?: () => void
    disabled?: boolean
  }) =>
    createElement(
      'button',
      { type: 'button', role: 'menuitem', disabled, onClick: () => onSelect?.() },
      children
    ),
  DropdownMenuSeparator: () => createElement('hr')
}))

/** The pane's half of the contract: it owns the text, the editor reports edits. */
function Harness({ initial, initialLine }: { initial: string; initialLine?: number }): ReactNode {
  const [value, setValue] = useState(initial)
  return createElement(
    'div',
    null,
    createElement(CsvEditor, {
      value,
      onChange: setValue,
      fileName: 'vendas.csv',
      onOpenText: () => {},
      initialLine
    }),
    createElement('output', null, value)
  )
}

/** The text the pane would save right now. */
function saved(): string {
  return (document.querySelector('output') as HTMLElement).textContent ?? ''
}

function menuItem(name: RegExp | string): HTMLElement {
  return within(screen.getByRole('menu')).getByRole('menuitem', { name })
}

const SAMPLE = 'produto,total\ncaneta,12\nlivro,40\n'

describe('CsvEditor', () => {
  afterEach(cleanup)

  it('reads the first row as the header when it looks like one', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    expect(screen.getByRole('columnheader', { name: /produto/ })).toBeTruthy()
    expect(screen.getByText('2 linhas × 2 colunas')).toBeTruthy()
    // The letters stay available even with names: they are how you say
    // "column B" to someone looking at the same file in Excel.
    expect(screen.getByRole('columnheader', { name: /total.*B/s })).toBeTruthy()
  })

  it('turning the header off gives the columns letters and the row back', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByRole('button', { name: 'Cabeçalho' }))

    expect(screen.getByRole('columnheader', { name: 'A' })).toBeTruthy()
    expect(screen.getByText('3 linhas × 2 colunas')).toBeTruthy()
    expect((screen.getByLabelText('cel 0,0') as HTMLInputElement).value).toBe('produto')
  })

  it('says which separator the file uses, in the product’s own words', () => {
    render(createElement(Harness, { initial: 'a;b\n1;2\n' }))
    expect(screen.getByText('separado por ponto e vírgula')).toBeTruthy()
    cleanup()

    render(createElement(Harness, { initial: 'a\tb\n1\t2\n' }))
    expect(screen.getByText('separado por tabulação')).toBeTruthy()
    cleanup()

    render(createElement(Harness, { initial: 'a|b\n1|2\n' }))
    expect(screen.getByText('separado por barra vertical')).toBeTruthy()
  })

  it('right-aligns a column that holds only numbers, and leaves the rest alone', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    expect(screen.getByRole('columnheader', { name: /produto/ }).dataset.numeric).toBeUndefined()
    expect(screen.getByRole('columnheader', { name: /total/ }).dataset.numeric).toBe('true')
  })

  it('inserts a row below the cursor and puts the cursor in it', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 0,0'))
    fireEvent.click(screen.getByRole('button', { name: 'Inserir linha abaixo' }))

    expect(saved()).toBe('produto,total\ncaneta,12\n,\nlivro,40\n')
  })

  it('inserts a column to the right of the cursor, in every row', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 0,0'))
    fireEvent.click(screen.getByRole('button', { name: 'Inserir coluna à direita' }))

    expect(saved()).toBe('produto,,total\ncaneta,,12\nlivro,,40\n')
  })

  it('the menu names the row and the column it would act on', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 1,1'))

    expect(menuItem('Excluir a linha 2')).toBeTruthy()
    expect(menuItem('Excluir a coluna total')).toBeTruthy()
  })

  it('deletes the row under the cursor, counting past the header', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 0,0'))
    fireEvent.click(menuItem(/Excluir a linha/))

    expect(saved()).toBe('produto,total\nlivro,40\n')
  })

  it('deletes the column under the cursor, and refuses to delete the last one', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 0,1'))
    fireEvent.click(menuItem(/Excluir a coluna/))
    expect(saved()).toBe('produto\ncaneta\nlivro\n')

    // One column left: deleting it would leave a file with no columns at all.
    expect((menuItem(/Excluir a coluna/) as HTMLButtonElement).disabled).toBe(true)
  })

  it('inserts a column before the cursor from the menu', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 0,1'))
    fireEvent.click(menuItem('Inserir coluna à esquerda'))

    expect(saved()).toBe('produto,,total\ncaneta,,12\nlivro,,40\n')
  })

  it('inserts a row above the cursor from the menu', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 1,0'))
    fireEvent.click(menuItem('Inserir linha acima'))

    expect(saved()).toBe('produto,total\ncaneta,12\n,\nlivro,40\n')
  })

  it('renames a column in place, writing the header cell', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 0,1'))
    fireEvent.click(menuItem(/Renomear a coluna/))

    const field = screen.getByLabelText('Nome da coluna')
    fireEvent.change(field, { target: { value: 'receita' } })
    fireEvent.keyDown(field, { key: 'Enter' })

    expect(saved()).toBe('produto,receita\ncaneta,12\nlivro,40\n')
    expect(screen.queryByLabelText('Nome da coluna')).toBeNull()
  })

  it('Escape leaves the column name as it was', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 0,1'))
    fireEvent.click(menuItem(/Renomear a coluna/))

    const field = screen.getByLabelText('Nome da coluna')
    fireEvent.change(field, { target: { value: 'receita' } })
    fireEvent.keyDown(field, { key: 'Escape' })

    expect(saved()).toBe(SAMPLE)
  })

  it('commits a rename on blur, the way every inline edit here does', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 0,1'))
    fireEvent.click(menuItem(/Renomear a coluna/))

    const field = screen.getByLabelText('Nome da coluna')
    fireEvent.change(field, { target: { value: 'receita' } })
    fireEvent.blur(field)

    expect(saved()).toBe('produto,receita\ncaneta,12\nlivro,40\n')
  })

  it('offers no rename when there is no header row to write into', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByRole('button', { name: 'Cabeçalho' }))
    expect(
      within(screen.getByRole('menu')).queryByRole('menuitem', { name: /Renomear/ })
    ).toBeNull()
  })

  it('teaches the empty file instead of showing it an empty grid', () => {
    render(createElement(Harness, { initial: '' }))
    expect(screen.getByText('Planilha vazia')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Nova linha/ }))
    // One blank row — a file of one empty field, which is the first thing to
    // type into. It has to actually reach the draft: a row that serializes
    // back to zero bytes is a button that does nothing.
    expect(saved()).toBe('\n')
    expect(screen.getByLabelText('cel 0,0')).toBeTruthy()
  })

  it('appends from the footer, at the end, whatever the cursor was doing', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 0,0'))
    fireEvent.click(screen.getByRole('button', { name: /Nova linha/ }))

    expect(saved()).toBe('produto,total\ncaneta,12\nlivro,40\n,\n')
  })

  it('writes an edited cell back through the header offset', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.change(screen.getByLabelText('cel 1,1'), { target: { value: '41' } })
    expect(saved()).toBe('produto,total\ncaneta,12\nlivro,41\n')
  })

  it('opens on the record the reader was on in the text', () => {
    render(createElement(Harness, { initial: SAMPLE, initialLine: 3 }))
    // Line 3 of the file is the second body row (the header took line 1).
    fireEvent.click(menuItem(/Excluir a linha/))
    expect(saved()).toBe('produto,total\ncaneta,12\n')
  })

  it('steps aside for the text editor when the file is too big to paint', () => {
    const huge = ['a,b', ...Array.from({ length: 5001 }, (_, index) => `${index},x`)].join('\n')
    const onOpenText = vi.fn()
    render(
      createElement(CsvEditor, {
        value: huge,
        onChange: () => {},
        fileName: 'grande.csv',
        onOpenText
      })
    )

    expect(screen.getByText('Planilha grande demais para a tabela')).toBeTruthy()
    expect(screen.queryByRole('grid')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir como texto' }))
    expect(onOpenText).toHaveBeenCalled()
  })

  it('keeps the cursor inside the table when rows are deleted out from under it', () => {
    render(createElement(Harness, { initial: SAMPLE }))
    fireEvent.click(screen.getByLabelText('cel 1,0'))
    fireEvent.click(menuItem(/Excluir a linha/))
    fireEvent.click(menuItem(/Excluir a linha/))

    // Both body rows gone; the menu must still be describing a real row rather
    // than pointing past the end of the file.
    expect(saved()).toBe('produto,total\n')
    expect(menuItem(/Excluir a linha 1/)).toBeTruthy()
  })
})
