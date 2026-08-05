import { useEffect, useRef, useState } from 'react'
import { isSilent, levelToBar, pushLevel, rms, WAVE_BARS } from './waveform'

interface WaveformProps {
  /** The live take's stream, or `null` when nothing is being recorded. */
  stream: MediaStream | null
  /** Announced when the meter has heard nothing for a while. */
  silentLabel: string
}

/**
 * The recorder's live level meter — the answer to "is this thing hearing me?".
 *
 * A timer alone cannot answer that: it advances identically whether the
 * microphone is picking up a voice or is muted at the OS level, which is
 * precisely the failure people hit. So the take is drawn: a scrolling bar
 * meter fed from an `AnalyserNode`, plus an explicit warning once the input
 * has been silent long enough that it is probably not going to recover.
 *
 * The canvas is decorative in the accessibility sense — the meaning is carried
 * by the `role="status"` line beside it, since a waveform is not something a
 * screen reader can convey.
 */
export function Waveform({ stream, silentLabel }: WaveformProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [silent, setSilent] = useState(false)

  useEffect(() => {
    if (!stream) return
    // Both audio analysis and a 2D context are optional capabilities, not
    // requirements — recording itself works without the meter, so neither may
    // take the take down. The AudioContext check comes first because without
    // one there is nothing to draw, and asking a headless DOM for a canvas
    // context it does not implement is a diagnostic nobody needs to read.
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return
    const canvas = canvasRef.current
    let context: CanvasRenderingContext2D | null = null
    try {
      context = canvas?.getContext('2d') ?? null
    } catch {
      context = null
    }

    let audio: AudioContext
    let analyser: AnalyserNode
    try {
      audio = new AudioContextCtor()
      analyser = audio.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.6
      audio.createMediaStreamSource(stream).connect(analyser)
    } catch {
      return
    }

    const samples = new Float32Array(analyser.fftSize)
    let history: number[] = []
    let frame = 0
    let quiet = false

    const draw = (): void => {
      frame = requestAnimationFrame(draw)
      analyser.getFloatTimeDomainData(samples)
      history = pushLevel(history, rms(samples))

      const nextQuiet = isSilent(history)
      if (nextQuiet !== quiet) {
        quiet = nextQuiet
        setSilent(nextQuiet)
      }
      if (!context || !canvas) return

      // Re-read the box each frame: the sheet is resizable, and a canvas whose
      // backing store drifts from its CSS size renders blurry.
      const ratio = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio)
      if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio)

      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)

      const gap = 2
      const barWidth = Math.max(1, width / WAVE_BARS - gap)
      const accent = getComputedStyle(canvas).getPropertyValue('--wave-color').trim() || '#888'
      context.fillStyle = accent

      // Newest bar hugs the right edge, so the take scrolls the way a
      // recording app's does — time moving left, "now" under the cursor.
      for (let i = 0; i < history.length; i++) {
        const fraction = levelToBar(history[i])
        const barHeight = Math.max(2, fraction * height)
        const x = width - (history.length - i) * (barWidth + gap)
        if (x + barWidth < 0) continue
        const y = (height - barHeight) / 2
        context.beginPath()
        context.roundRect(x, y, barWidth, barHeight, barWidth / 2)
        context.fill()
      }
    }
    draw()

    return () => {
      cancelAnimationFrame(frame)
      void audio.close()
    }
  }, [stream])

  return (
    <div className="wb-brain-wave" data-silent={silent || undefined}>
      <canvas ref={canvasRef} className="wb-brain-wave-canvas" aria-hidden="true" />
      {silent && (
        <p className="wb-brain-wave-silent" role="status">
          {silentLabel}
        </p>
      )}
    </div>
  )
}
