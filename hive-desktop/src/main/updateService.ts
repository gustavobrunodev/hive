/**
 * App self-update service (app-settings): wraps electron-updater's
 * `autoUpdater` behind the same injected-deps shape as the other services
 * (workspaceService's `DialogLike` precedent) so this file stays
 * electron-updater-import-free and testable with a fake.
 *
 * The flow is deliberately user-driven (never auto): the renderer's app
 * settings sheet calls `check()` → `download()` → `install()` explicitly,
 * and every state transition streams back as one `UpdateEvent` — the same
 * event-stream pattern as agent/bmad events.
 */

/** One update-flow state transition, streamed to the renderer. */
export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'not-available' }
  | { type: 'available'; version: string }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

/** Static app facts for the settings sheet — one invoke, no stream. */
export interface AppInfo {
  name: string
  version: string
  /** False in dev / unpacked builds, where electron-updater can't operate — the sheet explains instead of offering a dead button. */
  updatesSupported: boolean
}

/** Structural slice of electron-updater's `AppUpdater` that this service consumes. */
export interface UpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  on(event: string, listener: (payload?: unknown) => void): unknown
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(): void
}

export interface UpdateService {
  onEvent(listener: (event: UpdateEvent) => void): () => void
  check(): void
  download(): void
  install(): void
}

/** electron-updater payloads are loosely typed here — pull the fields we render defensively. */
function versionOf(payload: unknown): string {
  const version = (payload as { version?: unknown } | undefined)?.version
  return typeof version === 'string' ? version : ''
}

function percentOf(payload: unknown): number {
  const percent = (payload as { percent?: unknown } | undefined)?.percent
  return typeof percent === 'number' ? percent : 0
}

export function createUpdateService(updater: UpdaterLike, supported: boolean): UpdateService {
  const listeners = new Set<(event: UpdateEvent) => void>()

  function emit(event: UpdateEvent): void {
    for (const listener of listeners) listener(event)
  }

  if (supported) {
    // User-driven flow: no silent background downloads/installs.
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    updater.on('checking-for-update', () => emit({ type: 'checking' }))
    updater.on('update-not-available', () => emit({ type: 'not-available' }))
    updater.on('update-available', (info) => emit({ type: 'available', version: versionOf(info) }))
    updater.on('download-progress', (progress) =>
      emit({ type: 'progress', percent: percentOf(progress) })
    )
    updater.on('update-downloaded', (info) =>
      emit({ type: 'downloaded', version: versionOf(info) })
    )
    updater.on('error', (err) =>
      emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
    )
  }

  return {
    onEvent(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    check() {
      if (!supported) return
      // 'checking' is emitted by the updater's own 'checking-for-update';
      // rejections surface through its 'error' event — the catch here only
      // guards against double-reporting a rejection that was already emitted.
      void updater.checkForUpdates().catch(() => {})
    },
    download() {
      if (!supported) return
      void updater.downloadUpdate().catch(() => {})
    },
    install() {
      if (!supported) return
      updater.quitAndInstall()
    }
  }
}
