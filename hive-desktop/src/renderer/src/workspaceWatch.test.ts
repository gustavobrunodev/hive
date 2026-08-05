// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchWorkspaceShared } from './workspaceWatch'

type Change = { type: 'add' | 'change' | 'unlink'; path: string }

/**
 * Stands in for the bridge, recording every `watchWorkspace` call and exposing
 * the emit side — enough to see how many *real* subscriptions the renderer
 * opens, which is the whole point of the multiplexer (main keeps exactly one
 * watcher per window).
 */
function mockBridge(): {
  watch: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  emit: (change: Change) => void
} {
  const sinks: Array<(change: Change) => void> = []
  const stop = vi.fn()
  const watch = vi.fn((_root: string, onChange: (change: Change) => void) => {
    sinks.push(onChange)
    return stop
  })
  window.hive = { ...window.hive, watchWorkspace: watch } as unknown as typeof window.hive
  return { watch, stop, emit: (change) => sinks.forEach((sink) => sink(change)) }
}

const CHANGE: Change = { type: 'add', path: 'second-brain/wiki/index.md' }

describe('watchWorkspaceShared', () => {
  afterEach(() => vi.restoreAllMocks())

  it('opens ONE bridge subscription per root and fans every change out to all listeners', () => {
    const bridge = mockBridge()
    const explorer = vi.fn()
    const brain = vi.fn()

    const offExplorer = watchWorkspaceShared('/ws', explorer)
    const offBrain = watchWorkspaceShared('/ws', brain)

    expect(bridge.watch).toHaveBeenCalledTimes(1)
    bridge.emit(CHANGE)
    expect(explorer).toHaveBeenCalledWith(CHANGE)
    expect(brain).toHaveBeenCalledWith(CHANGE)

    offExplorer()
    offBrain()
  })

  it('one listener leaving does NOT stop the others — the bug where switching sidebar views killed the vault watcher', () => {
    const bridge = mockBridge()
    const explorer = vi.fn()
    const brain = vi.fn()
    const offExplorer = watchWorkspaceShared('/ws2', explorer)
    const offBrain = watchWorkspaceShared('/ws2', brain)

    // The Explorer unmounts when the user opens the Second Brain view.
    offExplorer()

    expect(bridge.stop).not.toHaveBeenCalled()
    bridge.emit(CHANGE)
    expect(explorer).not.toHaveBeenCalled()
    expect(brain).toHaveBeenCalledWith(CHANGE)

    offBrain()
  })

  it('tears the bridge subscription down once the last listener leaves, and reopens on the next one', () => {
    const bridge = mockBridge()
    const off = watchWorkspaceShared('/ws3', vi.fn())

    off()
    expect(bridge.stop).toHaveBeenCalledTimes(1)

    watchWorkspaceShared('/ws3', vi.fn())()
    expect(bridge.watch).toHaveBeenCalledTimes(2)
  })

  it('keeps roots independent (a workspace switch watches the new tree, not both)', () => {
    const bridge = mockBridge()
    const offA = watchWorkspaceShared('/a', vi.fn())
    const offB = watchWorkspaceShared('/b', vi.fn())

    expect(bridge.watch).toHaveBeenCalledTimes(2)
    expect(bridge.watch.mock.calls.map((call) => call[0])).toEqual(['/a', '/b'])

    offA()
    offB()
  })

  it('survives a listener that unsubscribes while handling an event', () => {
    const bridge = mockBridge()
    const survivor = vi.fn()
    let offSelf = (): void => {}
    offSelf = watchWorkspaceShared('/ws4', () => offSelf())
    const offSurvivor = watchWorkspaceShared('/ws4', survivor)

    expect(() => bridge.emit(CHANGE)).not.toThrow()
    expect(survivor).toHaveBeenCalledWith(CHANGE)

    offSurvivor()
  })
})
