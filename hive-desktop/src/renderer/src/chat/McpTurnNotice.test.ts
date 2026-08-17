// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { McpTurnNotice } from './McpTurnNotice'
import type { McpServerReport } from './turnTimeline'

/**
 * mcp-visibility: the handshake row inside a turn. What matters here is that
 * the row tells the truth in its *words* and not only in its colour — a status
 * carried by a dot alone is invisible to a screen reader and to anyone reading
 * a screenshot, which is most of how this row gets looked at.
 */

const server = (over: Partial<McpServerReport> = {}): McpServerReport => ({
  name: 'playwright',
  status: 'connected',
  tools: ['browser_navigate'],
  ...over
})

afterEach(cleanup)

describe('McpTurnNotice', () => {
  it('counts the servers when they all came up', () => {
    render(
      createElement(McpTurnNotice, {
        servers: [server(), server({ name: 'pencil' })]
      })
    )
    expect(screen.getByText('2 servidores MCP conectados')).toBeTruthy()
    expect(screen.getByText('playwright')).toBeTruthy()
    expect(screen.getByText('pencil')).toBeTruthy()
  })

  it('names the one server that failed instead of counting', () => {
    render(
      createElement(McpTurnNotice, {
        servers: [server(), server({ name: 'broken', status: 'failed', tools: [] })]
      })
    )
    expect(screen.getByText('broken não conectou')).toBeTruthy()
    expect(document.querySelector('.wb-mcpturn')?.hasAttribute('data-trouble')).toBe(true)
  })

  it('counts when more than one is in trouble', () => {
    render(
      createElement(McpTurnNotice, {
        servers: [
          server({ name: 'a', status: 'failed' }),
          server({ name: 'b', status: 'needs-auth' }),
          server({ name: 'c' })
        ]
      })
    )
    expect(screen.getByText('2 servidores MCP não conectaram')).toBeTruthy()
  })

  it('shows a tool count per server, and none when the server exposes nothing', () => {
    render(
      createElement(McpTurnNotice, {
        servers: [server({ tools: ['a', 'b', 'c'] }), server({ name: 'empty', tools: [] })]
      })
    )
    const counts = Array.from(document.querySelectorAll('.wb-mcpturn-count')).map(
      (node) => node.textContent
    )
    expect(counts).toEqual(['3'])
  })

  it('is a button into the console when there is a console to open', () => {
    const onOpenConsole = vi.fn()
    render(createElement(McpTurnNotice, { servers: [server()], onOpenConsole }))
    const button = screen.getByRole('button')
    // The narrated label carries the whole row, not just "MCP".
    expect(button.getAttribute('aria-label')).toContain('playwright, 1 ferramenta')
    fireEvent.click(button)
    expect(onOpenConsole).toHaveBeenCalled()
  })

  it('degrades to a plain note where there is nothing to open', () => {
    render(createElement(McpTurnNotice, { servers: [server()] }))
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('note')).toBeTruthy()
  })
})
