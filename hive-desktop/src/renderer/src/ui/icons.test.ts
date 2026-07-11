// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import {
  SunIcon,
  MoonIcon,
  IntentBrainstormIcon,
  IntentArchitectureIcon,
  IntentStoryIcon
} from './icons'

/**
 * T10 (file-management regression pass) — `icons.tsx` is one of this
 * feature's gated files (design.md §"Coverage config note": 90/90/90/90 on
 * every touched file). Most of its icons are exercised indirectly through
 * Explorer.test.ts (the file-management UI); a handful predate/sit outside
 * file-management (theme toggle icons used by `WorkUI`, intent icons used by
 * `IntentGrid` for keys no existing suite selects) and weren't reached by any
 * suite. Direct smoke renders of those exports only — no app component
 * touched — purely to close that gate.
 */
describe('icons — theme + intent icons not exercised by feature UI suites', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders SunIcon and MoonIcon (theme toggle icons)', () => {
    const { container: sun } = render(createElement(SunIcon))
    expect(sun.querySelector('svg')).toBeTruthy()

    const { container: moon } = render(createElement(MoonIcon, { size: 20 }))
    expect(moon.querySelector('svg')).toBeTruthy()
  })

  it('renders the intent icons for keys not covered by Chat.test.ts (brainstorm/architecture/story)', () => {
    const { container: brainstorm } = render(createElement(IntentBrainstormIcon))
    expect(brainstorm.querySelector('svg')).toBeTruthy()

    const { container: architecture } = render(createElement(IntentArchitectureIcon))
    expect(architecture.querySelector('svg')).toBeTruthy()

    const { container: story } = render(createElement(IntentStoryIcon))
    expect(story.querySelector('svg')).toBeTruthy()
  })
})
