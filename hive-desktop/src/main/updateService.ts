/**
 * App self-update service (npm-distribution, ND-C5): the app's own version +
 * self-update flow, now backed by the public npm registry instead of
 * electron-updater. `UpdateEvent`, `AppInfo`, `UpdateService` and
 * `createUpdateService` keep their names — only the backing changed, and the
 * types only grew (new events/fields), so the preload bridge and today's
 * `AppSettingsSheet.tsx` keep working unmodified in spirit (see that file's
 * own doc comment for the one narrow, additive exception this forced).
 *
 * Fully Electron-free and unit-testable via DI, following the DialogLike /
 * McpProbe precedent used elsewhere in this codebase: the registry HTTP seam,
 * the tarball download seam, and the per-OS apply seam are all injected, so
 * the whole state machine is exercised in tests against fakes — no network,
 * no real filesystem writes beyond a throwaway temp dir, no real installer
 * ever spawned (design.md §6, ND-R7.3).
 */

import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'

import { fetchLatestRelease, fetchPayload, isNewer, type RegistryClient } from './npmRegistry'
import {
  DownloadCancelledError,
  IntegrityMismatchError,
  downloadAndExtractUpdate,
  type Downloader,
  type DownloadSource
} from './updateDownload'
import { resolveApplyStrategy, type WindowsApplyDeps } from './updateApply'

/** One update-flow state transition, streamed to the renderer. */
export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'not-available' }
  | { type: 'available'; version: string; bytes: number | null; notes: string | null }
  | { type: 'progress'; percent: number; transferred: number; total: number }
  | { type: 'verifying' }
  | { type: 'downloaded'; version: string; installerPath: string }
  | { type: 'applying' }
  | { type: 'error'; message: string; kind: 'network' | 'integrity' | 'apply' }

/** Static app facts for the settings sheet — one invoke, no stream. */
export interface AppInfo {
  name: string
  version: string
  /** False in dev / unpacked builds — the sheet explains instead of offering a dead button (ND-R6.8). */
  updatesSupported: boolean
  /** False off-Windows in v1 (ND-C6) — no apply strategy exists, so `install()` is never wired to a control. */
  canApply: boolean
  /** `Date.now()` of the most recent check attempt (explicit or silent), or `null` before the first one. */
  lastCheckedAt: number | null
}

/**
 * Everything `createUpdateService` needs to run the flow without importing
 * `electron` itself (the DialogLike/McpProbe DI precedent): the registry and
 * download HTTP seams, the per-OS apply seam, static facts about this build
 * (name/version/platform), and where to stage downloads. The real
 * implementations of `registryClient`/`downloader` are `createRegistryClient`/
 * `createDownloader` below; tests inject fakes instead.
 */
export interface UpdateServiceDeps {
  registryClient: RegistryClient
  downloader: Downloader
  /** Spawn+quit for the Windows apply strategy; simply unused (never called) off-Windows. */
  applyDeps: WindowsApplyDeps
  /** The main npm package to query for the `latest` release (design.md §2). */
  packageName: string
  /** `app.getVersion()` — compared against the discovered release (ND-R2.2). */
  currentVersion: string
  /** `process.platform` — resolves the apply strategy (ND-C6). */
  platform: NodeJS.Platform
  /** Root staging directory; each version gets its own `<root>/<version>/` (design.md §2). */
  stagingRoot: string
  /** `app.isPackaged` — false in dev/unpacked, where the whole flow is a no-op (ND-R6.8). */
  supported: boolean
}

export interface UpdateService {
  onEvent(listener: (event: UpdateEvent) => void): () => void
  /** `explicit` is true for a user-triggered check, false for launch/periodic discovery (ND-R2.3/ND-R2.4). */
  check(explicit: boolean): void
  download(): void
  install(): void
  /** Aborts an in-flight download (ND-R3.4); a no-op if nothing is downloading. */
  cancel(): void
  getCanApply(): boolean
  getLastCheckedAt(): number | null
  /** The last successfully downloaded installer's path, or `null` before one exists (ND-R4.3's "reveal"). */
  getInstallerPath(): string | null
}

// ND-R2.4: discovery is time-boxed so a dead/slow registry can never hang a
// background check. `fetchLatestRelease` already degrades any rejection
// (including this timeout firing) to "no update" for the caller — see its
// own doc comment. 8s sits at the low end of the "8-10s" range this was
// scoped at; no literal precedent value was recorded from the T1 spike
// (it validated response *content*, not a timeout), so this mirrors
// `mcpProbe.ts`'s existing `PROBE_TIMEOUT_MS` convention at a slightly
// shorter duration, since this is a single small JSON GET, not a full
// process handshake.
const REGISTRY_TIMEOUT_MS = 8_000

