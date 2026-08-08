// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createContext,
  createElement,
  forwardRef,
  Fragment,
  useContext,
  useImperativeHandle,
  isValidElement,
  cloneElement,
  type ReactElement,
  type ReactNode
} from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createHiveGitMock } from './testSupport/hiveGitMock'
import { createHiveSecondBrainMock, FRESH_HEALTH } from './testSupport/hiveSecondBrainMock'
import type { VaultHealth } from './secondBrain/useSecondBrain'
import { makeStatus } from './testSupport/gitStoreMock'
import { createHiveMcpLogsMock } from './testSupport/hiveMcpLogsMock'
import type { McpLogEntry } from './mcpLogs/logConsole'

/**
 * Task T11 — resizable file-area divider + persistence (design.md §7,
 * UX-R6.1/6.2/6.3).
 *
 * `WorkUI` wraps its whole body in one DS `Resizable` group (rail/chat/
 * viewer panels keyed by stable `id`s) and persists the group's layout to
 * `localStorage['hive.workLayout']` via `onLayoutChanged`, restoring it on
 * mount via `defaultLayout`. This suite proves that persistence contract in
 * isolation from the real `react-resizable-panels` drag mechanics (covered
 * by the DS's own `Resizable.test.tsx` and by the Playwright MCP pass in
 * T14): `@hive/design-system` is mocked with a trivial stand-in that
 * captures the `defaultLayout` it was given and lets the test fire
 * `onLayoutChanged` directly, and `./explorer/Explorer` / `./chat/Chat` are
 * mocked to trivial markers (same approach as `App.test.ts` mocking
 * `WorkUI` itself) since this task only touches the layout wiring, not
 * those panes' own behavior.
 */

const resizableProps: {
  defaultLayout?: unknown
  onLayoutChanged?: (layout: Record<string, number>, meta: { isUserInteraction: boolean }) => void
} = {}

/** Minimal context bridge so the mocked `DropdownMenuTrigger` can toggle its sibling `DropdownMenu`'s open state — mirrors the same pattern already used in `explorer/Explorer.test.ts` (real Radix does this internally; nothing else here needs to know about it). */
const DropdownMenuMockCtx = createContext<{ onOpenChange?: (open: boolean) => void }>({})
/** multi-agent: bridges the mocked radio group's onValueChange to its items. */
const RadioGroupMockCtx = createContext<{
  value?: string
  onValueChange?: (value: string) => void
}>({})

/** Same bridge for the session-history Popover (the chat pane header mounts the real `SessionHistory`, which rides DS `Popover`). */
const PopoverMockCtx = createContext<{ onOpenChange?: (open: boolean) => void }>({})

vi.mock('@hive/design-system', () => ({
  Resizable: ({
    children,
    defaultLayout,
    onLayoutChanged
  }: {
    children?: ReactNode
    defaultLayout?: unknown
    onLayoutChanged?: (layout: Record<string, number>, meta: { isUserInteraction: boolean }) => void
  }) => {
    resizableProps.defaultLayout = defaultLayout
    resizableProps.onLayoutChanged = onLayoutChanged
    return createElement(
      'div',
      { 'data-testid': 'resizable' },
      createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'simulate-drag',
          onClick: () =>
            onLayoutChanged?.({ rail: 30, chat: 45, viewer: 25 }, { isUserInteraction: true })
        },
        'drag'
      ),
      children
    )
  },
  ResizablePanel: ({
    children,
    id,
    ...rest
  }: {
    children?: ReactNode
    id?: string
    minSize?: number
    maxSize?: number
    defaultSize?: number
  }) => {
    // minSize/maxSize/defaultSize are DS-only sizing hints, not valid DOM attributes.
    delete rest.minSize
    delete rest.maxSize
    delete rest.defaultSize
    return createElement('div', { 'data-testid': `panel-${id}`, ...rest }, children)
  },
  ResizableHandle: ({ withGrip, ...rest }: { withGrip?: boolean }) => {
    // `withGrip` is a DS-only styling prop — not a valid DOM attribute.
    void withGrip
    return createElement('div', { role: 'separator', ...rest })
  },
  Logo: () => createElement('span', { 'data-testid': 'logo' }),
  DropdownMenu: ({
    onOpenChange,
    children
  }: {
    onOpenChange?: (open: boolean) => void
    children?: ReactNode
  }) => createElement(DropdownMenuMockCtx.Provider, { value: { onOpenChange } }, children),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => {
    const ctx = useContext(DropdownMenuMockCtx)
    if (!isValidElement(children)) return children
    const element = children as ReactElement<{ onClick?: (event: unknown) => void }>
    return cloneElement(element, {
      onClick: (event: unknown) => {
        element.props.onClick?.(event)
        ctx.onOpenChange?.(true)
      }
    })
  },
  DropdownMenuContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'menu' }, children),
  DropdownMenuItem: ({
    children,
    onSelect,
    title
  }: {
    children?: ReactNode
    onSelect?: () => void
    title?: string
  }) =>
    createElement(
      'button',
      { type: 'button', role: 'menuitem', title, onClick: () => onSelect?.() },
      children
    ),
  DropdownMenuLabel: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'presentation' }, children),
  DropdownMenuSeparator: () => createElement('hr'),
  // multi-agent: the composer's AgentSwitcher radio group + the AgentPicker Switch.
  DropdownMenuRadioGroup: ({
    children,
    value,
    onValueChange
  }: {
    children?: ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) => createElement(RadioGroupMockCtx.Provider, { value: { value, onValueChange } }, children),
  // `aria-checked` is mirrored from the group's value the way Radix does it:
  // without it the mock renders a radio group where nothing is selected, and a
  // test asserting "the current theme is the checked one" would pass vacuously.
  DropdownMenuRadioItem: ({ value, children }: { value: string; children?: ReactNode }) => {
    const ctx = useContext(RadioGroupMockCtx)
    return createElement(
      'button',
      {
        type: 'button',
        role: 'menuitemradio',
        'aria-checked': ctx.value === value,
        onClick: () => ctx.onValueChange?.(value)
      },
      children
    )
  },
  Switch: ({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) =>
    createElement('button', {
      type: 'button',
      role: 'switch',
      'aria-checked': checked,
      onClick: () => onCheckedChange?.(!checked),
      ...rest
    }),
  // T8 (WS-R5.1): the three-way unsaved-work guard dialog, same mock shape
  // `explorer/Explorer.test.ts` uses for its own (source) in-viewer guard —
  // plus a dismiss control (`onOpenChange(false)`, e.g. Escape/backdrop in
  // the real Radix-backed component) so tests can exercise that path too,
  // not just the explicit "Cancelar" button.
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', { type: 'button', ...rest }, children),
  // Honors `open` like the real Radix-backed component (which portals nothing
  // while closed) — WorkUI now mounts more than one Dialog-based surface
  // (the guards plus M12's "Perguntar à base"), so a mock that always rendered
  // would put several `role="dialog"` nodes on screen at once.
  Dialog: ({
    open,
    children,
    onOpenChange
  }: {
    open?: boolean
    children?: ReactNode
    onOpenChange?: (open: boolean) => void
  }) =>
    open
      ? createElement(
          'div',
          { role: 'dialog' },
          children,
          createElement(
            'button',
            {
              type: 'button',
              'data-testid': 'dialog-dismiss',
              onClick: () => onOpenChange?.(false)
            },
            'dismiss'
          )
        )
      : null,
  DialogContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  DialogDescription: ({ children }: { children?: ReactNode }) => createElement('p', null, children),
  // Profile sheet (role-personalization RP-R6) — only renders its content
  // while `open`, matching Radix Dialog/Sheet behaviour, so closed-by-default
  // it stays out of the DOM.
  Sheet: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? createElement('div', { 'data-testid': 'profile-sheet' }, children) : null,
  SheetContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SheetTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  SheetDescription: ({ children }: { children?: ReactNode }) => createElement('p', null, children),
  // Profile sheet's name field (display-name editing).
  Field: ({
    label,
    description,
    children
  }: {
    label?: ReactNode
    description?: ReactNode
    children?: ReactNode
  }) => createElement('label', null, label, children, description),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  // The MCP manager wraps its row controls in the tooltip family; passthroughs
  // are enough here (the tooltip's own behaviour is DS-tested).
  TooltipProvider: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  Tooltip: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  TooltipTrigger: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  TooltipContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  // mcp-logs: the console's filter bar. Mocked faithfully enough for the
  // radiogroup queries its own test file uses — WorkUI only needs it to render.
  SegmentedControl: ({
    options,
    value,
    onChange,
    ariaLabel
  }: {
    options: { id: string; label: string; count?: number }[]
    value: string
    onChange: (id: string) => void
    ariaLabel: string
  }) =>
    createElement(
      'div',
      { role: 'radiogroup', 'aria-label': ariaLabel },
      ...options.map((option) =>
        createElement(
          'button',
          {
            key: option.id,
            type: 'button',
            role: 'radio',
            'aria-checked': option.id === value,
            onClick: () => onChange(option.id)
          },
          option.count === undefined ? option.label : `${option.label} ${option.count}`
        )
      )
    ),
  // session-history: the chat pane header mounts the real `SessionHistory`,
  // which rides DS Popover — same context-bridge pattern as DropdownMenu
  // above. Content renders only while the component holds `open`, matching
  // the real conditional-content pattern.
  Popover: ({
    onOpenChange,
    children
  }: {
    onOpenChange?: (open: boolean) => void
    children?: ReactNode
  }) => createElement(PopoverMockCtx.Provider, { value: { onOpenChange } }, children),
  PopoverTrigger: ({ children }: { children?: ReactNode }) => {
    const ctx = useContext(PopoverMockCtx)
    if (!isValidElement(children)) return children
    const element = children as ReactElement<{ onClick?: (event: unknown) => void }>
    return cloneElement(element, {
      onClick: (event: unknown) => {
        element.props.onClick?.(event)
        ctx.onOpenChange?.(true)
      }
    })
  },
  PopoverContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'dialog' }, children),
  Empty: ({ title, description }: { title?: ReactNode; description?: ReactNode }) =>
    createElement('div', null, title, description),
  Skeleton: () => createElement('div', { 'data-testid': 'skeleton' }),
  // Workspace file search (Ctrl+P palette): CommandDialog renders its content
  // only while `open`, matching the real Dialog-backed component.
  CommandDialog: ({
    open,
    label,
    children
  }: {
    open?: boolean
    label?: string
    children?: ReactNode
  }) => (open ? createElement('div', { role: 'dialog', 'aria-label': label }, children) : null),
  CommandInput: ({
    onValueChange,
    ...props
  }: Record<string, unknown> & { onValueChange?: (v: string) => void }) =>
    createElement('input', {
      ...props,
      onChange: (e: { target: { value: string } }) => onValueChange?.(e.target.value)
    }),
  // git-management: BranchPicker's delete-confirm uses the AlertDialog family.
  AlertDialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? createElement('div', { role: 'alertdialog' }, children) : null,
  AlertDialogContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  AlertDialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  AlertDialogDescription: ({ children }: { children?: ReactNode }) =>
    createElement('p', null, children),
  AlertDialogAction: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) =>
    createElement('button', { type: 'button', onClick }, children),
  AlertDialogCancel: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) =>
    createElement('button', { type: 'button', onClick }, children),
  // git-management: the SCM panel's commit box + change-row context menus.
  Textarea: (props: Record<string, unknown>) => createElement('textarea', props),
  DropdownMenuCheckboxItem: ({
    children,
    checked,
    onCheckedChange
  }: {
    children?: ReactNode
    checked?: boolean
    onCheckedChange?: (next: boolean) => void
  }) =>
    createElement(
      'button',
      {
        role: 'menuitemcheckbox',
        'aria-checked': checked,
        onClick: () => onCheckedChange?.(!checked)
      },
      children
    ),
  ContextMenu: ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children),
  ContextMenuTrigger: ({ children }: { children?: ReactNode }) => children,
  ContextMenuContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'menu' }, children),
  ContextMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) =>
    createElement('button', { role: 'menuitem', onClick: onSelect }, children),
  ContextMenuSeparator: () => createElement('hr'),
  CommandList: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  CommandEmpty: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  CommandItem: ({
    children,
    onSelect,
    shortcut,
    value,
    keywords,
    ...rest
  }: {
    children?: ReactNode
    onSelect?: () => void
    shortcut?: ReactNode
    value?: string
    keywords?: string[]
  }) => {
    // `value`/`keywords` are cmdk filtering hints, not DOM attributes.
    void value
    void keywords
    return createElement(
      'button',
      { type: 'button', onClick: () => onSelect?.(), ...rest },
      children,
      shortcut
    )
  },
  // shortcut-customization: the "Personalizar atalhos" picker's extra DS surface.
  Badge: ({ children, variant }: { children?: ReactNode; variant?: string }) =>
    createElement('span', { 'data-variant': variant }, children),
  Command: ({
    children,
    label,
    loop
  }: {
    children?: ReactNode
    label?: string
    loop?: boolean
  }) => {
    void loop
    return createElement('div', { 'aria-label': label }, children)
  },
  CommandGroup: ({ heading, children }: { heading?: ReactNode; children?: ReactNode }) =>
    createElement('div', null, createElement('div', null, heading), children),
  // App settings sheet (version + updates).
  Progress: (props: Record<string, unknown>) =>
    createElement('div', { role: 'progressbar', 'aria-label': props['aria-label'] as string }),
  Spinner: ({ label }: { label?: string }) => createElement('span', null, label),
  // UpdateNotice (npm-distribution T11/T14): mounted unconditionally by
  // WorkUI now, so it needs a stand-in regardless of whether any test here
  // ever drives it into a visible state. `Toast` mirrors Radix's own
  // `open`-gated presence (matching the `Sheet`/`CommandDialog` mocks above);
  // none of these tests fire an update event, so `updateFlow.state` stays
  // `idle` and `open` stays false throughout — this never actually renders
  // visible content in this suite, just needs to not crash.
  ToastProvider: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  Toast: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? createElement('div', { role: 'status' }, children) : null,
  ToastViewport: (props: Record<string, unknown>) => createElement('div', props)
}))

