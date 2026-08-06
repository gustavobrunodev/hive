import { describe, expect, it } from 'vitest'
import {
  dictationHarness,
  e2eDictationEngine,
  e2eStartCapture,
  type DictationE2EHarness
} from './e2eDictationSeam'
import type { Tick } from './segmenter'

/**
 * The seam's whole contract is "off unless armed" — a stand-in that leaked into
 * a real run would replace the user's microphone with silence, so the null path
 * is the case that matters most.
 */

const tick: Tick = { rms: 0.4, samples: new Float32Array(4).fill(0.4) }

describe('the dictation E2E seam', () => {
  it('is off when nothing armed it', () => {
    expect(dictationHarness({})).toBeNull()
    expect(e2eStartCapture({})).toBeNull()
    expect(e2eDictationEngine({})).toBeNull()
  })

  it('is off when the scope itself is missing', () => {
    expect(dictationHarness(undefined)).toBeNull()
  })

  it('hands the test a capture it can drive', async () => {
    const scope: { __hiveDictationE2E: DictationE2EHarness } = { __hiveDictationE2E: {} }
    const start = e2eStartCapture(scope)
    expect(start).not.toBeNull()

    const capture = await start!()
    const seen: Tick[] = []
    capture.onTick((value) => seen.push(value))
    // The harness's own array is the wire: the spec pushes through it.
    for (const listener of scope.__hiveDictationE2E.ticks ?? []) listener(tick)
    expect(seen).toEqual([tick])
    // No levels: the meter has no signal to show when there is no device.
    expect(() => capture.onLevels(() => undefined)).not.toThrow()
  })

  it('counts stops, so the E2E can still assert the release path ran', async () => {
    const scope: { __hiveDictationE2E: DictationE2EHarness } = { __hiveDictationE2E: {} }
    const capture = await e2eStartCapture(scope)!()
    capture.stop()
    capture.stop()
    expect(scope.__hiveDictationE2E.stops).toBe(2)
    // And a stopped stand-in stops delivering, like the real one.
    expect(scope.__hiveDictationE2E.ticks).toEqual([])
  })

  it('transcribes to the harness transcript, and to nothing when none is set', async () => {
    const withText = e2eDictationEngine({ __hiveDictationE2E: { transcript: 'arquivo' } })
    expect(await withText!.transcribe(new Float32Array(1))).toBe('arquivo')
    expect(withText!.phase).toEqual({ status: 'idle' })

    const without = e2eDictationEngine({ __hiveDictationE2E: {} })
    expect(await without!.transcribe(new Float32Array(1))).toBe('')
  })
})
