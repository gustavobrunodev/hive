// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { Markdown } from './markdown'
import { createPathOracle } from '../chat/filePaths'
import { createSkillOracle } from '../chat/commandMentions'

/**
 * Task T1 — Markdown renderer via react-markdown + remark-gfm (design.md §5,
 * context.md C2, UX-R7). Replaces the old hand-rolled `renderMarkdown` unit
 * test (removed alongside the function) — this covers the fidelity gaps that
 * motivated the swap (tables, nested lists, task lists) plus the link
 * click-through bridge (UX-R7.3).
 */
describe('Markdown (T1)', () => {
  beforeEach(() => {
    window.hive = {
      ...window.hive,
      openExternal: vi.fn().mockResolvedValue(undefined)
    } as typeof window.hive
  })

  afterEach(() => {
    cleanup()
  })

  const doc = [
    '# Title',
    '',
    'A [link](https://example.com) in a paragraph.',
    '',
    '| Col A | Col B |',
    '| --- | --- |',
    '| one | two |',
    '',
    '- top',
    '  - nested',
    '',
    '- [ ] todo',
    '- [x] done',
    '',
    '```js',
    'const x = 1',
    '```'
  ].join('\n')

  it('renders a heading, paragraph, link, table, nested list, task list, and code fence', () => {
    render(createElement(Markdown, { source: doc }))

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Title')

    const link = screen.getByRole('link', { name: 'link' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://example.com')

    const table = document.querySelector('table')
    expect(table).not.toBeNull()
    const headerCells = Array.from(table!.querySelectorAll('thead th')).map((el) => el.textContent)
    expect(headerCells).toEqual(['Col A', 'Col B'])
    const bodyCells = Array.from(table!.querySelectorAll('tbody td')).map((el) => el.textContent)
    expect(bodyCells).toEqual(['one', 'two'])

    // Nested list: an <li> containing its own <ul>.
    const topItem = Array.from(document.querySelectorAll('li')).find((li) =>
      li.textContent?.trim().startsWith('top')
    )
    expect(topItem?.querySelector('ul li')?.textContent).toBe('nested')

    // GFM task list: rendered as disabled checkboxes, one checked.
    const checkboxes = Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    ) as HTMLInputElement[]
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes.every((box) => box.disabled)).toBe(true)
    expect(checkboxes.map((box) => box.checked)).toEqual([false, true])

    // Fenced code block.
    const code = document.querySelector('pre code')
    expect(code?.textContent).toBe('const x = 1\n')
  })

  it('clicking a link calls window.hive.openExternal and prevents in-app navigation', () => {
    render(createElement(Markdown, { source: '[go](https://example.com)' }))

    const link = screen.getByRole('link', { name: 'go' })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)

    expect(window.hive.openExternal).toHaveBeenCalledWith('https://example.com')
    expect(event.defaultPrevented).toBe(true)
  })

  // MELHORIA 2: a bare URL an agent writes — not markdown `[text](url)`
  // syntax — must be just as clickable. remark-gfm's autolink-literal
  // extension is what turns it into a real link node before this component
  // ever sees it; this test is what pins that behavior in place.
  it('autolinks a bare URL the agent wrote with no markdown syntax', () => {
    render(
      createElement(Markdown, {
        source: 'A página de resultados está aberta em:\n\nhttps://www.google.com/search?q=botafogo'
      })
    )

    const link = screen.getByRole('link', {
      name: 'https://www.google.com/search?q=botafogo'
    }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://www.google.com/search?q=botafogo')

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(window.hive.openExternal).toHaveBeenCalledWith(
      'https://www.google.com/search?q=botafogo'
    )
  })

  describe('file links in an agent reply (chat-file-links)', () => {
    const files = createPathOracle('/ws', ['src/main/index.ts', 'docs/prd.md'])

    /** Renders with linking wired, returning the spy a click lands on. */
    function renderLinked(source: string): ReturnType<typeof vi.fn> {
      const onOpenPath = vi.fn()
      render(createElement(Markdown, { source, files, onOpenPath }))
      return onOpenPath
    }

    it('makes a path in prose a control that opens the file', () => {
      const onOpenPath = renderLinked('Criei src/main/index.ts com o serviço.')
      const link = screen.getByRole('button', { name: /src\/main\/index\.ts/ })
      link.click()
      expect(onOpenPath).toHaveBeenCalledWith('src/main/index.ts', undefined)
    })

    // Inline code is where agents write paths most of the time; skipping it
    // would leave the common case dead.
    it('links a path written as inline code', () => {
      const onOpenPath = renderLinked('Ajustei o `docs/prd.md` do workspace.')
      screen.getByRole('button', { name: /docs\/prd\.md/ }).click()
      expect(onOpenPath).toHaveBeenCalledWith('docs/prd.md', undefined)
    })

    it('carries the line the agent pointed at', () => {
      const onOpenPath = renderLinked('Veja src/main/index.ts:42.')
      screen.getByRole('button', { name: /src\/main\/index\.ts:42/ }).click()
      expect(onOpenPath).toHaveBeenCalledWith('src/main/index.ts', 42)
    })

    // A fenced block is a listing. Turning half the tokens inside a diff into
    // buttons is noise, not help.
    it('leaves a fenced code block alone', () => {
      renderLinked(['Antes:', '', '```', 'cat src/main/index.ts', '```'].join('\n'))
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('finds a path that markdown split across emphasis boundaries', () => {
      // The reason this runs as a rehype pass and not over React children: by
      // the time a component sees its children the text is already in pieces.
      const onOpenPath = renderLinked('Está em **src/main/index.ts** agora.')
      screen.getByRole('button', { name: /src\/main\/index\.ts/ }).click()
      expect(onOpenPath).toHaveBeenCalledWith('src/main/index.ts', undefined)
    })

    it('leaves an external link an external link', () => {
      renderLinked('Docs em [aqui](https://example.com).')
      const link = screen.getByRole('link', { name: 'aqui' })
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      expect(window.hive.openExternal).toHaveBeenCalledWith('https://example.com')
    })

    // The whole-code-span replacement (wholeCodePath) only fires when the
    // span's content actually resolves; anything else keeps its plate rather
    // than being force-converted.
    it('leaves an inline code span alone when its content is not a real path', () => {
      renderLinked('Rode `algumaCoisaQueNaoExiste` no terminal.')
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('renders paths as plain text when the host has no editor to open them in', () => {
      render(createElement(Markdown, { source: 'Criei src/main/index.ts.' }))
      expect(screen.queryByRole('button')).toBeNull()
      expect(document.body.textContent).toContain('src/main/index.ts')
    })
  })

  describe('skill mentions in an agent reply (chat-command-mentions, MELHORIA 1)', () => {
    const skillCatalog = createSkillOracle([
      { key: 'bmad-party-mode' },
      { key: 'bmad-advanced-elicitation' }
    ])

    /** Renders with command-linking wired, returning the spy a click lands on. */
    function renderRunnable(source: string): ReturnType<typeof vi.fn> {
      const onRunCommand = vi.fn()
      render(createElement(Markdown, { source, skills: skillCatalog, onRunCommand }))
      return onRunCommand
    }

    it('makes a skill mentioned mid-sentence a control that runs it', () => {
      const onRunCommand = renderRunnable(
        'Além disso, você pode sempre invocar /bmad-party-mode se quiser múltiplas perspectivas.'
      )
      screen.getByRole('button', { name: '/bmad-party-mode' }).click()
      expect(onRunCommand).toHaveBeenCalledWith('bmad-party-mode')
    })

    it('links every real skill mentioned in the same reply', () => {
      const onRunCommand = renderRunnable(
        'Invoque /bmad-party-mode ou /bmad-advanced-elicitation para explorar mais.'
      )
      const buttons = screen.getAllByRole('button').map((button) => button.textContent)
      expect(buttons).toEqual(['/bmad-party-mode', '/bmad-advanced-elicitation'])
      screen.getByRole('button', { name: '/bmad-advanced-elicitation' }).click()
      expect(onRunCommand).toHaveBeenCalledWith('bmad-advanced-elicitation')
    })

    it('links a skill written as inline code, normalized to its canonical `/key` label', () => {
      const onRunCommand = renderRunnable('Rode `bmad-party-mode` a qualquer momento.')
      screen.getByRole('button', { name: '/bmad-party-mode' }).click()
      expect(onRunCommand).toHaveBeenCalledWith('bmad-party-mode')
    })

    // Same discipline as the file-link whole-code-span case: the replacement
    // only fires when the span's content actually resolves.
    it('leaves an inline code span alone when its content is not a real skill', () => {
      renderRunnable('Rode `nao-existe` a qualquer momento.')
      expect(screen.queryByRole('button')).toBeNull()
    })

    // The two failure modes of guessing, both of which the oracle makes
    // impossible — same discipline as the file-link oracle above.
    it('never turns something that only looks like a command into a button', () => {
      renderRunnable('Isso é and/or, 3/4 do total, não um comando.')
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('leaves a fenced code block alone', () => {
      renderRunnable(['Antes:', '', '```', 'run /bmad-party-mode', '```'].join('\n'))
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('renders mentions as plain text when the host has no skill catalog loaded', () => {
      render(createElement(Markdown, { source: 'Invoque /bmad-party-mode agora.' }))
      expect(screen.queryByRole('button')).toBeNull()
      expect(document.body.textContent).toContain('/bmad-party-mode')
    })

    it('composes with file links in the same reply', () => {
      const files = createPathOracle('/ws', ['src/main/index.ts'])
      const onOpenPath = vi.fn()
      const onRunCommand = vi.fn()
      render(
        createElement(Markdown, {
          source: 'Editei src/main/index.ts; rode /bmad-party-mode em seguida.',
          files,
          onOpenPath,
          skills: skillCatalog,
          onRunCommand
        })
      )
      screen.getByRole('button', { name: /src\/main\/index\.ts/ }).click()
      expect(onOpenPath).toHaveBeenCalledWith('src/main/index.ts', undefined)
      screen.getByRole('button', { name: '/bmad-party-mode' }).click()
      expect(onRunCommand).toHaveBeenCalledWith('bmad-party-mode')
    })
  })
})
