// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AudioRecorder } from './AudioRecorder'
import { formatElapsed } from './recorderFormat'

interface Harness {
  tracks: Array<{ stop: ReturnType<typeof vi.fn> }>
  getUserMedia: ReturnType<typeof vi.fn>
  instances: FakeRecorder[]
}

class FakeRecorder {
  static last: FakeRecorder | null = null
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  mimeType = 'audio/webm'
  start = vi.fn()
  stop = vi.fn(() => {
    this.ondataavailable?.({ data: new Blob(['audio-bytes']) })
    this.onstop?.()
  })
  constructor(public stream: unknown) {
    FakeRecorder.last = this
  }
}

function setupMedia(options: { rejectWith?: { name: string } } = {}): Harness {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }]
  const instances: FakeRecorder[] = []
  const getUserMedia = vi.fn(async () => {
    if (options.rejectWith) throw Object.assign(new Error('denied'), options.rejectWith)
    return { getTracks: () => tracks } as unknown as MediaStream
  })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  vi.stubGlobal(
    'MediaRecorder',
    vi.fn((stream: unknown) => {
      const recorder = new FakeRecorder(stream)
      instances.push(recorder)
      return recorder
    })
  )
  return { tracks, getUserMedia, instances }
}

async function startRecording(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByText('Gravar'))
  })
}

describe('AudioRecorder (T16)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('records on demand and shows a live elapsed timer (SB-R5.1)', async () => {
    setupMedia()
    render(createElement(AudioRecorder, { onRecorded: vi.fn(), busy: false }))

    await startRecording()

    expect(screen.getByText('Parar')).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toContain('00:00')

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByRole('timer').textContent).toContain('00:03')
  })

  it('hands the finished take to the caller as a Blob (SB-R5.2)', async () => {
    setupMedia()
    const onRecorded = vi.fn()
    render(createElement(AudioRecorder, { onRecorded, busy: false }))

    await startRecording()
    await act(async () => {
      fireEvent.click(screen.getByText('Parar'))
    })

    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1))
    expect(onRecorded.mock.calls[0][0]).toBeInstanceOf(Blob)
  })

  it('stops EVERY media track when the take ends (no leaked mic, SB-R5.4)', async () => {
    const { tracks } = setupMedia()
    render(createElement(AudioRecorder, { onRecorded: vi.fn(), busy: false }))

    await startRecording()
    expect(tracks.every((t) => t.stop.mock.calls.length === 0)).toBe(true)

    await act(async () => {
      fireEvent.click(screen.getByText('Parar'))
    })
    for (const track of tracks) expect(track.stop).toHaveBeenCalled()
  })

  it('re-recording discards the previous take and opens a fresh stream (SB-R5.4)', async () => {
    const { tracks, getUserMedia } = setupMedia()
    render(createElement(AudioRecorder, { onRecorded: vi.fn(), busy: false }))

    await startRecording()
    await act(async () => {
      fireEvent.click(screen.getByText('Parar'))
    })
    tracks.forEach((t) => t.stop.mockClear())

    // Second take: the prior stream is released before a new one is requested.
    await startRecording()
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    await act(async () => {
      fireEvent.click(screen.getByText('Parar'))
    })
    for (const track of tracks) expect(track.stop).toHaveBeenCalled()
  })

  it('releases the microphone and the timer on unmount mid-take', async () => {
    const { tracks } = setupMedia()
    const { unmount } = render(createElement(AudioRecorder, { onRecorded: vi.fn(), busy: false }))

    await startRecording()
    unmount()

    for (const track of tracks) expect(track.stop).toHaveBeenCalled()
    // The interval is gone: advancing time cannot tick a torn-down component.
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow()
  })

  it('explains a denied microphone and offers a retry (SB-R5.3)', async () => {
    setupMedia({ rejectWith: { name: 'NotAllowedError' } })
    render(createElement(AudioRecorder, { onRecorded: vi.fn(), busy: false }))

    await startRecording()

    expect(screen.getByRole('alert').textContent).toContain('microfone está bloqueado')
    expect(screen.getByText('Tentar de novo')).toBeTruthy()
  })

  it('distinguishes "no microphone on this machine" from a denial', async () => {
    setupMedia({ rejectWith: { name: 'NotFoundError' } })
    render(createElement(AudioRecorder, { onRecorded: vi.fn(), busy: false }))

    await startRecording()
    expect(screen.getByRole('alert').textContent).toBe(
      'Nenhum microfone foi encontrado neste computador.'
    )
  })

  it('retry after a denial asks for the microphone again', async () => {
    const { getUserMedia } = setupMedia({ rejectWith: { name: 'NotAllowedError' } })
    render(createElement(AudioRecorder, { onRecorded: vi.fn(), busy: false }))

    await startRecording()
    await act(async () => {
      fireEvent.click(screen.getByText('Tentar de novo'))
    })
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('cannot start while the engine is busy, but CAN stop an in-flight take', async () => {
    setupMedia()
    const { rerender } = render(createElement(AudioRecorder, { onRecorded: vi.fn(), busy: true }))
    expect((screen.getByText('Gravar') as HTMLButtonElement).disabled).toBe(true)

    rerender(createElement(AudioRecorder, { onRecorded: vi.fn(), busy: false }))
    await startRecording()
    rerender(createElement(AudioRecorder, { onRecorded: vi.fn(), busy: true }))
    expect((screen.getByText('Parar') as HTMLButtonElement).disabled).toBe(false)
  })

  it('ignores empty data chunks when assembling the take', async () => {
    setupMedia()
    const onRecorded = vi.fn()
    render(createElement(AudioRecorder, { onRecorded, busy: false }))
    await startRecording()

    const recorder = FakeRecorder.last!
    recorder.ondataavailable?.({ data: new Blob([]) })
    await act(async () => {
      fireEvent.click(screen.getByText('Parar'))
    })
    expect(onRecorded).toHaveBeenCalledTimes(1)
  })

  describe('formatElapsed', () => {
    it('renders mm:ss, padding both parts and rolling over at 60s', () => {
      expect(formatElapsed(0)).toBe('00:00')
      expect(formatElapsed(7)).toBe('00:07')
      expect(formatElapsed(59)).toBe('00:59')
      expect(formatElapsed(60)).toBe('01:00')
      expect(formatElapsed(605)).toBe('10:05')
      expect(formatElapsed(3600)).toBe('60:00')
    })
  })
})
