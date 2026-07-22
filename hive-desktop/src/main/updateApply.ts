/**
 * Per-OS "install the downloaded update" step (ND-C6, design.md §3). The
 * download/verify/extract stages (`updateDownload.ts`) are platform-agnostic;
 * only running the installer and relaunching is not. v1 ships Windows only —
 * every other platform has no strategy at all, which the caller (T6's
 * `updateService`) reads as `canApply: false` and a flow that stops at
 * "downloaded", offering to reveal the installer instead (ND-R4.3).
 */
export interface ApplyStrategy {
  /** Runs the installer at `installerPath` and hands control to it (ND-R4.2). Never called unless `canApply` is true and the user explicitly asked (ND-R4.5). */
  apply(installerPath: string): Promise<void>
}

/**
 * The slice of `child_process.spawn` this module needs — declared locally
 * (the `DialogLike` precedent in `workspaceService.ts`) instead of importing
 * `node:child_process` and calling it directly, so a fake can stand in for
 * the real thing in tests without ever spawning a process. The real
 * implementation's return value (`ChildProcess`) satisfies this by
 * structural typing; a test fake only needs an `unref()`.
 */
export type SpawnLike = (
  command: string,
  args: readonly string[],
  options: { detached: true; stdio: 'ignore' }
) => { unref(): void }

/**
 * Dependencies the Windows apply strategy needs, both injected so this
 * module never imports `node:child_process` or `electron` itself: `spawn`
 * (the NSIS installer) and `quit` (the `app.quit()` equivalent that lets the
 * installer replace the running install).
 */
export interface WindowsApplyDeps {
  spawn: SpawnLike
  quit: () => void
}

/**
 * Windows (NSIS) apply strategy: spawn the installer detached and
 * stdio-ignored so it outlives this process, `unref()` it so it doesn't keep
 * the event loop alive, then quit — in that exact order (ND-C6). Quitting
 * before the installer has at least been spawned+unref'd would race the
 * installer's own startup against this process's teardown.
 */
export function createWindowsApplyStrategy(deps: WindowsApplyDeps): ApplyStrategy {
  return {
    async apply(installerPath: string): Promise<void> {
      const child = deps.spawn(installerPath, [], { detached: true, stdio: 'ignore' })
      child.unref()
      deps.quit()
    }
  }
}

/**
 * Resolves the `ApplyStrategy` for `platform` (ND-C6). Only `win32` has one
 * in v1; every other platform resolves to `null`, which the caller treats as
 * `canApply: false` — no strategy exists to call, so no spawn ever happens
 * off-Windows, honest rather than a silent no-op (ND-R4.3).
 */
export function resolveApplyStrategy(
  platform: NodeJS.Platform,
  deps: WindowsApplyDeps
): ApplyStrategy | null {
  return platform === 'win32' ? createWindowsApplyStrategy(deps) : null
}