/**
 * T8 — `FileViewer`'s imperative `requestSave` handle (WS-R5.1, design.md
 * §5.2): a module-scope spy the switch-guard tests below drive directly
 * (`mockResolvedValueOnce(false)` etc.), mirroring `resizableProps`'
 * capture-object pattern above — `vi.mock`'s factory is only *called*
 * lazily on first import, by which point this `const` is already
 * initialized, same as that established pattern.
 */
const fileViewerMock: { requestSave: ReturnType<typeof vi.fn> } = {
  requestSave: vi.fn(async () => true)
}

vi.mock('./explorer/Explorer', () => ({
  FileTree: ({ onOpenFile }: { onOpenFile?: (path: string, opts?: { pin?: boolean }) => void }) =>
    createElement(
      'div',
      null,
      createElement(
        'button',
        { type: 'button', 'data-testid': 'file-tree', onClick: () => onOpenFile?.('README.md') },
        'FileTree'
      ),
      createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'open-other',
          onClick: () => onOpenFile?.('docs/other.md')
        },
        'open other'
      ),
      createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'open-pinned',
          onClick: () => onOpenFile?.('docs/pinned.md', { pin: true })
        },
        'open pinned'
      )
    ),
  FileViewer: forwardRef(function FileViewer(
    {
      path,
      onClose,
      onDirtyChange
    }: { path: string; onClose?: () => void; onDirtyChange?: (dirty: boolean) => void },
    ref: React.Ref<{ requestSave: () => Promise<boolean> }>
  ) {
    useImperativeHandle(ref, () => ({ requestSave: fileViewerMock.requestSave }), [])
    return createElement(
      'div',
      { 'data-testid': 'file-viewer' },
      `FileViewer: ${path}`,
      createElement(
        'button',
        { type: 'button', 'data-testid': 'close-viewer', onClick: () => onClose?.() },
        'close'
      ),
      createElement(
        'button',
        { type: 'button', 'data-testid': 'mark-dirty', onClick: () => onDirtyChange?.(true) },
        'mark dirty'
      )
    )
  })
}))

/**
 * The Chat stand-in's imperative handle — the surface WorkUI drives from
 * outside the chat subtree (`launchAction` continues the on-screen
 * conversation, `launchCreation` opens a fresh one, `openSession` restores a
 * stored one). Hoisted so tests can assert *which* of them a launch used.
 */
const chatHandle = vi.hoisted(() => ({
  launchAction: vi.fn(),
  launchCreation: vi.fn(),
  newConversation: vi.fn(),
  openSession: vi.fn()
}))

/** Named so the forwardRef stand-in satisfies react/display-name. */
function ChatStandIn(
  {
    onCustomizeShortcuts,
    onSessionChange
  }: { onCustomizeShortcuts?: () => void; onSessionChange?: (id: string | null) => void },
  ref: React.Ref<typeof chatHandle>
): ReactElement {
  useImperativeHandle(ref, () => chatHandle, [])
  return createElement(
    'div',
    { 'data-testid': 'chat' },
    'Chat',
    createElement(
      'button',
      { type: 'button', onClick: () => onCustomizeShortcuts?.() },
      'abrir personalizar'
    ),
    createElement(
      'button',
      { type: 'button', onClick: () => onSessionChange?.('conversa-atual') },
      'simular conversa em andamento'
    )
  )
}

vi.mock('./chat/Chat', () => ({
  // The mock exposes the customize hook (shortcut-customization) so WorkUI's
  // "open the picker" wiring can be driven without the real Chat surface, and
  // reports a stored conversation on demand (session-history) so tests can put
  // a real conversation "on screen" before launching something over it.
  Chat: forwardRef(ChatStandIn)
}))

const STORAGE_KEY = 'hive.workLayout'

/** Minimal `Storage`-shaped mock with spy-wrapped `getItem`/`setItem` (per-test isolated, unlike jsdom's shared real localStorage). */
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => store.clear()),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size
    }
  }
}

let WorkUI: typeof import('./WorkUI').WorkUI

/**
 * Minimal `window.hive` bridge stand-in — this environment has no real main
 * process, so `chooseWorkspace`/`getRecentWorkspaces`/`openWorkspace` are
 * spies the tests drive directly (mirrors `explorer/Explorer.test.ts`'s
 * per-test `window.hive` mocking approach). `openWorkspace` defaults to
 * succeeding with whatever path it's given (T8, WS-R4/R6.3) — most tests
 * only care that the pipeline reaches it and proceeds; the failure-path
 * tests override it per-case.
 */
