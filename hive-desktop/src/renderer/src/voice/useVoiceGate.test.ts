// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useVoiceGate } from './useVoiceGate'
import { whisperDownloadFixture } from '../testSupport/hiveWhisperMock'

const HARDWARE = { recommendedId: 'small', reason: 'discreteGpu', gpu: true, ramGB: 32, cores: 12 }
const NOTHING = { id: null, auto: true, installed: [], recommendation: HARDWARE }
const INSTALLED = { id: 'small', auto: true, installed: ['small'], recommendation: HARDWARE }

describe('useVoiceGate', () => {
  let settledListeners: Array<(download: unknown) => void>
  let preference: ReturnType<typeof vi.fn>

  beforeEach(() => {
    settledListeners = []
    preference = vi.fn(async () => NOTHING)
    window.hive = {
      ...window.hive,
      whisper: {
        ...window.hive?.whisper,
        preference,
        setPreferredModel: vi.fn(async () => NOTHING),
        onDownloadSettled: vi.fn((listener: (download: unknown) => void) => {
          settledListeners.push(listener)
          return () => {}
        })
      }
    } as typeof window.hive
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('runs the action straight away when a model is already installed', async () => {
    preference.mockResolvedValue(INSTALLED)
    const { result } = renderHook(() => useVoiceGate())
    await waitFor(() => expect(result.current.blocked).toBe(false))

    const action = vi.fn()
    act(() => result.current.guard(action))

    expect(action).toHaveBeenCalled()
    expect(result.current.open).toBe(false)
  })

  it('opens the gate instead, when there is no model', async () => {
    const { result } = renderHook(() => useVoiceGate())
    await waitFor(() => expect(result.current.blocked).toBe(true))

    const action = vi.fn()
    act(() => result.current.guard(action))

    expect(action).not.toHaveBeenCalled()
    expect(result.current.open).toBe(true)
  })

  /**
   * The interesting half: a user who presses the microphone is asking to
   * speak, and after a download that request should still be honoured rather
   * than making them press it again.
   */
  it('runs the remembered take the moment a model lands', async () => {
    const { result } = renderHook(() => useVoiceGate())
    await waitFor(() => expect(result.current.blocked).toBe(true))
    const action = vi.fn()
    act(() => result.current.guard(action))

    preference.mockResolvedValue(INSTALLED)
    await act(async () => {
      settledListeners[0](whisperDownloadFixture({ status: 'done' }))
    })

    await waitFor(() => expect(action).toHaveBeenCalled())
    expect(result.current.open).toBe(false)
  })

  it('re-resolves the preference on any ending, wherever the download started', async () => {
    renderHook(() => useVoiceGate())
    await waitFor(() => expect(preference).toHaveBeenCalledTimes(1))

    await act(async () => {
      settledListeners[0](whisperDownloadFixture({ status: 'done' }))
    })
    expect(preference.mock.calls.length).toBeGreaterThan(1)
  })

  it('ignores an ending that is not a completion', async () => {
    renderHook(() => useVoiceGate())
    await waitFor(() => expect(preference).toHaveBeenCalledTimes(1))

    await act(async () => {
      settledListeners[0](whisperDownloadFixture({ status: 'error' }))
    })
    expect(preference).toHaveBeenCalledTimes(1)
  })

  /**
   * A microphone that opens by itself several minutes later, with no dialog on
   * screen to explain why, is worse than one more click — so closing the gate
   * forgets what it was remembering. The completion notice covers that case
   * instead, and it offers the *model* rather than the recording.
   */
  it('forgets the take when the gate is closed by hand', async () => {
    const { result } = renderHook(() => useVoiceGate())
    await waitFor(() => expect(result.current.blocked).toBe(true))
    const action = vi.fn()
    act(() => result.current.guard(action))
    act(() => result.current.setOpen(false))

    preference.mockResolvedValue(INSTALLED)
    await act(async () => {
      settledListeners[0](whisperDownloadFixture({ status: 'done' }))
    })

    await waitFor(() => expect(result.current.blocked).toBe(false))
    expect(action).not.toHaveBeenCalled()
  })

  it('asks main nothing at all while inactive', async () => {
    renderHook(() => useVoiceGate(false))
    await act(async () => {})
    expect(preference).not.toHaveBeenCalled()
  })
})
