// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import {
  SunIcon,
  MoonIcon,
  IntentBrainstormIcon,
  IntentArchitectureIcon,
  IntentStoryIcon,
  RolePmIcon,
  RoleTechLeadIcon,
  RoleUxIcon,
  RoleQaIcon,
  RoleDevIcon,
  ClipboardIcon,
  LayersIcon,
  BeakerIcon,
  AutomationIcon,
  ReviewIcon,
  PersonaChatIcon,
  GearIcon,
  BoltIcon,
  StopIcon,
  SlashIcon,
  PlugIcon,
  BroadcastIcon,
  TerminalIcon,
  ToolsIcon,
  ZapIcon,
  StatusDotIcon,
  AlertTriangleIcon,
  SourceControlIcon,
  BranchIcon,
  CommitIcon,
  MergeIcon,
  SyncIcon,
  StashIcon,
  CheckCircleIcon,
  DiscardIcon,
  ArrowDownIcon,
  MinusIcon
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

  // role-personalization + agent-selection + chat-controls icons — smoke
  // renders to keep icons.tsx (a gated file) covered even for icons a
  // component suite doesn't happen to select.
  it('renders the role, action, persona and chrome icons', () => {
    for (const Icon of [
      RolePmIcon,
      RoleTechLeadIcon,
      RoleUxIcon,
      RoleQaIcon,
      RoleDevIcon,
      ClipboardIcon,
      LayersIcon,
      BeakerIcon,
      AutomationIcon,
      ReviewIcon,
      PersonaChatIcon,
      GearIcon,
      BoltIcon,
      StopIcon,
      SlashIcon,
      PlugIcon,
      BroadcastIcon,
      TerminalIcon,
      ToolsIcon,
      ZapIcon,
      StatusDotIcon,
      AlertTriangleIcon
    ]) {
      const { container } = render(createElement(Icon, { size: 18 }))
      expect(container.querySelector('svg')).toBeTruthy()
    }
  })

  // git-management (M10) — the source-control glyph set. Direct smoke renders
  // so icons.tsx stays fully covered before the SCM UI suites (T14+) select them.
  it('renders the git / source-control icons', () => {
    for (const Icon of [
      SourceControlIcon,
      BranchIcon,
      CommitIcon,
      MergeIcon,
      SyncIcon,
      StashIcon,
      CheckCircleIcon,
      DiscardIcon,
      ArrowDownIcon,
      MinusIcon
    ]) {
      const { container } = render(createElement(Icon, { size: 18 }))
      expect(container.querySelector('svg')).toBeTruthy()
    }
  })
})