function createHiveMock(): Window['hive'] {
  return {
    chooseWorkspace: vi.fn(async () => null),
    getRecentWorkspaces: vi.fn(async () => []),
    openWorkspace: vi.fn(async (path: string) => ({ ok: true, path })),
    // The file-search palette loads the flat workspace file list on open.
    listFiles: vi.fn(async () => []),
    // WorkUI loads the role's actions on mount; the (closed) ProfileSheet
    // loads the agent list on mount — both need to resolve. The (closed)
    // UpdateCenter loads app info + subscribes to update events on mount.
    skills: { list: vi.fn(async () => []) },
    // The Skill Studio reads the active adapter's capabilities (for its
    // model/effort pickers) and lists the workspace's creations on open.
    agent: {
      capabilities: vi.fn(async () => ({ models: [], efforts: [] }))
    },
    studio: {
      list: vi.fn(async () => []),
      create: vi.fn(async () => undefined),
      run: vi.fn(() => () => {})
    },
    // The ingestion sheet's audio tabs mount the Whisper model store on open.
    whisper: {
      listModels: vi.fn(async () => []),
      modelStatus: vi.fn(async () => ({ installed: false })),
      deleteModel: vi.fn(async () => undefined),
      downloadModel: vi.fn(() => () => {})
    },
    // The (closed) MCP module loads the server list on open.
    mcp: {
      list: vi.fn(async () => []),
      add: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      setEnabled: vi.fn(async () => undefined),
      probe: vi.fn(async () => ({ ok: true, tools: [], logs: '', durationMs: 0 }))
    },
    // mcp-logs: the console's dock and the status bar's cluster both read this
    // on mount; `watch` must return a real disposer (it runs on unmount).
    mcpLogs: createHiveMcpLogsMock(),
    app: {
      info: vi.fn(async () => ({
        name: 'hive-desktop',
        version: '0.1.0',
        updatesSupported: false,
        canApply: false,
        lastCheckedAt: null,
        skippedVersion: null
      })),
      checkForUpdates: vi.fn(async () => undefined),
      downloadUpdate: vi.fn(async () => undefined),
      installUpdate: vi.fn(async () => undefined),
      cancelUpdate: vi.fn(async () => undefined),
      revealInstaller: vi.fn(async () => undefined),
      skipVersion: vi.fn(async () => undefined),
      onUpdateEvent: vi.fn(() => () => {})
    },
    profile: {
      agents: vi.fn(async () => []),
      getAgent: vi.fn(async () => null),
      setAgent: vi.fn(async () => undefined),
      getRole: vi.fn(async () => null),
      setRole: vi.fn(async () => undefined),
      roleActions: vi.fn(async () => [])
    },
    shortcuts: {
      catalog: vi.fn(async () => []),
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
      actions: vi.fn(async () => [])
    },
    // git-management (M10): WorkUI mounts the git store (detect + onChanged +
    // fs watch) on mount, so the bridge + watch must resolve benignly.
    watchWorkspace: vi.fn(() => () => {}),
    // ConflictView reads the conflicted file; default to no markers.
    readFile: vi.fn(async () => ''),
    git: createHiveGitMock(),
    // Agent Change Review (M11): WorkUI mounts the review store (get + onChanged)
    // on mount, so the bridge must resolve to an empty pending set benignly.
    review: {
      get: vi.fn(async () => ({ changes: [], turns: [] })),
      acceptFile: vi.fn(async () => ({ ok: true })),
      rejectFile: vi.fn(async () => ({ ok: true })),
      acceptHunk: vi.fn(async () => ({ ok: true })),
      rejectHunk: vi.fn(async () => ({ ok: true })),
      acceptAll: vi.fn(async () => ({ ok: true })),
      rejectAll: vi.fn(async () => ({ ok: true })),
      onChanged: vi.fn(() => () => {})
    },
    // Second Brain (M12): WorkUI mounts useSecondBrain (getVault + getHealth)
    // on mount, and the panel's wiki browser reads the vault's tree.
    secondBrain: createHiveSecondBrainMock(),
    listTree: vi.fn(async () => [])
  } as unknown as Window['hive']
}

beforeEach(async () => {
  vi.stubGlobal('localStorage', createLocalStorageMock())
  // Default: the guided tour was already seen, so it never pops into
  // unrelated tests mid-run. The tour describe below removes the flag.
  localStorage.setItem('hive.tourSeen', '1')
  vi.stubGlobal('hive', createHiveMock())
  resizableProps.defaultLayout = undefined
  resizableProps.onLayoutChanged = undefined
  fileViewerMock.requestSave.mockReset()
  fileViewerMock.requestSave.mockResolvedValue(true)
  ;({ WorkUI } = await import('./WorkUI'))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.resetModules()
  for (const spy of Object.values(chatHandle)) spy.mockReset()
})

describe('WorkUI — resizable rail persistence (T11)', () => {
  it('reads no default layout when localStorage has no persisted value', () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY)
    expect(resizableProps.defaultLayout).toBeUndefined()
  })

  it('restores a previously-persisted layout via defaultLayout on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rail: 18, chat: 57, viewer: 25 }))
    vi.mocked(localStorage.getItem).mockClear()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY)
    expect(resizableProps.defaultLayout).toEqual({ rail: 18, chat: 57, viewer: 25 })
  })

  it('ignores a corrupt persisted value instead of crashing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    expect(resizableProps.defaultLayout).toBeUndefined()
    expect(screen.getByTestId('resizable')).toBeTruthy()
  })

  it('ignores a persisted value whose shape is not a panel-id -> number map', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rail: 'wide' }))

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    expect(resizableProps.defaultLayout).toBeUndefined()
  })

  it('persists the group layout to localStorage on onLayoutChanged', () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByTestId('simulate-drag'))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify({ rail: 30, chat: 45, viewer: 25 })
    )
  })

  it('renders rail and chat panels, and only mounts the viewer panel while a file is open', () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    expect(screen.getByTestId('panel-rail')).toBeTruthy()
    expect(screen.getByTestId('panel-chat')).toBeTruthy()
    expect(screen.queryByTestId('panel-viewer')).toBeNull()

    fireEvent.click(screen.getByTestId('file-tree'))

    expect(screen.getByTestId('panel-viewer')).toBeTruthy()
    expect(screen.getByText('FileViewer: README.md')).toBeTruthy()
  })

  it('closes the viewer panel when the FileViewer reports onClose', () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByTestId('file-tree'))
    expect(screen.getByTestId('panel-viewer')).toBeTruthy()

    fireEvent.click(screen.getByTestId('close-viewer'))

    expect(screen.queryByTestId('panel-viewer')).toBeNull()
  })

  it('names the active theme on the appearance trigger', () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'light',
        onSelectTheme: vi.fn()
      })
    )

    expect(screen.getByRole('button', { name: 'Aparência (atual: Claro)' })).toBeTruthy()
  })

  it('offers all three themes, marks the active one, and reports the pick', () => {
    const onSelectTheme = vi.fn()
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'light',
        onSelectTheme
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /^Aparência/ }))

    const options = screen.getAllByRole('menuitemradio')
    expect(options.map((option) => option.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false'
    ])

    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Hive/ }))

    expect(onSelectTheme).toHaveBeenCalledWith('hive')
  })

  it('swallows a localStorage.setItem failure when persisting the layout', () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => fireEvent.click(screen.getByTestId('simulate-drag'))).not.toThrow()
  })
})

/**
 * Task T7 — workspace chip menu (design.md §5.1, WS-R1.1–R1.4/R7).
 *
 * The `wb-workspace-chip` becomes a DS `DropdownMenu` trigger: opening it
 * loads the MRU via `window.hive.getRecentWorkspaces()`, excludes the
 * active workspace (WS-R1.4), and omits the whole Recentes section when
 * nothing else is left (WS-R1.3). "Abrir pasta…" resolves a candidate via
 * `window.hive.chooseWorkspace()`; a recents entry resolves its own path.
 * Either way the candidate is only ever handed off via `onCandidateWorkspace`
 * — WorkUI does not perform the switch itself (that's T8's guard/pipeline).
 */
describe('WorkUI — workspace chip menu (T7)', () => {
  it('opens the menu on click and loads recents, excluding the active workspace', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([
      '/home/user/my-workspace',
      '/home/user/other-project',
      '/home/user/third-project'
    ])

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))

    expect(window.hive.getRecentWorkspaces).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByText('other-project')).toBeTruthy())
    const menu = within(screen.getByRole('menu'))
    expect(menu.getByText('other-project')).toBeTruthy()
    expect(menu.getByText('third-project')).toBeTruthy()
    // The active workspace's own name is only the chip's label — never
    // repeated inside the menu (WS-R1.4: never "switch" to where you are).
    expect(menu.queryByText('my-workspace')).toBeNull()
    expect(menu.getByText('Abrir pasta…')).toBeTruthy()
  })

  it('is a native <button> trigger, so it is keyboard-operable (Enter/Space) without bespoke key handling', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue(['/home/user/other-project'])

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    const trigger = screen.getByRole('button', { name: /workspace ativo/i })
    // A real <button type="button"> gets Enter/Space activation for free from
    // the browser (jsdom doesn't simulate that dispatch, so this asserts the
    // semantics that make it true rather than re-simulating the browser):
    expect(trigger.tagName).toBe('BUTTON')
    expect(trigger.getAttribute('type')).toBe('button')

    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    // Activating it (click — what a native button's Enter/Space collapses to)
    // opens the menu, same as a mouse click.
    fireEvent.click(trigger)
    await waitFor(() => expect(window.hive.getRecentWorkspaces).toHaveBeenCalled())
  })

  it('omits the Recentes section entirely when there are no other recent workspaces', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue(['/home/user/my-workspace'])

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))

    await waitFor(() => expect(window.hive.getRecentWorkspaces).toHaveBeenCalled())
    expect(screen.getByText('Abrir pasta…')).toBeTruthy()
    expect(screen.queryByText('Recentes')).toBeNull()
  })

  it('"Abrir pasta…" invokes window.hive.chooseWorkspace and reports a picked candidate', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue('/home/user/picked-workspace')
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))
    await waitFor(() => expect(window.hive.getRecentWorkspaces).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Abrir pasta…'))

    expect(window.hive.chooseWorkspace).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(onCandidateWorkspace).toHaveBeenCalledWith('/home/user/picked-workspace')
    )
  })

  it('does not report a candidate when the native picker is cancelled', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue(null)
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))
    await waitFor(() => expect(window.hive.getRecentWorkspaces).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Abrir pasta…'))

    await waitFor(() => expect(window.hive.chooseWorkspace).toHaveBeenCalledTimes(1))
    expect(onCandidateWorkspace).not.toHaveBeenCalled()
  })

  it('selecting a recent entry invokes onCandidateWorkspace with its path', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([
      '/home/user/my-workspace',
      '/home/user/other-project'
    ])
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))
    await waitFor(() => expect(screen.getByText('other-project')).toBeTruthy())

    fireEvent.click(screen.getByText('other-project'))

    await waitFor(() =>
      expect(onCandidateWorkspace).toHaveBeenCalledWith('/home/user/other-project')
    )
  })

  // Agent Change Review (M11, T19): switching away with a non-empty pending set
  // is guarded (ACR-R4.3).
  it('guards a workspace switch when the review set is non-empty, then continues on keep', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([
      '/home/user/my-workspace',
      '/home/user/other-project'
    ])
    ;(window.hive.review.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      changes: [
        { path: 'a.txt', status: 'modified', diff: { hunks: [], binary: false }, adds: 1, dels: 0 }
      ],
      turns: []
    })
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )
    // Wait for the pending set to load.
    await screen.findByText('1 mudança pendente')

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))
    await waitFor(() => expect(screen.getByText('other-project')).toBeTruthy())
    fireEvent.click(screen.getByText('other-project'))

    // The switch is parked behind the review guard — not yet handed off.
    expect(await screen.findByText('Sair com mudanças pendentes?')).toBeTruthy()
    expect(onCandidateWorkspace).not.toHaveBeenCalled()

    // "Sair mantendo pendentes" continues the switch (the set survives).
    fireEvent.click(screen.getByText('Sair mantendo pendentes'))
    await waitFor(() =>
      expect(onCandidateWorkspace).toHaveBeenCalledWith('/home/user/other-project')
    )
  })

  it('reject-all-and-leave clears the set before switching', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([
      '/home/user/my-workspace',
      '/home/user/other-project'
    ])
    ;(window.hive.review.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      changes: [
        { path: 'a.txt', status: 'modified', diff: { hunks: [], binary: false }, adds: 1, dels: 0 }
      ],
      turns: []
    })
    const onCandidateWorkspace = vi.fn()
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )
    await screen.findByText('1 mudança pendente')
    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))
    await waitFor(() => expect(screen.getByText('other-project')).toBeTruthy())
    fireEvent.click(screen.getByText('other-project'))
    await screen.findByText('Sair com mudanças pendentes?')

    fireEvent.click(screen.getByText('Rejeitar tudo e sair'))
    await waitFor(() =>
      expect(window.hive.review.rejectAll).toHaveBeenCalledWith('/home/user/my-workspace')
    )
    await waitFor(() =>
      expect(onCandidateWorkspace).toHaveBeenCalledWith('/home/user/other-project')
    )
  })

  it('shows the full path as a tooltip on each recent entry', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([
      '/home/user/my-workspace',
      '/home/user/other-project'
    ])

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))

    const entry = await screen.findByText('other-project')
    expect(entry.closest('[title]')?.getAttribute('title')).toBe('/home/user/other-project')
  })

  it('tolerates a getRecentWorkspaces rejection by rendering an empty Recentes-less menu', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockRejectedValue(new Error('ipc failure'))

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))

    await waitFor(() => expect(window.hive.getRecentWorkspaces).toHaveBeenCalled())
    expect(screen.getByText('Abrir pasta…')).toBeTruthy()
    expect(screen.queryByText('Recentes')).toBeNull()
  })
})

