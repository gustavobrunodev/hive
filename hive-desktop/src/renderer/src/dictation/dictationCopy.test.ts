import { describe, expect, it } from 'vitest'
import { strings } from '../i18n'
import { autoStopCountdown, dictationView, AUTOSTOP_WARNING_MS } from './dictationCopy'
import type { DictationPhase } from './phase'

const THRESHOLDS = { silenceNoticeMs: 3000, autoStopMs: 8000 }

function listening(
  overrides: Partial<Extract<DictationPhase, { status: 'listening' }>> = {}
): Extract<DictationPhase, { status: 'listening' }> {
  return { status: 'listening', seconds: 7, silentMs: 0, pending: 0, ...overrides }
}

describe('dictationView', () => {
  it('says nothing when idle — the toolbar is on screen, not the transport', () => {
    expect(dictationView({ status: 'idle' })).toBeNull()
  })

  it('reports listening, with a live meter and no queue noise', () => {
    const view = dictationView(listening(), THRESHOLDS)
    expect(view).toMatchObject({ kind: 'listening', pending: 0, retry: false, meter: true })
    expect(view?.status).toBe(strings.dictation.listening)
    expect(view?.hint).toBeUndefined()
  })

  // D-VP-8: a count, never a provisional word.
  it('counts the queue instead of guessing at its contents', () => {
    const one = dictationView(listening({ pending: 1 }), THRESHOLDS)
    expect(one?.status).toContain('1 trecho na fila')
    const many = dictationView(listening({ pending: 3 }), THRESHOLDS)
    expect(many?.status).toContain('3 trechos na fila')
    expect(many?.pending).toBe(3)
  })

  it('promises out loud that the audio is kept while the engine prepares (VP-R3.2)', () => {
    const view = dictationView(
      {
        status: 'preparing',
        seconds: 3,
        silentMs: 0,
        pending: 2,
        engine: { status: 'downloading', pct: 41, file: 'encoder.onnx' }
      },
      THRESHOLDS
    )
    expect(view?.kind).toBe('preparing')
    // Real progress, reusing M12's engine phase reporting.
    expect(view?.status).toContain('41%')
    expect(view?.status).toContain('2 trechos na fila')
    expect(view?.hint).toBe(strings.dictation.preparingKeep)
    expect(view?.meter).toBe(true)
  })

  it('omits a percentage the engine genuinely does not have', () => {
    const warming = dictationView(
      { status: 'preparing', seconds: 3, silentMs: 0, pending: 0, engine: { status: 'warming' } },
      THRESHOLDS
    )
    expect(warming?.status).toBe(strings.dictation.preparing)

    const idleEngine = dictationView(
      { status: 'preparing', seconds: 1, silentMs: 0, pending: 0, engine: { status: 'idle' } },
      THRESHOLDS
    )
    expect(idleEngine?.status).toBe(strings.dictation.preparing)
  })

  // VP-R4.1 — the defect AudioRecorder's own doc comment records: a timer counts
  // up identically whether the mic is capturing a voice or muted.
  it('says it is hearing nothing once silence passes the notice window', () => {
    expect(dictationView(listening({ silentMs: 2999 }), THRESHOLDS)?.kind).toBe('listening')
    const silent = dictationView(listening({ silentMs: 3000 }), THRESHOLDS)
    expect(silent).toMatchObject({ kind: 'silent', meter: false, retry: false })
    expect(silent?.status).toBe(strings.dictation.silent)
    expect(silent?.hint).toBeTruthy()
  })

  it('counts down before stopping on its own, and never below zero (VP-R4.2)', () => {
    const boundary = dictationView(
      listening({ silentMs: THRESHOLDS.autoStopMs - AUTOSTOP_WARNING_MS }),
      THRESHOLDS
    )
    expect(boundary?.kind).toBe('autostop')
    expect(boundary?.status).toContain('3')

    expect(dictationView(listening({ silentMs: 7100 }), THRESHOLDS)?.status).toContain('1')
    expect(dictationView(listening({ silentMs: 9000 }), THRESHOLDS)?.status).toContain('0')
  })

  it('keeps warning about the silence even while the engine is still preparing', () => {
    const view = dictationView(
      {
        status: 'preparing',
        seconds: 5,
        silentMs: 4000,
        pending: 1,
        engine: { status: 'loading', pct: 10 }
      },
      THRESHOLDS
    )
    // Silence outranks the preparation caption — the user has to know the
    // microphone is hearing nothing before the take is over.
    expect(view?.kind).toBe('silent')
    expect(view?.pending).toBe(1)
  })

  it('reports finalizing, naming how much is still queued (VP-R1.4)', () => {
    const draining = dictationView({ status: 'finalizing', pending: 2 })
    expect(draining).toMatchObject({ kind: 'finalizing', pending: 2, meter: false })
    expect(draining?.status).toContain('2 trechos')

    const one = dictationView({ status: 'finalizing', pending: 1 })
    expect(one?.status).toContain('1 trecho')

    const empty = dictationView({ status: 'finalizing', pending: 0 })
    expect(empty?.status).toBe(strings.dictation.finalizing)
  })

  it('distinguishes permission denied from no device at all (VP-R4.3)', () => {
    const denied = dictationView({ status: 'error', kind: 'denied' })
    const unavailable = dictationView({ status: 'error', kind: 'unavailable' })
    expect(denied).toMatchObject({ kind: 'denied', retry: true, meter: false })
    expect(unavailable).toMatchObject({ kind: 'unavailable', retry: true })
    expect(denied?.status).not.toBe(unavailable?.status)
    expect(denied?.hint).not.toBe(unavailable?.hint)
  })

  it('shows an engine failure with the promise that the take survives (VP-R4.4)', () => {
    const view = dictationView({ status: 'error', kind: 'engine', message: 'session build failed' })
    expect(view).toMatchObject({ kind: 'error', retry: true })
    expect(view?.status).toBe('session build failed')
    expect(view?.hint).toBe(strings.dictation.errorKeep)
  })

  it('falls back to its own wording when the engine failure has no message', () => {
    expect(dictationView({ status: 'error', kind: 'engine' })?.status).toBe(strings.dictation.error)
  })

  it('uses the segmenter defaults when no thresholds are injected', () => {
    // 3 s of silence is the notice window in DEFAULT_SEGMENTER_CONFIG.
    expect(dictationView(listening({ silentMs: 3200 }))?.kind).toBe('silent')
    expect(dictationView(listening({ silentMs: 0 }))?.kind).toBe('listening')
  })

  it('gives every non-idle phase a status line', () => {
    const phases: DictationPhase[] = [
      listening(),
      listening({ silentMs: 3500 }),
      listening({ silentMs: 7500 }),
      { status: 'preparing', seconds: 1, silentMs: 0, pending: 0, engine: { status: 'idle' } },
      { status: 'finalizing', pending: 0 },
      { status: 'error', kind: 'denied' },
      { status: 'error', kind: 'unavailable' },
      { status: 'error', kind: 'engine' }
    ]
    for (const phase of phases) {
      expect(dictationView(phase, THRESHOLDS)?.status).toBeTruthy()
    }
  })
})