/**
 * Real `RegistryClient`: a time-boxed `fetch`. Non-2xx responses reject too
 * (npm returns 404 for an unpublished package/version, which should read as
 * "nothing to offer" rather than valid JSON) — `fetchLatestRelease` maps any
 * rejection to its "no update" sentinel; `fetchPayload` lets it propagate.
 */
export function createRegistryClient(): RegistryClient {
  return {
    async fetchJson(url: string): Promise<unknown> {
      const response = await fetch(url, { signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS) })
      if (!response.ok) {
        throw new Error(`Registry request failed (${response.status}): ${url}`)
      }
      return response.json()
    }
  }
}

/**
 * Real `Downloader`: streams the registry tarball via `fetch`, converting the
 * web `ReadableStream` response body to a Node stream (`Readable.fromWeb`) so
 * `updateDownload.ts` can pipe it through its hashing `Transform` unchanged.
 * `content-length` becomes `total` when the registry sends one. Deliberately
 * not time-boxed — ND-R3 has no such requirement (only discovery is,
 * ND-R2.4); a ~90 MB installer over a slow connection is legitimately slow,
 * not a hang, and `cancel()` already covers the "stuck" case (ND-R3.4).
 */
export function createDownloader(): Downloader {
  return {
    async download(url: string): Promise<DownloadSource> {
      const response = await fetch(url)
      if (!response.ok || response.body === null) {
        throw new Error(`Download failed (${response.status}): ${url}`)
      }
      const contentLength = Number(response.headers.get('content-length'))
      const total = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null
      return {
        total,
        stream: Readable.fromWeb(response.body as WebReadableStream<Uint8Array>)
      }
    }
  }
}

/** The staging directory for one version (design.md §2: `userData/updates/<version>/`). */
function stagingDirFor(stagingRoot: string, version: string): string {
  return join(stagingRoot, version)
}

/**
 * Removes every staging subdirectory except `keepVersion` (ND-R3.5). Called
 * at construction (`keepVersion: null` — nothing is pending yet on a cold
 * start, so anything left over from a crashed/interrupted previous session is
 * stale) and again after a check discovers a (possibly different) pending
 * version, and after a download succeeds or is cancelled (keeping only the
 * version currently in play). Best-effort and silent: a missing staging root
 * (nothing ever downloaded) is not an error, and this must never delay the
 * caller (fire-and-forget at construction, matching ND-R2.5's spirit).
 */