/**
 * Task T8 — switch guard + `openWorkspace` pipeline (design.md §5.2, WS-R5,
 * WS-R6.3). Extends T7's chip menu: a resolved candidate path no longer
 * reaches `onCandidateWorkspace` directly — it first goes through the
 * unsaved-work guard (only if the viewer reports `dirty` via its
 * `onDirtyChange` callback) and then the actual `window.hive.openWorkspace`
 * call, only calling `onCandidateWorkspace` on success.
 */
describe('WorkUI — switch guard + openWorkspace pipeline (T8)', () => {
  /** Opens the file viewer (via the mocked FileTree) and marks it dirty (via the mocked FileViewer's onDirtyChange hook). */
  function openDirtyViewer(): void {
    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.click(screen.getByTestId('mark-dirty'))
  }

  function openChipAndPickFolder(): void {
    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))
    fireEvent.click(screen.getByText('Abrir pasta…'))
  }

  it('proceeds directly through openWorkspace, with no dialog, when the viewer is not dirty', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue('/home/user/other-project')
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    openChipAndPickFolder()

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(window.hive.openWorkspace).toHaveBeenCalledWith('/home/user/other-project')
    )
    await waitFor(() =>
      expect(onCandidateWorkspace).toHaveBeenCalledWith('/home/user/other-project')
    )
  })

  it('dirty + Cancelar aborts the switch entirely: no openWorkspace call, onCandidateWorkspace not called', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue('/home/user/other-project')
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    openDirtyViewer()
    openChipAndPickFolder()

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.hive.openWorkspace).not.toHaveBeenCalled()
    expect(onCandidateWorkspace).not.toHaveBeenCalled()
  })

  it('dismissing the guard dialog (e.g. Escape/backdrop, not just the Cancelar button) also aborts the switch', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue('/home/user/other-project')
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    openDirtyViewer()
    openChipAndPickFolder()

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByTestId('dialog-dismiss'))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.hive.openWorkspace).not.toHaveBeenCalled()
    expect(onCandidateWorkspace).not.toHaveBeenCalled()
  })

  it('dirty + Descartar proceeds with the switch, dropping the unsaved edits', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue('/home/user/other-project')
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    openDirtyViewer()
    openChipAndPickFolder()

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Descartar alterações' }))

    expect(fileViewerMock.requestSave).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(window.hive.openWorkspace).toHaveBeenCalledWith('/home/user/other-project')
    )
    await waitFor(() =>
      expect(onCandidateWorkspace).toHaveBeenCalledWith('/home/user/other-project')
    )
  })

  it('dirty + Salvar saves via the imperative handle first, then proceeds once the save lands', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue('/home/user/other-project')
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    openDirtyViewer()
    openChipAndPickFolder()

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(fileViewerMock.requestSave).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(window.hive.openWorkspace).toHaveBeenCalledWith('/home/user/other-project')
    )
    await waitFor(() =>
      expect(onCandidateWorkspace).toHaveBeenCalledWith('/home/user/other-project')
    )
  })

  it('dirty + Salvar aborts the switch when the save itself fails (e.g. a STALE conflict)', async () => {
    fileViewerMock.requestSave.mockResolvedValueOnce(false)
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue('/home/user/other-project')
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    openDirtyViewer()
    openChipAndPickFolder()

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(fileViewerMock.requestSave).toHaveBeenCalledTimes(1))
    expect(window.hive.openWorkspace).not.toHaveBeenCalled()
    expect(onCandidateWorkspace).not.toHaveBeenCalled()
  })

  it('an openWorkspace failure keeps the current workspace, shows a non-fatal error, and never calls onCandidateWorkspace (WS-R6.3)', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue('/home/user/missing-folder')
    vi.mocked(window.hive.openWorkspace).mockResolvedValue({ ok: false, reason: 'missing' })
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    openChipAndPickFolder()

    await waitFor(() =>
      expect(window.hive.openWorkspace).toHaveBeenCalledWith('/home/user/missing-folder')
    )
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(onCandidateWorkspace).not.toHaveBeenCalled()
  })

  it.each([
    ['not-a-directory', 'não é uma pasta'],
    ['unreadable', 'não foi possível ler']
  ] as const)(
    'maps an openWorkspace "%s" failure to its own user-facing message (WS-R6.3)',
    async (reason, expectedSubstring) => {
      vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
      vi.mocked(window.hive.chooseWorkspace).mockResolvedValue('/home/user/bad-folder')
      vi.mocked(window.hive.openWorkspace).mockResolvedValue({ ok: false, reason })

      render(
        createElement(WorkUI, {
          workspace: '/home/user/my-workspace',
          theme: 'dark',
          onSelectTheme: vi.fn()
        })
      )

      openChipAndPickFolder()

      const alert = await screen.findByRole('alert')
      expect(alert.textContent?.toLowerCase()).toContain(expectedSubstring)
    }
  )

  it('a cancelled native picker remains a no-op even with a dirty viewer (WS-R4.5)', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue(null)
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    openDirtyViewer()
    openChipAndPickFolder()

    await waitFor(() => expect(window.hive.chooseWorkspace).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.hive.openWorkspace).not.toHaveBeenCalled()
    expect(onCandidateWorkspace).not.toHaveBeenCalled()
  })
})

// Guided tour — first-access gating (open-once + skip persists the flag).
describe('WorkUI — guided tour (first access)', () => {
  function mountWithActions(): void {
    // shortcut-customization: WorkUI resolves the (possibly customized)
    // shortcut set via `shortcuts.actions`, not `profile.roleActions`.
    vi.mocked(window.hive.shortcuts.actions).mockResolvedValue([
      { key: 'prd', kind: 'workflow', command: { key: 'bmad-prd', prompt: '/bmad-prd' } }
    ])
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        role: 'pm',
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli'
      })
    )
  }

  it('opens on first access once role actions land, and skipping persists the seen flag', async () => {
    localStorage.removeItem('hive.tourSeen')
    mountWithActions()

    const dialog = await screen.findByRole(
      'dialog',
      { name: 'Tour guiado do Hive' },
      {
        timeout: 2000
      }
    )
    expect(dialog).toBeTruthy()

    fireEvent.click(screen.getByText('Pular tour'))
    expect(screen.queryByRole('dialog', { name: 'Tour guiado do Hive' })).toBeNull()
    expect(localStorage.setItem).toHaveBeenCalledWith('hive.tourSeen', '1')
  })

  it('stays closed when the tour was already seen', async () => {
    mountWithActions()
    // The role actions land (the tour's open precondition) yet no tour appears.
    await waitFor(() => expect(window.hive.shortcuts.actions).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(screen.queryByRole('dialog', { name: 'Tour guiado do Hive' })).toBeNull()
  })
})