describe('autoStopCountdown', () => {
  it('rounds up so the last visible number is 1, not 0', () => {
    expect(autoStopCountdown(5000, 8000)).toBe(3)
    expect(autoStopCountdown(7001, 8000)).toBe(1)
    expect(autoStopCountdown(8000, 8000)).toBe(0)
    expect(autoStopCountdown(99_000, 8000)).toBe(0)
  })
})

describe('the pt-BR dictation strings', () => {
  it('has every key the transport and its controls render', () => {
    const required = [
      'start',
      'startHint',
      'listening',
      'preparing',
      'preparingKeep',
      'transcribing',
      'finalizing',
      'queue',
      'silent',
      'silentHint',
      'autoStop',
      'autoStopHint',
      'finish',
      'discard',
      'retry',
      'elapsed',
      'meterLabel',
      'denied',
      'deniedHint',
      'unavailable',
      'unavailableHint',
      'error',
      'errorKeep',
      'finishAndSend'
    ] as const
    for (const key of required) {
      expect(strings.dictation[key], key).toBeTruthy()
    }
  })

  it('agrees in number for the counted strings', () => {
    expect(strings.dictation.queue(1)).toBe('1 trecho na fila')
    expect(strings.dictation.queue(2)).toBe('2 trechos na fila')
    expect(strings.dictation.transcribing(1)).toContain('1 trecho…')
    expect(strings.dictation.transcribing(4)).toContain('4 trechos…')
  })

  it('formats the countdown and the elapsed timer with their argument', () => {
    expect(strings.dictation.autoStop(3)).toContain('3')
    expect(strings.dictation.elapsed('0:07')).toContain('0:07')
  })
})

/**
 * The engine's own words never reach the user. A real take ended with
 * **"Array buffer allocation failed"** on screen — a sentence that names the
 * mechanism, hides the cause (the chosen model does not fit in this
 * renderer's memory) and offers no next step.
 */
describe("engine failures, in the user's language", () => {
  it('turns the allocation failure into the model choice it is really about', () => {
    const view = dictationView({
      status: 'error',
      kind: 'engine',
      message: 'Array buffer allocation failed'
    })
    expect(view?.status).toContain('não cabe na memória')
    expect(view?.status).not.toContain('Array buffer')
    // The promise that makes the retry worth offering survives.
    expect(view?.hint).toBeTruthy()
    expect(view?.retry).toBe(true)
  })

  it('leaves a failure it has no better words for exactly as it came', () => {
    const view = dictationView({
      status: 'error',
      kind: 'engine',
      message: 'Missing required scale for node'
    })
    expect(view?.status).toBe('Missing required scale for node')
  })
})
