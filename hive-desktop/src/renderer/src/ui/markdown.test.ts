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

  /**
   * A reply that answers with a block — extracted text, a config, a command —
   * is answering with something the user is about to take somewhere else, and
   * hand-selecting it out of a scrolling transcript is what made that answer
   * expensive. Every fence carries its own copy control (DS `CodeFence`).
   */
  describe('the copy control on a fenced block', () => {
    beforeEach(() => {
      window.hive = {
        ...window.hive,
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
          readText: vi.fn().mockResolvedValue('')
        }
      } as typeof window.hive
    })

    it('copies the fence source verbatim — not the DOM text, which loses the newlines', async () => {
      render(
        createElement(Markdown, {
          source: ['```json', '{', '  "a": 1', '}', '```'].join('\n')
        })
      )

      screen.getByRole('button', { name: 'Copiar' }).click()

      // Byte-for-byte the fence's own text. Reading `textContent` off the
      // rendered block would have put a space at every element boundary, and
      // walking React children would have dropped the line breaks between
      // sibling spans — either way, JSON that no longer parses.
      expect(window.hive.clipboard.writeText).toHaveBeenCalledWith('{\n  "a": 1\n}')
    })

    it('names the language the fence was opened with', () => {
      render(createElement(Markdown, { source: '```bash\nnpm run verify\n```' }))
      expect(document.querySelector('.hds-fence-lang')?.textContent).toBe('bash')
    })

    it('still offers the control on an untagged fence, and keeps the scroll-sync anchor', () => {
      render(createElement(Markdown, { source: '```\nsem linguagem\n```' }))

      expect(screen.getByRole('button', { name: 'Copiar' })).not.toBeNull()
      expect(document.querySelector('.hds-fence-lang')).toBeNull()
      // `data-line` is what the edit ⇄ preview scroll sync steers by
      // (`explorer/scrollSync.ts`); a fence that lost it would be a hole in
      // the crossing exactly where the tallest blocks are.
      expect(document.querySelector('.hds-fence')?.getAttribute('data-line')).toBe('1')
    })

    // An empty fence still renders a block: the header is what says one is
    // there, and a control that copies nothing is honest about it. The case
    // also covers the source reader's "no text node under this pre" fallback,
    // which is the only shape react-markdown can produce that has none.
    it('renders an empty fence without breaking, and copies nothing from it', () => {
      render(createElement(Markdown, { source: '```\n```' }))

      const button = screen.getByRole('button', { name: 'Copiar' })
      button.click()
      expect(window.hive.clipboard.writeText).toHaveBeenCalledWith('')
    })

    it('goes through the Electron bridge, which is the only clipboard this window has', async () => {
      render(createElement(Markdown, { source: '```\nx\n```' }))
      screen.getByRole('button', { name: 'Copiar' }).click()
      // `navigator.clipboard` is denied by the session's permission handler —
      // every copy in this app routes through `ui/clipboard.ts`.
      expect(window.hive.clipboard.writeText).toHaveBeenCalledWith('x')
    })
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
    // buttons is noise, not help. The fence's own copy control is a different
    // thing — it acts on the block, not on a token inside it — so the
    // assertion is about path links specifically, not about buttons at large.
    it('leaves a fenced code block alone', () => {
      renderLinked(['Antes:', '', '```', 'cat src/main/index.ts', '```'].join('\n'))
      expect(document.querySelector('.wb-pathlink')).toBeNull()
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
      // Same as the file-link suite: the fence's copy control is not a command
      // chip, and asserting "no buttons" would have been asserting the absence
      // of a feature rather than the presence of this rule.
      expect(document.querySelector('.wb-cmdlink')).toBeNull()
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