// shortcut-customization: WorkUI opens the picker from Chat's hook and
// re-resolves the live shortcut set after every persisted change.
describe('WorkUI — shortcut customization', () => {
  it('opens the picker, and a toggle persists + re-resolves the shortcut set', async () => {
    vi.mocked(window.hive.shortcuts.catalog).mockResolvedValue([
      {
        key: 'bmad-prd',
        label: 'Create Edit and Review PRD',
        description: 'PRD workflow',
        module: 'bmm',
        kind: 'skill',
        persona: null
      }
    ])
    vi.mocked(window.hive.shortcuts.actions).mockResolvedValue([])

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        role: 'pm',
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli'
      })
    )
    await waitFor(() => expect(window.hive.shortcuts.actions).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByText('abrir personalizar'))
    // No prior customization → defaults come from profile.roleActions.
    await waitFor(() => expect(window.hive.profile.roleActions).toHaveBeenCalled())

    const row = await screen.findByRole('button', { name: 'Alternar atalho: Criar um PRD' })
    fireEvent.click(row)
    await waitFor(() =>
      expect(window.hive.shortcuts.set).toHaveBeenCalledWith({ skills: ['bmad-prd'], agents: [] })
    )
    // onChanged → WorkUI re-resolves the visible shortcut set.
    await waitFor(() => expect(window.hive.shortcuts.actions).toHaveBeenCalledTimes(2))

    // "Concluído" closes the picker (the dialog's onOpenChange wiring).
    fireEvent.click(screen.getByRole('button', { name: 'Concluído' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Alternar atalho: Criar um PRD' })).toBeNull()
    )
  })
})

