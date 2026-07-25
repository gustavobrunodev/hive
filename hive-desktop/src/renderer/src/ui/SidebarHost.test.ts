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
  const review = createElement('div', { 'data-testid': 'review-body' }, 'agent review')

  it('renders the Explorer body and not the SCM/review bodies when activeView is explorer', () => {
    render(createElement(SidebarHost, { activeView: 'explorer', explorer, scm, review }))
    expect(screen.getByTestId('explorer-body')).toBeTruthy()
    expect(screen.queryByTestId('scm-body')).toBeNull()
    expect(screen.queryByTestId('review-body')).toBeNull()
  })

  it('renders the SCM body and not the others when activeView is scm', () => {
    render(createElement(SidebarHost, { activeView: 'scm', explorer, scm, review }))
    expect(screen.getByTestId('scm-body')).toBeTruthy()
    expect(screen.queryByTestId('explorer-body')).toBeNull()
    expect(screen.queryByTestId('review-body')).toBeNull()
  })

  it('renders the Revisão body and not the others when activeView is review', () => {
    render(createElement(SidebarHost, { activeView: 'review', explorer, scm, review }))
    expect(screen.getByTestId('review-body')).toBeTruthy()
    expect(screen.queryByTestId('explorer-body')).toBeNull()
    expect(screen.queryByTestId('scm-body')).toBeNull()
  })
})
