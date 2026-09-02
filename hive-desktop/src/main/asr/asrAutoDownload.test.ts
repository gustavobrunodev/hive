import { describe, expect, it, vi } from 'vitest'
import { autoDownloadOnStartup } from './asrAutoDownload'

/**
 * The startup fetch, as four decisions rather than four launches. Everything
 * this rule reads is a boolean, so the whole of it is assertable without a
 * download manager, a disk or an app.
 */

function deps(
  overrides: Partial<Parameters<typeof autoDownloadOnStartup>[0]> = {}
): Parameters<typeof autoDownloadOnStartup>[0] {
  return {
    installed: () => false,
    downloading: () => false,
    allowed: () => true,
    start: vi.fn(),
    ...overrides
  }
}

describe('autoDownloadOnStartup', () => {
  it('fetches the model when a fresh install has none', () => {
    const start = vi.fn()
    expect(autoDownloadOnStartup(deps({ start }))).toBe('started')
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the model is already on disk', () => {
    const start = vi.fn()
    expect(autoDownloadOnStartup(deps({ installed: () => true, start }))).toBe('installed')
    expect(start).not.toHaveBeenCalled()
  })

  it('does not start a second transfer over one already running', () => {
    // A relaunch while the first download was still going, which is exactly
    // what an impatient restart during a 671 MB transfer looks like.
    const start = vi.fn()
    expect(autoDownloadOnStartup(deps({ downloading: () => true, start }))).toBe('downloading')
    expect(start).not.toHaveBeenCalled()
  })

  it('honours a user who removed the model, instead of refilling their disk', () => {
    // The whole reason this is a rule and not an `if (!installed) start()`.
    // "Remover" exists to give 671 MB back; a startup that undoes it on the
    // next launch turns the button into a lie.
    const start = vi.fn()
    expect(autoDownloadOnStartup(deps({ allowed: () => false, start }))).toBe('declined')
    expect(start).not.toHaveBeenCalled()
  })

  it('checks what is on disk before what the user asked for', () => {
    // Order matters: someone who removed the model and then downloaded it again
    // from the panel has `allowed === false` still recorded on the very launch
    // where the files are present. Reporting "declined" there would be a lie
    // about a model that is sitting right there, ready.
    expect(autoDownloadOnStartup(deps({ installed: () => true, allowed: () => false }))).toBe(
      'installed'
    )
  })
})