// The left tool rail (search + app settings), the top-bar profile avatar,
// and the Ctrl+P workspace file search.
describe('WorkUI — tool rail, profile avatar, file search', () => {
  it('opens the profile sheet from the top-bar avatar, showing initials when a name is set', async () => {
    vi.mocked(window.hive.profile.agents).mockResolvedValue([
      {
        id: 'claude-cli',
        displayName: 'Claude Code',
        description: '',
        available: true,
        installHint: '',
        docsUrl: ''
      }
    ])

    // No onRoleChange/onAgentChange passed → the WorkUI default no-op handlers
    // are exercised when a role/agent is picked in the sheet.
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn(),
        role: 'pm',
        agents: ['claude-cli'],
        defaultAgent: 'claude-cli',
        userName: 'Gustavo Bruno'
      })
    )

    const avatar = screen.getByRole('button', { name: 'Abrir configurações de perfil' })
    expect(avatar.textContent).toBe('GB')
    // The profile sheet is closed initially, then opens from the avatar.
    expect(screen.queryByText('Perfil')).toBeNull()
    fireEvent.click(avatar)
    expect(await screen.findByText('Perfil')).toBeTruthy()

    // Picking a role + an agent in the sheet runs the (default no-op) handlers.
    fireEvent.click(await screen.findByText('Tech Lead'))
    fireEvent.click(await screen.findByText('Claude Code'))

    // Committing a new name runs the default no-op onUserNameChange too.
    const nameInput = screen.getByPlaceholderText('Seu nome')
    fireEvent.change(nameInput, { target: { value: 'Nova Pessoa' } })
    fireEvent.blur(nameInput)
  })

  it('opens the app settings sheet (version + updates) from the rail gear', async () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    expect(screen.queryByText('Aplicativo')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Configurações do aplicativo' }))
    expect(await screen.findByText('Aplicativo')).toBeTruthy()
    // Version resolved from app.info; dev builds show the honest no-updates note.
    expect(await screen.findByText('Versão 0.1.0')).toBeTruthy()
    expect(
      screen.getByText(
        'Atualizações automáticas ficam disponíveis apenas na versão instalada do aplicativo.'
      )
    ).toBeTruthy()
  })

  it('npm-distribution T14: an available update lights the rail dot, and "Ver novidades" on the notice opens UpdateCenter', async () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    // Both `useUpdateFlow` (this test's real target) AND `UpdateCenter`
    // (T13, always mounted, self-subscribing independently) call
    // `onUpdateEvent` — mirroring the real main-side fan-out (every
    // registered listener receives every event, regardless of how many
    // separate `update:event:start` calls registered them), this drives
    // *every* registered callback, not just the first.
    const onUpdateEvent = vi.mocked(window.hive.app.onUpdateEvent)
    await waitFor(() => expect(onUpdateEvent).toHaveBeenCalled())
    function emit(event: { type: string } & Record<string, unknown>): void {
      for (const [listener] of onUpdateEvent.mock.calls) (listener as (e: unknown) => void)(event)
    }

    expect(screen.queryByLabelText(/Atualização disponível/)).toBeNull()

    act(() => {
      emit({ type: 'available', version: '0.2.0', bytes: 1000, notes: 'Correções.' })
    })

    // The rail's ambient dot (T12) lit up from the same shared state.
    expect(
      screen.getByLabelText('Configurações do aplicativo — Atualização disponível')
    ).toBeTruthy()

    // The notice's "Ver novidades" opens UpdateCenter (WorkUI wires it to
    // the same appSettingsOpen state as the rail gear).
    expect(screen.queryByText('Aplicativo')).toBeNull()
    fireEvent.click(screen.getByText('Ver novidades'))
    expect(await screen.findByText('Aplicativo')).toBeTruthy()
  })

  it('opens the MCP module (Servidores MCP) from the rail plug button', async () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    expect(screen.queryByText('Nenhum servidor MCP ainda')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Servidores MCP' }))
    // The module opens on its empty state (the mock lists no servers).
    expect(await screen.findByText('Nenhum servidor MCP ainda')).toBeTruthy()
  })

  // P0-011 (R-03): three surfaces WorkUI wires up but no test ever opened.
  // Each is a one-line callback whose only job is to flip the right piece of
  // state — the class of wiring that fails silently, because the button is
  // there and simply does nothing.
  it('opens the Estúdio de skills from the rail sparkle button', async () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    expect(screen.queryByRole('heading', { name: 'Estúdio de skills' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Estúdio de skills' }))
    expect(await screen.findByRole('heading', { name: 'Estúdio de skills' })).toBeTruthy()
  })

  it('opens "Perguntar à base" from the floating Second Brain button', async () => {
    // A vault has to exist, or the ask surface renders its setup guard instead
    // of the question field — a different path from the one under test.
    vi.mocked(window.hive.secondBrain.getVault).mockResolvedValue({
      path: '/home/user/my-workspace/second-brain',
      name: 'second-brain',
      rawPending: 0
    })
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    expect(screen.queryByPlaceholderText('O que você quer saber?')).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Base de conhecimento — perguntar ou capturar' })
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: /Perguntar à base/ }))
    expect(await screen.findByPlaceholderText('O que você quer saber?')).toBeTruthy()
  })

  it('opens the capture sheet from the FAB and closes it again', async () => {
    vi.mocked(window.hive.secondBrain.getVault).mockResolvedValue({
      path: '/home/user/my-workspace/second-brain',
      name: 'second-brain',
      rawPending: 0
    })
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Base de conhecimento — perguntar ou capturar' })
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Colar texto' }))
    expect(await screen.findByText('Ingerir conhecimento')).toBeTruthy()

    // Closing has to actually clear the mode, or the sheet can never reopen.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByText('Ingerir conhecimento')).toBeNull())
  })

  it('opens the file search from the rail button, and picking a file opens it in the viewer', async () => {
    vi.mocked(window.hive.listFiles).mockResolvedValue(['docs/prd.md'])

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    expect(screen.queryByRole('dialog', { name: 'Buscar arquivos no workspace' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar arquivos no workspace' }))
    expect(await screen.findByRole('dialog', { name: 'Buscar arquivos no workspace' })).toBeTruthy()

    // Picking the row opens the file: the viewer panel mounts and the dialog closes.
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir arquivo docs/prd.md' }))
    expect(screen.getByTestId('panel-viewer')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Buscar arquivos no workspace' })).toBeNull()
  })

  it('Ctrl+P opens the file search from anywhere in the work UI', async () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    expect(await screen.findByRole('dialog', { name: 'Buscar arquivos no workspace' })).toBeTruthy()
  })
})

/**
 * customizable-layout — movable panes: persisted left-to-right order
 * (`hive.paneOrder`), the ↔ move menu, and header drag-and-drop. Same
 * isolation approach as the T11 layout suite above: the DS Resizable mock
 * renders panels as plain divs (`panel-<id>`), so DOM order IS pane order.
 */
describe('WorkUI — movable panes (customizable-layout)', () => {
  const PANE_ORDER_KEY = 'hive.paneOrder'

  function renderWorkUI(): void {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )
  }

  /** DOM order of the rendered panels, as pane ids. */
  function panelOrder(): string[] {
    return Array.from(document.querySelectorAll('[data-testid^="panel-"]')).map((el) =>
      (el.getAttribute('data-testid') ?? '').replace('panel-', '')
    )
  }

  it('renders rail → chat by default, appending the viewer last when a file opens', () => {
    renderWorkUI()
    expect(panelOrder()).toEqual(['rail', 'chat'])

    fireEvent.click(screen.getByTestId('file-tree'))
    expect(panelOrder()).toEqual(['rail', 'chat', 'viewer'])
  })

  it('restores a persisted pane order on mount', () => {
    localStorage.setItem(PANE_ORDER_KEY, JSON.stringify(['chat', 'viewer', 'rail']))
    renderWorkUI()
    expect(panelOrder()).toEqual(['chat', 'rail'])

    fireEvent.click(screen.getByTestId('file-tree'))
    expect(panelOrder()).toEqual(['chat', 'viewer', 'rail'])
  })

  it('falls back to the default order when the persisted value is not a rail/chat/viewer permutation', () => {
    localStorage.setItem(PANE_ORDER_KEY, JSON.stringify(['chat']))
    renderWorkUI()
    expect(panelOrder()).toEqual(['rail', 'chat'])

    localStorage.setItem(PANE_ORDER_KEY, '{corrupt')
    cleanup()
    renderWorkUI()
    expect(panelOrder()).toEqual(['rail', 'chat'])
  })

  it('moves a pane left via the ↔ menu and persists the new order', () => {
    renderWorkUI()

    fireEvent.click(screen.getByRole('button', { name: 'Mover o painel Conversa' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover para a esquerda' }))

    expect(panelOrder()).toEqual(['chat', 'rail'])
    expect(localStorage.setItem).toHaveBeenCalledWith(
      PANE_ORDER_KEY,
      JSON.stringify(['chat', 'rail', 'viewer'])
    )
  })

  it('moving the leftmost pane further left is a no-op', () => {
    renderWorkUI()

    fireEvent.click(screen.getByRole('button', { name: 'Mover o painel Arquivos' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover para a esquerda' }))

    expect(panelOrder()).toEqual(['rail', 'chat'])
  })

  it('moves a pane right via the ↔ menu (the mirror path)', () => {
    renderWorkUI()

    fireEvent.click(screen.getByRole('button', { name: 'Mover o painel Arquivos' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover para a direita' }))

    expect(panelOrder()).toEqual(['chat', 'rail'])
  })

  it('leaving a hovered pane clears its drop hint', () => {
    renderWorkUI()

    const railHeader = screen.getByText('Arquivos').closest('header') as HTMLElement
    const chatPane = screen.getByTestId('panel-chat').querySelector('.wb-pane') as HTMLElement
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: '',
      dropEffect: '',
      types: ['application/x-hive-pane']
    }

    fireEvent.dragStart(railHeader, { dataTransfer })
    fireEvent.dragOver(chatPane, { dataTransfer, clientX: 5 })
    expect(chatPane.getAttribute('data-drop')).toBe('after')

    // Pointer leaves for somewhere outside the pane → the hint clears.
    fireEvent.dragLeave(chatPane, { relatedTarget: document.body })
    expect(chatPane.getAttribute('data-drop')).toBeNull()
  })

  it('drag-and-drop guards: no phantom hints, before-half targeting, child leave keeps the hint', () => {
    renderWorkUI()

    const railHeader = screen.getByText('Arquivos').closest('header') as HTMLElement
    const railPane = screen.getByTestId('panel-rail').querySelector('.wb-pane') as HTMLElement
    const chatPane = screen.getByTestId('panel-chat').querySelector('.wb-pane') as HTMLElement
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: '',
      dropEffect: '',
      types: ['application/x-hive-pane']
    }

    // Hovering with no drag in flight is inert.
    fireEvent.dragOver(chatPane, { dataTransfer, clientX: 5 })
    expect(chatPane.getAttribute('data-drop')).toBeNull()

    fireEvent.dragStart(railHeader, { dataTransfer })
    // Hovering the dragged pane itself is inert too.
    fireEvent.dragOver(railPane, { dataTransfer, clientX: 5 })
    expect(railPane.getAttribute('data-drop')).toBeNull()

    // Give the pane a real width so the pointer's half is meaningful, and
    // dispatch native MouseEvents: jsdom has no DragEvent, so fireEvent's
    // dragOver falls back to a plain Event whose clientX is undefined —
    // which would make every hover read as 'after'.
    chatPane.getBoundingClientRect = () =>
      ({ left: 0, width: 100, top: 0, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect
    function mouseDragEvent(type: string, clientX: number): MouseEvent {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX })
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
      return event
    }

    // Left half → 'before'; a repeated same-side hover keeps the hint stable.
    fireEvent(chatPane, mouseDragEvent('dragover', 5))
    fireEvent(chatPane, mouseDragEvent('dragover', 5))
    expect(chatPane.getAttribute('data-drop')).toBe('before')

    // Leaving into one of the pane's own children keeps the hint alive
    // (same native-MouseEvent route: fireEvent.dragLeave drops relatedTarget).
    const leaveIntoChild = new MouseEvent('dragleave', {
      bubbles: true,
      cancelable: true,
      relatedTarget: chatPane.firstElementChild
    })
    fireEvent(chatPane, leaveIntoChild)
    expect(chatPane.getAttribute('data-drop')).toBe('before')

    // Dropping on the left half inserts before → rail was already before chat.
    fireEvent(chatPane, mouseDragEvent('drop', 5))
    expect(panelOrder()).toEqual(['rail', 'chat'])
  })

  it('reorders panes by dragging a pane header onto another pane and persists it', () => {
    renderWorkUI()

    const railHeader = screen.getByText('Arquivos').closest('header') as HTMLElement
    const chatPane = screen.getByTestId('panel-chat').querySelector('.wb-pane') as HTMLElement
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: '',
      dropEffect: '',
      types: ['application/x-hive-pane']
    }

    fireEvent.dragStart(railHeader, { dataTransfer })
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-hive-pane', 'rail')

    // jsdom rects are all-zero, so clientX 5 lands in the pane's right half → 'after'.
    fireEvent.dragOver(chatPane, { dataTransfer, clientX: 5 })
    expect(chatPane.getAttribute('data-drop')).toBe('after')

    fireEvent.drop(chatPane, { dataTransfer, clientX: 5 })
    expect(panelOrder()).toEqual(['chat', 'rail'])
    expect(localStorage.setItem).toHaveBeenCalledWith(
      PANE_ORDER_KEY,
      JSON.stringify(['chat', 'rail', 'viewer'])
    )
    // Drag state fully cleared — no lingering drop hint.
    expect(document.querySelector('[data-drop]')).toBeNull()
  })

  it('a drag that ends without a drop clears the drop hint (dragend path)', () => {
    renderWorkUI()

    const railHeader = screen.getByText('Arquivos').closest('header') as HTMLElement
    const chatPane = screen.getByTestId('panel-chat').querySelector('.wb-pane') as HTMLElement
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: '',
      dropEffect: '',
      types: ['application/x-hive-pane']
    }

    fireEvent.dragStart(railHeader, { dataTransfer })
    fireEvent.dragOver(chatPane, { dataTransfer, clientX: 5 })
    expect(chatPane.getAttribute('data-drop')).toBe('after')

    fireEvent.dragEnd(railHeader, { dataTransfer })
    expect(panelOrder()).toEqual(['rail', 'chat'])
    expect(document.querySelector('[data-drop]')).toBeNull()
  })
})

describe('WorkUI — multi-tab editor (VS Code preview/pin)', () => {
  function renderWorkUI(): void {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )
  }

  /** Visible tab names, in strip order. */
  function tabNames(): string[] {
    return screen.getAllByRole('tab').map((tab) => tab.textContent ?? '')
  }

  it('a plain click opens a preview tab that the next plain open replaces in place', () => {
    renderWorkUI()

    fireEvent.click(screen.getByTestId('file-tree'))
    expect(tabNames()).toEqual(['README.md'])
    expect(screen.getByRole('tab').hasAttribute('data-preview')).toBe(true)

    fireEvent.click(screen.getByTestId('open-other'))
    expect(tabNames()).toEqual(['other.md'])
  })

  it('a pinned open (double-click in the tree) keeps the preview tab and adds its own', () => {
    renderWorkUI()

    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.click(screen.getByTestId('open-pinned'))

    expect(tabNames()).toEqual(['README.md', 'pinned.md'])
    const pinned = screen.getAllByRole('tab')[1] as HTMLElement
    expect(pinned.hasAttribute('data-preview')).toBe(false)
  })

  it('double-clicking a preview tab pins it, so the next open adds a second tab', () => {
    renderWorkUI()

    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.doubleClick(screen.getByRole('tab'))
    expect(screen.getByRole('tab').hasAttribute('data-preview')).toBe(false)

    fireEvent.click(screen.getByTestId('open-other'))
    expect(tabNames()).toEqual(['README.md', 'other.md'])
  })

  it('editing a preview tab pins it and shows the dirty dot state', () => {
    renderWorkUI()

    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.click(screen.getByTestId('mark-dirty'))

    const tab = screen.getByRole('tab')
    expect(tab.hasAttribute('data-preview')).toBe(false)
    expect(tab.hasAttribute('data-dirty')).toBe(true)
  })

  it('selecting another tab switches the visible viewer without unmounting the hidden one', () => {
    renderWorkUI()

    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.click(screen.getByTestId('open-pinned'))

    // Both viewers stay mounted; only the active tab's body is visible.
    const bodies = Array.from(document.querySelectorAll('.wb-tab-body'))
    expect(bodies).toHaveLength(2)
    expect(bodies.filter((body) => !body.hasAttribute('hidden'))).toHaveLength(1)

    fireEvent.click(screen.getAllByRole('tab')[0] as HTMLElement)
    const readmeBody = bodies[0] as HTMLElement
    expect(readmeBody.hasAttribute('hidden')).toBe(false)
  })

  it('closing a clean tab from the strip closes immediately (no guard dialog)', () => {
    renderWorkUI()

    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.click(screen.getByLabelText('Fechar README.md'))

    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.queryByTestId('panel-viewer')).toBeNull()
  })

  it('closing a dirty tab asks the three-way guard; Salvar saves via the handle then closes', async () => {
    renderWorkUI()

    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.click(screen.getByTestId('mark-dirty'))
    fireEvent.click(screen.getByLabelText('Fechar README.md'))

    // Guard dialog up, tab still open.
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('tab')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => {
      expect(fileViewerMock.requestSave).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.queryByRole('tab')).toBeNull()
    })
  })

  it('closing a dirty tab and picking Descartar closes without saving', () => {
    renderWorkUI()

    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.click(screen.getByTestId('mark-dirty'))
    fireEvent.click(screen.getByLabelText('Fechar README.md'))
    fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações' }))

    expect(fileViewerMock.requestSave).not.toHaveBeenCalled()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('closing a dirty tab and picking Cancelar keeps the tab (and its dirty state)', () => {
    renderWorkUI()

    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.click(screen.getByTestId('mark-dirty'))
    fireEvent.click(screen.getByLabelText('Fechar README.md'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('tab').hasAttribute('data-dirty')).toBe(true)
  })

  it('closing the active tab activates its neighbor', () => {
    renderWorkUI()

    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.click(screen.getByTestId('open-pinned'))
    expect(tabNames()).toEqual(['README.md', 'pinned.md'])

    // pinned.md is active; close it — README.md becomes the active tab.
    fireEvent.click(screen.getByLabelText('Fechar pinned.md'))
    expect(tabNames()).toEqual(['README.md'])
    expect(screen.getByRole('tab').hasAttribute('data-active')).toBe(true)
  })

  it('middle-clicking a tab closes it (VS Code muscle memory)', () => {
    renderWorkUI()

    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent(
      screen.getByRole('tab'),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 })
    )

    expect(screen.queryByRole('tab')).toBeNull()
  })
})

describe('WorkUI — sidebar view switch (git-management D-GIT-2)', () => {
  function renderWork(): void {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )
  }

  it('defaults to the Explorer view (file tree visible, pane titled "Arquivos")', () => {
    renderWork()
    expect(screen.getByTestId('file-tree')).toBeTruthy()
    expect(screen.getByText('Arquivos')).toBeTruthy()
    expect(document.querySelector('.wb-scm-empty')).toBeNull()
  })

  it('clicking Source Control swaps the rail body and persists the view', () => {
    renderWork()
    fireEvent.click(screen.getByLabelText('Controle de versão'))

    expect(document.querySelector('.wb-scm-empty')).not.toBeNull()
    expect(screen.queryByTestId('file-tree')).toBeNull()
    expect(screen.getByText('Controle de versão')).toBeTruthy()
    expect(localStorage.getItem('hive.sidebarView')).toBe('scm')

    // Switching back to Explorer restores the tree.
    fireEvent.click(screen.getByLabelText('Explorador'))
    expect(screen.getByTestId('file-tree')).toBeTruthy()
    expect(localStorage.getItem('hive.sidebarView')).toBe('explorer')
  })

  it('Ctrl+Shift+G opens the Source Control view', () => {
    renderWork()
    expect(screen.getByTestId('file-tree')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'G', ctrlKey: true, shiftKey: true })
    expect(document.querySelector('.wb-scm-empty')).not.toBeNull()
  })

  it('restores the persisted Source Control view on mount', () => {
    localStorage.setItem('hive.sidebarView', 'scm')
    renderWork()
    expect(document.querySelector('.wb-scm-empty')).not.toBeNull()
    expect(screen.queryByTestId('file-tree')).toBeNull()
  })
})

