// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToolActivityFeed } from './ToolActivityFeed'
import type { ToolActivity } from './toolActivity'

afterEach(cleanup)

function activityOf(over: Partial<ToolActivity> = {}): ToolActivity {
  return {
    id: 't1',
    name: 'Bash',
    detail: 'npm run verify',
    state: 'ok',
    seq: 0,
    startedAt: 0,
    endedAt: 4200,
    params: [{ key: 'command', value: 'npm run verify', block: true }],
    output: { text: '✓ typecheck\n✓ lint\n✓ 1614 testes', lines: 3 },
    ...over
  }
}

function feed(activities: ToolActivity[], live = false): void {
  render(createElement(ToolActivityFeed, { activities, live, now: 5000 }))
}

/** The row's own disclosure button. */
function row(name = /Rodou/): HTMLElement {
  return screen.getByRole('button', { name })
}

describe('ToolActivityFeed — the row as a disclosure (agent-tool-details)', () => {
  it('makes a step with a record behind it openable', () => {
    feed([activityOf()])
    expect(row().getAttribute('aria-expanded')).toBe('false')
  })

  it('leaves a step with nothing behind it as a plain status line', () => {
    feed([activityOf({ params: undefined, output: undefined })])
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('keeps the row’s own words as the button’s name, not "ver detalhes"', () => {
    feed([activityOf()])
    expect(row().textContent).toContain('npm run verify')
  })

  it('starts closed, so a turn of forty steps is not a wall of output', () => {
    feed([activityOf()])
    expect(screen.queryByText(/1614 testes/)).toBeNull()
  })

  it('opens the call and the result on click', () => {
    feed([activityOf()])
    fireEvent.click(row())
    expect(row().getAttribute('aria-expanded')).toBe('true')
    // The call is named by its own argument label, not by a section heading.
    expect(screen.getByText('Comando')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Chamada' })).toBeTruthy()
    expect(screen.getByText('Resultado')).toBeTruthy()
    expect(screen.getByText(/1614 testes/)).toBeTruthy()
  })

  it('closes again, so a row the user opened is a row they can put away', () => {
    feed([activityOf()])
    fireEvent.click(row())
    fireEvent.click(row())
    expect(screen.queryByText('Comando')).toBeNull()
  })

  it('shows the whole command, not the one truncated line the row carries', () => {
    const command = 'set -e\ncd hive-desktop\nnpm run verify'
    feed([
      activityOf({ detail: 'set -e', params: [{ key: 'command', value: command, block: true }] })
    ])
    fireEvent.click(screen.getByRole('button', { name: /set -e/ }))
    expect(document.querySelector('.hds-out-body code')?.textContent).toBe(command)
  })

  it('says a tool argument in pt-BR while keeping the CLI’s own name as its tooltip', () => {
    feed([
      activityOf({
        params: [
          { key: 'command', value: 'ls', block: true },
          { key: 'timeout', value: '120000' }
        ]
      })
    ])
    fireEvent.click(row())
    expect(screen.getByText('Tempo limite').getAttribute('title')).toBe('timeout')
  })

  it('passes an argument it has no translation for through unchanged', () => {
    feed([activityOf({ params: [{ key: 'selector', value: '#save' }] })])
    fireEvent.click(row())
    expect(screen.getByText('selector')).toBeTruthy()
  })

  it('shows the error text of a failed step, which is what a failure row could never say', () => {
    feed([activityOf({ state: 'failed', output: { text: 'npm ERR! exit status 1', lines: 1 } })])
    fireEvent.click(screen.getByRole('button', { name: /Rodou/ }))
    expect(screen.getByText('npm ERR! exit status 1')).toBeTruthy()
  })

  it('says so when a tool answered with nothing, rather than drawing an empty frame', () => {
    feed([activityOf({ output: { text: '', lines: 0 } })])
    fireEvent.click(row())
    expect(screen.getByText('A ferramenta não retornou conteúdo.')).toBeTruthy()
  })

  it('shows a skeleton while the result is still on its way', () => {
    const { container } = render(
      createElement(ToolActivityFeed, {
        activities: [activityOf({ state: 'running', endedAt: undefined, output: undefined })],
        live: true,
        now: 5000
      })
    )
    fireEvent.click(screen.getByRole('button', { name: /Rodando/ }))
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByText('Executando…')).toBeTruthy()
  })

  it('warns on the row when a result was cut in transport', () => {
    feed([activityOf({ output: { text: 'x', lines: 900, truncated: 120 } })])
    fireEvent.click(row())
    expect(screen.getByText('120 caracteres não exibidos')).toBeTruthy()
  })

  it('puts the result’s size on the closed row, so a step can be judged unopened', () => {
    feed([activityOf({ output: { text: 'a\nb\nc', lines: 3 } })])
    expect(document.querySelector('.wb-activity-lines')?.textContent).toBe('3 linhas')
  })

  it('leaves the size chip off a row whose diffstat already says how much', () => {
    feed([
      activityOf({
        name: 'Edit',
        patch: { op: 'edit', path: '/ws/a.ts', adds: 2, dels: 1, anchored: true, hunks: [] },
        output: { text: 'ok', lines: 1 }
      })
    ])
    expect(document.querySelector('.wb-activity-lines')).toBeNull()
    expect(screen.getByText('+2')).toBeTruthy()
  })

  it('opens a patch by default — a change nobody expanded is a change nobody reviewed', () => {
    feed([
      activityOf({
        name: 'Edit',
        detail: '/ws/a.ts',
        params: [{ key: 'file_path', value: '/ws/a.ts' }],
        patch: {
          op: 'edit',
          path: '/ws/a.ts',
          adds: 1,
          dels: 0,
          anchored: true,
          hunks: [{ lines: [{ type: 'add', text: 'const a = 1', no: 1 }] }]
        }
      })
    ])
    expect(screen.getByText('const a = 1')).toBeTruthy()
    // The diff already names the file, so the lone `file_path` argument that
    // merely repeats it is dropped rather than restated under a heading.
    expect(screen.queryByRole('group', { name: 'Chamada' })).toBeNull()
    expect(screen.getByText('Resultado')).toBeTruthy()
  })

  it('remembers each row’s own disclosure rather than opening them together', () => {
    feed([activityOf(), activityOf({ id: 't2', detail: 'npm run lint' })])
    fireEvent.click(screen.getByRole('button', { name: /npm run verify/ }))
    expect(screen.getAllByText('Comando')).toHaveLength(1)
  })

  it('copies the result through the app’s bridge, never navigator.clipboard', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    // @ts-expect-error — the bridge is injected by preload at runtime.
    window.hive = { clipboard: { writeText } }
    feed([activityOf()])
    fireEvent.click(row())
    fireEvent.click(screen.getAllByRole('button', { name: 'Copiar' })[1])
    expect(writeText).toHaveBeenCalledWith('✓ typecheck\n✓ lint\n✓ 1614 testes')
    // @ts-expect-error — cleanup.
    delete window.hive
  })
})
