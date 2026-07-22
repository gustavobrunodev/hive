import { describe, expect, it, vi } from 'vitest'
import {
  createWindowsApplyStrategy,
  resolveApplyStrategy,
  type SpawnLike,
  type WindowsApplyDeps
} from './updateApply'

/** A `SpawnLike` that records the call and returns a fake child whose `unref()` is also recorded. */
function recordingSpawn(order: string[]): SpawnLike {
  return (command, args, options) => {
    order.push(`spawn:${command}:${JSON.stringify(args)}:${JSON.stringify(options)}`)
    return { unref: () => order.push('unref') }
  }
}

describe('createWindowsApplyStrategy', () => {
  it('spawns the installer detached+stdio-ignored, unrefs, then quits — in that order', async () => {
    const order: string[] = []
    const deps: WindowsApplyDeps = {
      spawn: recordingSpawn(order),
      quit: () => order.push('quit')
    }
    const strategy = createWindowsApplyStrategy(deps)

    await strategy.apply('C:\\Users\\dev\\hive-desktop-0.2.0-setup.exe')

    expect(order).toEqual([
      'spawn:C:\\Users\\dev\\hive-desktop-0.2.0-setup.exe:[]:{"detached":true,"stdio":"ignore"}',
      'unref',
      'quit'
    ])
  })

  it('passes no arguments to the installer and the exact detached/ignored options', async () => {
    const spawn = vi.fn().mockReturnValue({ unref: vi.fn() })
    const quit = vi.fn()

    await createWindowsApplyStrategy({ spawn, quit }).apply('installer.exe')

    expect(spawn).toHaveBeenCalledWith('installer.exe', [], { detached: true, stdio: 'ignore' })
    expect(quit).toHaveBeenCalledTimes(1)
  })

  it('calls spawn, unref and quit exactly once each', async () => {
    const unref = vi.fn()
    const spawn = vi.fn().mockReturnValue({ unref })
    const quit = vi.fn()

    await createWindowsApplyStrategy({ spawn, quit }).apply('installer.exe')

    expect(spawn).toHaveBeenCalledTimes(1)
    expect(unref).toHaveBeenCalledTimes(1)
    expect(quit).toHaveBeenCalledTimes(1)
  })
})

describe('resolveApplyStrategy', () => {
  it('resolves a Windows strategy on win32', () => {
    const deps: WindowsApplyDeps = {
      spawn: vi.fn().mockReturnValue({ unref: vi.fn() }),
      quit: vi.fn()
    }
    const strategy = resolveApplyStrategy('win32', deps)
    expect(strategy).not.toBeNull()
  })

  it.each(['darwin', 'linux', 'aix', 'freebsd'] as const)(
    '%s has no v1 apply strategy — resolves to null and never spawns',
    (platform) => {
      const spawn = vi.fn()
      const quit = vi.fn()
      const strategy = resolveApplyStrategy(platform, { spawn, quit })

      expect(strategy).toBeNull()
      expect(spawn).not.toHaveBeenCalled()
      expect(quit).not.toHaveBeenCalled()
    }
  )
})