describe('WorkUI — git status bar + branch picker (T21/T22)', () => {
  type GitMock = ReturnType<typeof createHiveGitMock>

  function renderRepoWork(overrides: (git: GitMock) => void = () => {}): GitMock {
    const hive = createHiveMock()
    const git = hive.git as unknown as GitMock
    git.detect.mockResolvedValue({ isRepo: true, root: '/ws', gitMissing: false })
    git.status.mockResolvedValue(
      makeStatus({
        branch: 'main',
        upstream: 'origin/main',
        ahead: 1,
        behind: 0,
        changes: [
          {
            path: 'a.txt',
            index: '.',
            worktree: 'M',
            isConflict: false,
            isUntracked: false,
            isIgnored: false
          }
        ]
      })
    )
    git.branches.mockResolvedValue({
      branches: [
        {
          name: 'main',
          oid: 'a',
          upstream: 'origin/main',
          isRemote: false,
          isHead: true,
          ahead: 1,
          behind: 0,
          gone: false
        },
        {
          name: 'feature/x',
          oid: 'b',
          upstream: null,
          isRemote: false,
          isHead: false,
          ahead: 0,
          behind: 0,
          gone: false
        }
      ],
      current: 'main'
    })
    overrides(git)
    vi.stubGlobal('hive', hive)
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )
    return git
  }

  it('shows the branch pill + sync counts and routes sync/changes clicks', async () => {
    const git = renderRepoWork()
    fireEvent.click(await screen.findByLabelText('1 à frente, 0 atrás. Sincronizar'))
    expect(git.sync).toHaveBeenCalledWith('/home/user/my-workspace')
    fireEvent.click(screen.getByLabelText('1 alteração. Abrir o controle de versão'))
    expect(document.querySelector('.wb-scm')).not.toBeNull()
  })

  it('opens the branch picker from the pill and checks out a clean tree directly', async () => {
    const git = renderRepoWork()
    fireEvent.click(await screen.findByLabelText('Branch atual: main. Trocar de branch'))
    fireEvent.click(await screen.findByLabelText('Trocar para feature/x'))
    expect(git.checkout).toHaveBeenCalledWith('/home/user/my-workspace', 'feature/x')
  })

  it('guards a dirty checkout behind the three-way dialog (Salvar proceeds)', async () => {
    const git = renderRepoWork()
    // Make an editor tab dirty first.
    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.click(screen.getByTestId('mark-dirty'))
    fireEvent.click(await screen.findByLabelText('Branch atual: main. Trocar de branch'))
    fireEvent.click(await screen.findByLabelText('Trocar para feature/x'))
    // The guard appears; checkout hasn't happened yet.
    expect(screen.getByText('Alterações não salvas')).toBeTruthy()
    expect(git.checkout).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Salvar'))
    await waitFor(() =>
      expect(git.checkout).toHaveBeenCalledWith('/home/user/my-workspace', 'feature/x')
    )
  })

  it('guards a dirty checkout — Descartar proceeds, Cancelar aborts', async () => {
    const git = renderRepoWork()
    fireEvent.click(screen.getByTestId('file-tree'))
    fireEvent.click(screen.getByTestId('mark-dirty'))

    // Cancelar: no checkout.
    fireEvent.click(await screen.findByLabelText('Branch atual: main. Trocar de branch'))
    fireEvent.click(await screen.findByLabelText('Trocar para feature/x'))
    fireEvent.click(screen.getByText('Cancelar'))
    expect(git.checkout).not.toHaveBeenCalled()

    // Descartar: checks out, dropping drafts.
    fireEvent.click(await screen.findByLabelText('Branch atual: main. Trocar de branch'))
    fireEvent.click(await screen.findByLabelText('Trocar para feature/x'))
    fireEvent.click(screen.getByText('Descartar alterações'))
    expect(git.checkout).toHaveBeenCalledWith('/home/user/my-workspace', 'feature/x')
  })

  it('creates a branch from the filter query', async () => {
    const git = renderRepoWork()
    fireEvent.click(await screen.findByLabelText('Branch atual: main. Trocar de branch'))
    fireEvent.change(await screen.findByPlaceholderText('Buscar ou criar branch…'), {
      target: { value: 'feat/new' }
    })
    fireEvent.click(screen.getByLabelText('Criar branch “feat/new”'))
    expect(git.createBranch).toHaveBeenCalledWith('/home/user/my-workspace', 'feat/new', undefined)
  })

  it('deletes a branch after confirmation', async () => {
    const git = renderRepoWork()
    fireEvent.click(await screen.findByLabelText('Branch atual: main. Trocar de branch'))
    fireEvent.click(await screen.findByLabelText('Excluir branch feature/x'))
    fireEvent.click(screen.getByText('Excluir'))
    expect(git.deleteBranch).toHaveBeenCalledWith('/home/user/my-workspace', 'feature/x', true)
  })

  it('offers an initialize affordance in the status bar for a non-repo', async () => {
    const git = renderRepoWork((g) => {
      g.detect.mockResolvedValue({ isRepo: false, root: null, gitMissing: false })
    })
    fireEvent.click(await screen.findByLabelText('Inicializar repositório git neste workspace'))
    expect(git.init).toHaveBeenCalledWith('/home/user/my-workspace')
  })

  it('opens a conflict view and a commit diff from the Source Control view', async () => {
    renderRepoWork((g) => {
      g.status.mockResolvedValue(
        makeStatus({
          branch: 'main',
          changes: [
            {
              path: 'c.txt',
              index: 'U',
              worktree: 'U',
              isConflict: true,
              isUntracked: false,
              isIgnored: false
            }
          ]
        })
      )
      g.log.mockResolvedValue([
        {
          hash: 'h1',
          shortHash: 'h1',
          author: 'T',
          date: new Date().toISOString(),
          subject: 'first'
        }
      ])
      g.commitDiff.mockResolvedValue({ files: [], diff: { binary: false, hunks: [] } })
    })

    // Switch to the Source Control view via the rail entry.
    fireEvent.click(await screen.findByLabelText(/Controle de versão/))
    // Click the conflict row → a conflict tab opens (readFile '' → resolved state).
    fireEvent.click(await screen.findByRole('button', { name: /c\.txt/ }))
    expect(await screen.findByText('Sem conflitos neste arquivo')).toBeTruthy()

    // Open history and select a commit → a commit-diff tab opens.
    fireEvent.click(screen.getByLabelText('Histórico'))
    fireEvent.click(await screen.findByText('first'))
    expect(await screen.findByText('0 arquivos alterados')).toBeTruthy()
  })
})

describe('WorkUI — Agent Change Review (M11)', () => {
  it('surfaces the review bar and opens the panel + a file when the set is non-empty', async () => {
    // The review store loads a one-file pending set on mount.
    ;(window.hive.review.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      changes: [
        {
          path: 'src/a.txt',
          status: 'modified',
          diff: { hunks: [], binary: false },
          adds: 2,
          dels: 1
        }
      ],
      turns: []
    })

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )

    // The ambient review bar shows the pending count.
    expect(await screen.findByText('1 mudança pendente')).toBeTruthy()

    // Revisar → opens the "Revisão do agente" sidebar view (its grouped list).
    fireEvent.click(screen.getByText(/Revisar/))
    expect(await screen.findByText('Modificados')).toBeTruthy()
    expect(screen.getByText('a.txt')).toBeTruthy()

    // Clicking the row opens the file in the editor (T15 layers the inline
    // diff) — an editor tab for it appears.
    fireEvent.click(screen.getByLabelText('Abrir diferenças de src/a.txt'))
    const tabs = await screen.findAllByText('a.txt')
    expect(tabs.length).toBeGreaterThan(1) // the panel row + the new editor tab
  })
})

/**
 * Second Brain — asking from anywhere (SB-R9) and the health-check cadence
 * (SB-R10). This suite covers the *wiring* WorkUI owns: the two keyboard
 * reaches, the single launch point that keeps the cadence ledger, and the two
 * ambient surfaces that read from it. The surfaces themselves are covered by
 * their own suites in `secondBrain/`.
 */
