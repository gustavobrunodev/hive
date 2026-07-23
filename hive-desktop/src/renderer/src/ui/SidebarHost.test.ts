// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { SidebarHost } from './SidebarHost'

afterEach(() => {
  cleanup()
})

describe('SidebarHost', () => {
  const explorer = createElement('div', { 'data-testid': 'explorer-body' }, 'tree')
  const scm = createElement('div', { 'data-testid': 'scm-body' }, 'source control')

  it('renders the Explorer body and not the SCM body when activeView is explorer', () => {
    render(createElement(SidebarHost, { activeView: 'explorer', explorer, scm }))
    expect(screen.getByTestId('explorer-body')).toBeTruthy()
    expect(screen.queryByTestId('scm-body')).toBeNull()
  })

  it('renders the SCM body and not the Explorer body when activeView is scm', () => {
    render(createElement(SidebarHost, { activeView: 'scm', explorer, scm }))
    expect(screen.getByTestId('scm-body')).toBeTruthy()
    expect(screen.queryByTestId('explorer-body')).toBeNull()
  })
})
