// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UpdateCenter } from './UpdateCenter'
import type { UpdateEventIn } from './updateFlow'

/**
 * `UpdateCenter` (npm-distribution T13, design.md §5 Tier 3) — the
 * redesigned `AppSettingsSheet`. Self-sufficient (its own `window.hive.app`
 * subscriptions), so every test here stubs the global `hive` bridge and
 * drives it directly — no provider/wrapper needed.
 */

interface AppInfoStub {
  name: string
  version: string
  updatesSupported: boolean
  canApply: boolean
  lastCheckedAt: number | null
  skippedVersion: string | null
}

function defaultInfo(overrides: Partial<AppInfoStub> = {}): AppInfoStub {
  return {
    name: 'hive-desktop',
    version: '0.1.0',
    updatesSupported: true,
    canApply: true,
    lastCheckedAt: null,
    skippedVersion: null,
    ...overrides
  }
}

/** Installs a controllable `window.hive.app` stub; `emit` pushes an event to whatever listener `onUpdateEvent` currently holds. */
function stubHive(info: AppInfoStub): {
  emit: (event: UpdateEventIn) => void
  checkForUpdates: ReturnType<typeof vi.fn>
  downloadUpdate: ReturnType<typeof vi.fn>
  installUpdate: ReturnType<typeof vi.fn>
  cancelUpdate: ReturnType<typeof vi.fn>
  revealInstaller: ReturnType<typeof vi.fn>
} {
  let listener: ((event: UpdateEventIn) => void) | null = null
  const checkForUpdates = vi.fn(async () => undefined)
  const downloadUpdate = vi.fn(async () => undefined)
  const installUpdate = vi.fn(async () => undefined)
  const cancelUpdate = vi.fn(async () => undefined)
  const revealInstaller = vi.fn(async () => undefined)

  vi.stubGlobal('hive', {
    app: {
      info: vi.fn(async () => info),
      checkForUpdates,
      downloadUpdate,
      installUpdate,
      cancelUpdate,
      revealInstaller,
      skipVersion: vi.fn(async () => undefined),
      onUpdateEvent: vi.fn((cb: (event: UpdateEventIn) => void) => {
        listener = cb
        return () => {
          listener = null
        }
      })
    }
  })

  return {
    emit: (event: UpdateEventIn) => listener?.(event),
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    cancelUpdate,
    revealInstaller
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('UpdateCenter — unsupported (dev/unpacked, ND-R6.8)', () => {
  it('shows the honest dev note instead of any control', async () => {
    stubHive(defaultInfo({ updatesSupported: false }))
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText(
      'Atualizações automáticas ficam disponíveis apenas na versão instalada do aplicativo.'
    )
    expect(screen.queryByText('Atualizações')).toBeNull()
  })
})

describe('UpdateCenter — identity + status line', () => {
  it('shows the app name/version and "Verificado" once a check has happened', async () => {
    stubHive(defaultInfo({ lastCheckedAt: Date.now() }))
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Versão 0.1.0')
    expect(screen.getByText(/Verificado/)).toBeTruthy()
  })

  it('falls back to "Ainda não verificado" before any check has ever run (lastCheckedAt null), keeping the refresh button reachable', async () => {
    const hive = stubHive(defaultInfo({ lastCheckedAt: null }))
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Versão 0.1.0')
    expect(screen.queryByText(/Verificado/)).toBeNull()
    expect(screen.getByText('Ainda não verificado')).toBeTruthy()
    const refreshButton = screen.getByLabelText('Verificar atualizações agora')
    expect(refreshButton).toBeTruthy()
    fireEvent.click(refreshButton)
    expect(hive.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('the quiet refresh IconButton triggers an explicit check', async () => {
    const hive = stubHive(defaultInfo({ lastCheckedAt: Date.now() }))
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText(/Verificado/)
    fireEvent.click(screen.getByLabelText('Verificar atualizações agora'))
    expect(hive.checkForUpdates).toHaveBeenCalledTimes(1)
  })
})

describe('UpdateCenter — version-block states', () => {
  it('idle: nothing but the section heading', async () => {
    stubHive(defaultInfo())
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    expect(screen.queryByText('Você está na versão mais recente.')).toBeNull()
  })

  it('checking: shows the spinner label', async () => {
    const hive = stubHive(defaultInfo())
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    hive.emit({ type: 'checking' })
    await screen.findByText('Verificando atualizações…')
  })

  it('upToDate: shows the up-to-date status', async () => {
    const hive = stubHive(defaultInfo())
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    hive.emit({ type: 'not-available' })
    await screen.findByText('Você está na versão mais recente.')
  })

  it('available: shows the version transition + release notes, and the primary CTA downloads', async () => {
    const hive = stubHive(defaultInfo())
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    hive.emit({ type: 'available', version: '0.2.0', bytes: 1000, notes: 'Correções.' })
    await screen.findByText('0.1.0 → 0.2.0')

    fireEvent.click(screen.getByText('Atualizar agora'))
    expect(hive.downloadUpdate).toHaveBeenCalledTimes(1)

    // Release notes: collapsed by default behind an accordion trigger.
    expect(screen.getByText('Novidades desta versão')).toBeTruthy()
  })

  it('downloading: shows live progress and cancels', async () => {
    const hive = stubHive(defaultInfo())
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    hive.emit({ type: 'progress', percent: 41, transferred: 38_400_000, total: 92_100_000 })
    await screen.findByText(/41%/)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(hive.cancelUpdate).toHaveBeenCalledTimes(1)
  })

  it('verifying: shows the checksum label', async () => {
    const hive = stubHive(defaultInfo())
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    hive.emit({ type: 'verifying' })
    await screen.findByText('Verificando integridade')
  })

  it('downloaded (canApply): offers Reiniciar e instalar', async () => {
    const hive = stubHive(defaultInfo({ canApply: true }))
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    hive.emit({ type: 'downloaded', version: '0.2.0', installerPath: '/tmp/x.exe' })
    await screen.findByText('Pronto para instalar')
    fireEvent.click(screen.getByText('Reiniciar e instalar'))
    expect(hive.installUpdate).toHaveBeenCalledTimes(1)
  })

  it('downloaded (!canApply): offers Abrir instalador (ND-R4.3)', async () => {
    const hive = stubHive(defaultInfo({ canApply: false }))
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    hive.emit({ type: 'downloaded', version: '0.2.0', installerPath: '/tmp/x.AppImage' })
    await screen.findByText(/ainda não instala sozinho/)
    fireEvent.click(screen.getByText('Abrir instalador'))
    expect(hive.revealInstaller).toHaveBeenCalledTimes(1)
  })

  it('applying: shows the brief installing label', async () => {
    const hive = stubHive(defaultInfo())
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    hive.emit({ type: 'applying' })
    await screen.findByText('Instalando — o Hive volta sozinho em instantes.')
  })

  it('error (integrity): distinct message, Tentar de novo re-checks, Abrir instalador reveals', async () => {
    const hive = stubHive(defaultInfo())
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    hive.emit({ type: 'error', message: 'bad hash', kind: 'integrity' })
    await screen.findByText(/não pôde ser confirmado como íntegro/)

    fireEvent.click(screen.getByText('Tentar de novo'))
    expect(hive.checkForUpdates).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Abrir instalador'))
    expect(hive.revealInstaller).toHaveBeenCalledTimes(1)
  })

  it('error (network): shares the generic message', async () => {
    const hive = stubHive(defaultInfo())
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    hive.emit({ type: 'error', message: 'offline', kind: 'network' })
    await screen.findByText(/Não foi possível concluir a atualização/)
  })
})

describe('UpdateCenter — release notes render as markdown, safely', () => {
  it('renders markdown emphasis/headings without injecting raw HTML', async () => {
    const hive = stubHive(defaultInfo())
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    hive.emit({
      type: 'available',
      version: '0.2.0',
      bytes: null,
      notes: '### Novidades\n\n- Corrige <script>alert(1)</script> no explorador'
    })
    await screen.findByText('0.1.0 → 0.2.0')

    // Open the accordion to render its content into the DOM.
    fireEvent.click(screen.getByText('Novidades desta versão'))
    await screen.findByText('Novidades', { selector: 'h3' })
    // The literal "<script>" text renders as inert text content — react-markdown
    // (no rehype-raw, matching ui/markdown.tsx's existing convention) never
    // parses embedded HTML into real DOM elements.
    expect(document.querySelector('script')).toBeNull()
    expect(screen.getByText(/Corrige/)).toBeTruthy()
  })
})

describe('UpdateCenter — skipped-version recovery (ND-R5.5)', () => {
  it('shows the recovery row when a version is skipped, and hides it otherwise', async () => {
    stubHive(defaultInfo({ skippedVersion: null }))
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Atualizações')
    expect(screen.queryByText('Instalar mesmo assim')).toBeNull()
  })

  it('"Instalar mesmo assim" re-checks, and once that resolves to available, downloads automatically', async () => {
    const hive = stubHive(defaultInfo({ skippedVersion: '0.2.0' }))
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Você pulou a versão 0.2.0')

    fireEvent.click(screen.getByText('Instalar mesmo assim'))
    expect(hive.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(hive.downloadUpdate).not.toHaveBeenCalled()

    // The re-check discovers the exact version the user asked to install
    // anyway — not blocked by it having been recorded as skipped (main never
    // consults the skip list; suppressing the *announcement* is a renderer/
    // T14 concern, not a main-process gate on download itself).
    hive.emit({ type: 'available', version: '0.2.0', bytes: null, notes: null })
    await waitFor(() => {
      expect(hive.downloadUpdate).toHaveBeenCalledTimes(1)
    })
  })

  it('a plain (non-"instalar mesmo assim") available discovery never auto-downloads', async () => {
    const hive = stubHive(defaultInfo({ skippedVersion: '0.2.0' }))
    render(createElement(UpdateCenter, { open: true, onOpenChange: vi.fn() }))
    await screen.findByText('Você pulou a versão 0.2.0')

    hive.emit({ type: 'available', version: '0.3.0', bytes: null, notes: null })
    await screen.findByText('0.1.0 → 0.3.0')
    expect(hive.downloadUpdate).not.toHaveBeenCalled()
  })
})