async function cleanupStaleStaging(stagingRoot: string, keepVersion: string | null): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(stagingRoot)
  } catch {
    return
  }
  await Promise.all(
    entries
      .filter((name) => name !== keepVersion)
      .map((name) => rm(join(stagingRoot, name), { recursive: true, force: true }))
  )
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function createUpdateService(deps: UpdateServiceDeps): UpdateService {
  const {
    registryClient,
    downloader,
    applyDeps,
    packageName,
    currentVersion,
    platform,
    stagingRoot,
    supported
  } = deps

  const listeners = new Set<(event: UpdateEvent) => void>()
  function emit(event: UpdateEvent): void {
    for (const listener of listeners) listener(event)
  }

  const applyStrategy = resolveApplyStrategy(platform, applyDeps)
  const canApply = applyStrategy !== null

  let lastCheckedAt: number | null = null
  let pending: { version: string; platformPackage: string } | null = null
  let installerPath: string | null = null
  let abortController: AbortController | null = null

  if (supported) {
    // ND-R3.5: nothing is pending yet on a cold start — fire-and-forget so
    // this never delays anything the caller does next.
    void cleanupStaleStaging(stagingRoot, null)
  }

  async function runCheck(explicit: boolean): Promise<void> {
    // A visible "checking…" beat only makes sense for a check the user asked
    // for; a silent background/periodic check must produce nothing until (if
    // ever) it finds real news (ND-R2.4/ND-R2.5).
    if (explicit) emit({ type: 'checking' })

    // fetchLatestRelease never throws (npmRegistry.ts's own contract): every
    // failure — offline, DNS, 5xx, timeout, malformed payload — degrades to
    // its "no update" sentinel. That collapses "the registry is down" and
    // "there is genuinely nothing newer" into the same outcome here, which is
    // the deliberate, load-bearing consequence of that contract (see this
    // file's final doc note) — this service treats both as `not-available`.
    const release = await fetchLatestRelease(registryClient, packageName)
    lastCheckedAt = Date.now()

    if (!isNewer(release.version, currentVersion) || release.platformPackage === null) {
      pending = null
      if (explicit) emit({ type: 'not-available' })
      return
    }

    try {
      // fetchPayload DOES throw on failure — the one point in check() that
      // can surface a genuine, freshly-observed registry error (ND-R2.4).
      const payload = await fetchPayload(registryClient, release.platformPackage, release.version)
      pending = { version: release.version, platformPackage: release.platformPackage }
      await cleanupStaleStaging(stagingRoot, pending.version)
      emit({
        type: 'available',
        version: release.version,
        bytes: payload.bytes,
        notes: release.notes
      })
    } catch (err) {
      pending = null
      if (explicit) emit({ type: 'error', message: messageOf(err), kind: 'network' })
    }
  }

  async function runDownload(): Promise<void> {
    if (pending === null) return
    const { version, platformPackage } = pending
    const controller = new AbortController()
    abortController = controller

    let verifyingEmitted = false
    const onProgress = (progress: { transferred: number; total: number | null }): void => {
      const total = progress.total
      const percent =
        total !== null && total > 0
          ? Math.min(100, Math.round((progress.transferred / total) * 100))
          : 0
      emit({ type: 'progress', percent, transferred: progress.transferred, total: total ?? 0 })
      // Hashing happens incrementally as chunks arrive (updateDownload.ts),
      // so by the time the stream has delivered every byte, verification is
      // effectively already underway — this is the earliest observable point
      // for a "verifying" beat (design.md §5's trust moment) without a
      // dedicated mid-function hook from downloadAndExtractUpdate itself.
      if (total !== null && progress.transferred >= total && !verifyingEmitted) {
        verifyingEmitted = true
        emit({ type: 'verifying' })
      }
    }

    try {
      const payload = await fetchPayload(registryClient, platformPackage, version)
      const result = await downloadAndExtractUpdate(
        downloader,
        payload,
        stagingDirFor(stagingRoot, version),
        { onProgress, signal: controller.signal }
      )
      // Total was never known (no content-length, no payload.bytes) — the
      // progress-based trigger above never fired, so emit the beat now,
      // right before reporting success, as the documented fallback.
      if (!verifyingEmitted) emit({ type: 'verifying' })
      installerPath = result.installerPath
      await cleanupStaleStaging(stagingRoot, version)
      emit({ type: 'downloaded', version, installerPath: result.installerPath })
    } catch (err) {
      if (err instanceof DownloadCancelledError) {
        // Cancellation isn't a failure (ND-R3.4) — no error event. The
        // renderer's own state machine (design.md §5) is expected to return
        // to a prior state on its own, since nothing further streams here.
        await cleanupStaleStaging(stagingRoot, pending?.version ?? null)
      } else if (err instanceof IntegrityMismatchError) {
        emit({ type: 'error', message: messageOf(err), kind: 'integrity' })
      } else {
        emit({ type: 'error', message: messageOf(err), kind: 'network' })
      }
    } finally {
      abortController = null
    }
  }

  async function runInstall(): Promise<void> {
    if (installerPath === null || applyStrategy === null) {
      // Defensive only — the IPC layer/UI must never expose this control
      // unless `canApply` is true and a download has already finished.
      emit({ type: 'error', message: 'No downloaded update is ready to apply.', kind: 'apply' })
      return
    }
    emit({ type: 'applying' })
    try {
      await applyStrategy.apply(installerPath)
    } catch (err) {
      // ND-R4.4: never delete the installer on an apply failure — the user
      // can still run it manually, and nothing here ever calls `rm` on it.
      emit({ type: 'error', message: messageOf(err), kind: 'apply' })
    }
  }

  return {
    onEvent(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    check(explicit) {
      if (!supported) return
      void runCheck(explicit)
    },
    download() {
      if (!supported) return
      void runDownload()
    },
    install() {
      if (!supported) return
      void runInstall()
    },
    cancel() {
      abortController?.abort()
    },
    getCanApply: () => canApply,
    getLastCheckedAt: () => lastCheckedAt,
    getInstallerPath: () => installerPath
  }
}
