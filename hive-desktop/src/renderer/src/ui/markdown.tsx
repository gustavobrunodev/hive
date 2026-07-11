import { createElement, type ReactNode } from 'react'

/**
 * Minimal markdown-to-readable-JSX transform for `.md` file preview (task
 * T12, design.md §4 "File viewer" — "`.md` readable render").
 *
 * Neither `@hive/design-system` (checked `dist/index.d.ts` — no exported
 * markdown component) nor either `package.json` in this monorepo
 * (`design-system/package.json`, `hive-desktop/package.json`) ships a
 * markdown renderer (no `react-markdown`/`remark`/`marked`/etc.), so this
 * hand-rolled line-based transform is used instead of reaching for a new npm
 * dependency, per T12's constraints.
 *
 * It's a deliberately small subset: ATX headings (`#`…`######`), unordered
 * (`-`/`*`) and ordered (`1.`/`1)`) list items, `>` blockquotes, fenced
 * code blocks (```), inline `` `code` `` and `**bold**`, and paragraphs.
 * No AST, no nested/mixed inline emphasis, no links/images/tables/nested
 * lists. This is
 * "readable form" for MVP scope — BMAD-produced artifacts (PRDs, specs,
 * task lists) are mostly headings/lists/code/prose — not a spec-compliant
 * CommonMark renderer. If `.md` viewing grows real requirements (nested
 * lists, tables, links), swapping in a real dependency
 * (`react-markdown` + `remark-gfm`) would be the right call at that point —
 * flagged here rather than silently worked around.
 */
export function renderMarkdown(source: string): ReactNode[] {
  const lines = source.split('\n')
  const blocks: ReactNode[] = []
  const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

  let index = 0
  let key = 0
  let listBuffer: string[] = []
  let orderedBuffer: string[] = []
  let quoteBuffer: string[] = []
  let paragraphBuffer: string[] = []

  function flushList(): void {
    if (listBuffer.length === 0) return
    blocks.push(
      createElement(
        'ul',
        { key: `ul-${key++}` },
        listBuffer.map((item, itemIndex) =>
          createElement('li', { key: itemIndex }, renderInline(item))
        )
      )
    )
    listBuffer = []
  }

  function flushOrdered(): void {
    if (orderedBuffer.length === 0) return
    blocks.push(
      createElement(
        'ol',
        { key: `ol-${key++}` },
        orderedBuffer.map((item, itemIndex) =>
          createElement('li', { key: itemIndex }, renderInline(item))
        )
      )
    )
    orderedBuffer = []
  }

  function flushQuote(): void {
    if (quoteBuffer.length === 0) return
    blocks.push(
      createElement(
        'blockquote',
        { key: `bq-${key++}` },
        createElement('p', null, renderInline(quoteBuffer.join(' ')))
      )
    )
    quoteBuffer = []
  }

  function flushParagraph(): void {
    if (paragraphBuffer.length === 0) return
    blocks.push(createElement('p', { key: `p-${key++}` }, renderInline(paragraphBuffer.join(' '))))
    paragraphBuffer = []
  }

  while (index < lines.length) {
    const line = lines[index]

    if (/^```/.test(line)) {
      flushList()
      flushOrdered()
      flushQuote()
      flushParagraph()
      const codeLines: string[] = []
      index++
      while (index < lines.length && !/^```/.test(lines[index])) {
        codeLines.push(lines[index])
        index++
      }
      index++ // skip the closing fence (or the end of input if unterminated)
      blocks.push(
        createElement(
          'pre',
          { key: `code-${key++}`, className: 'hds-markdown-code' },
          createElement('code', null, codeLines.join('\n'))
        )
      )
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line)
    if (headingMatch) {
      flushList()
      flushOrdered()
      flushQuote()
      flushParagraph()
      const level = headingMatch[1].length
      blocks.push(
        createElement(headingTags[level - 1], { key: `h-${key++}` }, renderInline(headingMatch[2]))
      )
      index++
      continue
    }

    const listMatch = /^\s*[-*]\s+(.*)$/.exec(line)
    if (listMatch) {
      flushOrdered()
      flushQuote()
      flushParagraph()
      listBuffer.push(listMatch[1])
      index++
      continue
    }

    const orderedMatch = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (orderedMatch) {
      flushList()
      flushQuote()
      flushParagraph()
      orderedBuffer.push(orderedMatch[1])
      index++
      continue
    }

    const quoteMatch = /^>\s?(.*)$/.exec(line)
    if (quoteMatch) {
      flushList()
      flushOrdered()
      flushParagraph()
      quoteBuffer.push(quoteMatch[1])
      index++
      continue
    }

    if (line.trim() === '') {
      flushList()
      flushOrdered()
      flushQuote()
      flushParagraph()
      index++
      continue
    }

    flushList()
    flushOrdered()
    flushQuote()
    paragraphBuffer.push(line)
    index++
  }

  flushList()
  flushOrdered()
  flushQuote()
  flushParagraph()

  return blocks
}

/** Handles inline `**bold**` and `` `code` `` spans within a single markdown line/paragraph. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(createElement('strong', { key: key++ }, token.slice(2, -2)))
    } else {
      nodes.push(createElement('code', { key: key++ }, token.slice(1, -1)))
    }
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}
