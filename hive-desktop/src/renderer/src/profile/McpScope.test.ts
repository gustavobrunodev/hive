// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { McpScope } from './McpScope'

afterEach(cleanup)

it('shows the workspace server count and opens the existing manager', () => {
  const onOpen = vi.fn()
  render(createElement(McpScope, { count: 2, onOpen }))
  expect(screen.getByText(/2 servidores/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Servidores MCP' }))
  expect(onOpen).toHaveBeenCalledOnce()
})

it('keeps an unknown count in its loading state and omits an unwired action', () => {
  const view = render(createElement(McpScope, { count: null }))
  expect(view.container.querySelector('.hds-skeleton')).not.toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})