describe('WorkUI — Second Brain ask + health cadence (M12)', () => {
  type BrainMock = ReturnType<typeof createHiveSecondBrainMock>

  /** A workspace whose vault exists, with the health the test wants. */
  function withVault(health: Partial<VaultHealth> = {}): BrainMock {
    const brain = window.hive.secondBrain as unknown as BrainMock
    brain.getVault.mockResolvedValue({
      path: '/home/user/my-workspace/second-brain',
      name: 'second-brain',
      rawPending: 0
    })
    brain.getHealth.mockResolvedValue({ ...FRESH_HEALTH, ...health })
    return brain
  }

  function renderWork(): void {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )
  }

  it('Ctrl+Shift+B opens the Second Brain view, the shortcut the rail advertises', async () => {
    withVault()
    renderWork()

    expect(screen.getByTestId('file-tree')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'B', ctrlKey: true, shiftKey: true })

    expect(await screen.findByText('Perguntar à base')).toBeTruthy()
    expect(screen.queryByTestId('file-tree')).toBeNull()
  })

  it('Ctrl+Shift+K opens the ask surface from anywhere, without touching the sidebar', async () => {
    withVault()
    renderWork()

    expect(screen.queryByLabelText('Sua pergunta')).toBeNull()
    fireEvent.keyDown(window, { key: 'K', ctrlKey: true, shiftKey: true })

    expect(await screen.findByLabelText('Sua pergunta')).toBeTruthy()
    // The Explorer stays where it was — asking is not a navigation.
    expect(screen.getByTestId('file-tree')).toBeTruthy()
  })

  it('a Second Brain command opens a conversation of its OWN instead of hijacking the one on screen', async () => {
    withVault()
    renderWork()
    // A conversation is on screen and (per background-turns) keeps running.
    fireEvent.click(screen.getByText('simular conversa em andamento'))
    fireEvent.click(screen.getByLabelText('Bases de conhecimento'))

    fireEvent.click(await screen.findByText('Ingerir'))

    expect(chatHandle.launchCreation).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({ prompt: '/second-brain-ingest' })
      })
    )
    // Never the append-to-the-current-conversation path.
    expect(chatHandle.launchAction).not.toHaveBeenCalled()
  })

  it('says the previous conversation went to the background, and takes the user back to it', async () => {
    withVault()
    renderWork()
    fireEvent.click(screen.getByText('simular conversa em andamento'))
    fireEvent.click(screen.getByLabelText('Bases de conhecimento'))
    fireEvent.click(await screen.findByText('Revisar'))

    expect(await screen.findByText(/abriu uma conversa nova/)).toBeTruthy()
    fireEvent.click(screen.getByText('Voltar para ela'))

    expect(chatHandle.openSession).toHaveBeenCalledWith('conversa-atual')
    await waitFor(() => expect(screen.queryByText(/abriu uma conversa nova/)).toBeNull())
  })

  it('stays quiet when there was no conversation to background', async () => {
    withVault()
    renderWork()
    fireEvent.click(screen.getByLabelText('Bases de conhecimento'))

    fireEvent.click(await screen.findByText('Ingerir'))

    expect(chatHandle.launchCreation).toHaveBeenCalled()
    expect(screen.queryByText(/abriu uma conversa nova/)).toBeNull()
  })

  it('records the cadence at the single launch point: ingest counts, a check resets (SB-R10.2/10.3)', async () => {
    const brain = withVault()
    renderWork()
    fireEvent.click(screen.getByLabelText('Bases de conhecimento'))

    fireEvent.click(await screen.findByText('Ingerir'))
    await waitFor(() => expect(brain.noteIngest).toHaveBeenCalledWith('/home/user/my-workspace'))
    expect(brain.noteLint).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Revisar'))
    await waitFor(() => expect(brain.noteLint).toHaveBeenCalledWith('/home/user/my-workspace'))
  })

  it('a due base marks the rail entry and floats the reminder, whose "Depois" snoozes it (SB-R10.4/10.5)', async () => {
    const brain = withVault({ ingestsSinceLint: 10, reason: 'ingests', due: true })
    brain.snoozeHealth.mockResolvedValue({ ...FRESH_HEALTH, ingestsSinceLint: 10 })
    renderWork()

    // The reminder announces itself, and the rail says so in its own name.
    expect(await screen.findByRole('status', { name: 'Hora do health-check' })).toBeTruthy()
    expect(screen.getByLabelText('Bases de conhecimento — revisão pendente')).toBeTruthy()

    fireEvent.click(screen.getByText('Depois'))
    await waitFor(() => expect(brain.snoozeHealth).toHaveBeenCalledWith('/home/user/my-workspace'))
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Hora do health-check' })).toBeNull()
    )
  })

  it('"Revisar agora" on the reminder launches the check and clears it', async () => {
    const brain = withVault({ ingestsSinceLint: 12, reason: 'ingests', due: true })
    brain.noteLint.mockResolvedValue(FRESH_HEALTH)
    renderWork()

    fireEvent.click(await screen.findByText('Revisar agora'))
    await waitFor(() => expect(brain.noteLint).toHaveBeenCalledWith('/home/user/my-workspace'))
    await waitFor(() => expect(screen.queryByText('Hora do health-check')).toBeNull())
  })
})

/**
 * mcp-logs — the MCP console's shell wiring: the status-bar cluster that
 * reports MCP activity while the dock is closed, the dock itself, and the two
 * other ways in (the Ctrl+Shift+M shortcut and the manager's "Ver logs de
 * uso"). The console's own behaviour lives in `mcpLogs/McpConsole.test.ts`;
 * what's asserted here is only that WorkUI opens, closes and feeds it.
 */
describe('WorkUI — MCP console dock (mcp-logs)', () => {
  /** One classified log entry, as the bridge would deliver it. */
  function logEntry(overrides: Partial<McpLogEntry> = {}): McpLogEntry {
    return {
      id: 'f#1',
      server: 'playwright',
      at: Date.parse('2026-08-06T16:41:18Z'),
      level: 'info',
      kind: 'tool-call',
      text: 'browser_navigate',
      detail: '',
      sessionId: 's1',
      tool: 'browser_navigate',
      durationMs: null,
      transport: null,
      serverVersion: null,
      raw: '{}',
      ...overrides
    }
  }

  function renderWork(entries: McpLogEntry[] = []): Window['hive'] {
    const hive = createHiveMock()
    hive.mcpLogs.read = vi.fn(async () => entries)
    hive.mcpLogs.sources = vi.fn(async () =>
      entries.length === 0 ? [] : [{ server: 'playwright', dir: '/d', files: 1, lastActivityAt: 1 }]
    )
    vi.stubGlobal('hive', hive)
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )
    return hive
  }

  const clusterName = 'Abrir o console de atividade dos servidores MCP'

  it('keeps the dock closed until asked, reporting the last server in the status bar', async () => {
    renderWork([logEntry()])
    const cluster = await screen.findByRole('button', { name: clusterName })
    expect(within(cluster).getByText('playwright')).toBeTruthy()
    expect(document.querySelector('.wb-mcplog')).toBeNull()
  })

  it('counts errors in the status bar without opening anything', async () => {
    renderWork([logEntry({ level: 'error', kind: 'stderr', text: 'boom' })])
    const cluster = await screen.findByRole('button', { name: clusterName })
    await waitFor(() => expect(within(cluster).getByText('1')).toBeTruthy())
  })

  it('opens and closes the dock from the status-bar cluster', async () => {
    renderWork([logEntry()])
    fireEvent.click(await screen.findByRole('button', { name: clusterName }))

    expect(await screen.findByRole('region', { name: 'Console MCP' })).toBeTruthy()
    expect(screen.getByText('browser_navigate')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar o console MCP' }))
    await waitFor(() => expect(document.querySelector('.wb-mcplog')).toBeNull())
  })

  it('toggles the dock with Ctrl+Shift+M', async () => {
    renderWork([logEntry()])
    await screen.findByRole('button', { name: clusterName })

    fireEvent.keyDown(window, { key: 'M', ctrlKey: true, shiftKey: true })
    expect(await screen.findByRole('region', { name: 'Console MCP' })).toBeTruthy()

    fireEvent.keyDown(window, { key: 'M', ctrlKey: true, shiftKey: true })
    await waitFor(() => expect(document.querySelector('.wb-mcplog')).toBeNull())
  })

  it('teaches the console when a workspace has never used an MCP server', async () => {
    renderWork([])
    fireEvent.click(await screen.findByRole('button', { name: clusterName }))
    // Scoped to the dock: the status cluster carries the same idle sentence.
    const dock = await screen.findByRole('region', { name: 'Console MCP' })
    expect(within(dock).getByText('Nenhuma atividade MCP ainda')).toBeTruthy()
    expect(within(dock).getByRole('button', { name: 'Configurar servidores MCP' })).toBeTruthy()
  })
})

/**
 * mcp-logs — the console's other two entry points: the manager's "Ver logs de
 * uso" bridge, and the `.mcp.json` catalog read that lets the console flag a
 * server logging here that this workspace never configured.
 */
describe('WorkUI — MCP manager ↔ console bridge (mcp-logs)', () => {
  function renderWithServer(listResult?: Promise<unknown>): Window['hive'] {
    const hive = createHiveMock()
    hive.mcp.list = vi.fn(
      () =>
        (listResult ??
          Promise.resolve([
            { name: 'playwright', transport: 'stdio', command: 'npx', enabled: true }
          ])) as ReturnType<typeof hive.mcp.list>
    )
    vi.stubGlobal('hive', hive)
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onSelectTheme: vi.fn()
      })
    )
    return hive
  }

  it('opens the console from the manager and closes the manager behind it', async () => {
    renderWithServer()
    fireEvent.click(screen.getByRole('button', { name: 'Servidores MCP' }))

    // Expand the server row to reach its detail actions.
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de playwright' }))
    fireEvent.click(await screen.findByText('Ver logs de uso'))

    expect(await screen.findByRole('region', { name: 'Console MCP' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Ver logs de uso')).toBeNull())
  })

  it('shows the console even when the server catalog cannot be read', async () => {
    renderWithServer(Promise.reject(new Error('sem .mcp.json')))
    fireEvent.keyDown(window, { key: 'M', ctrlKey: true, shiftKey: true })
    expect(await screen.findByRole('region', { name: 'Console MCP' })).toBeTruthy()
  })
})
