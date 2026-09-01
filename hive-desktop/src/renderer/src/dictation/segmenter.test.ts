import { describe, expect, it } from 'vitest'
import {
  createSegmenter,
  DEFAULT_SEGMENTER_CONFIG,
  type SegmenterConfig,
  type SegmenterEvent,
  type Tick
} from './segmenter'

/**
 * The segmenter's whole contract is asserted from synthetic level arrays — no
 * WebAudio, no DOM, no microphone (VP-R5.5). A tick is 32 ms at 16 kHz, which
 * is the real cadence the T1 spike measured out of the audio worklet.
 */

const RATE = 16_000
const TICK_SAMPLES = 512 // 32 ms at 16 kHz
const TICK_MS = 32

/** A tick whose PCM is a constant, so a segment's provenance is checkable. */
function tick(rms: number, fill = rms): Tick {
  return { rms, samples: new Float32Array(TICK_SAMPLES).fill(fill) }
}

const QUIET = 0.002
const LOUD = 0.4

function config(overrides: Partial<SegmenterConfig> = {}): SegmenterConfig {
  return { ...DEFAULT_SEGMENTER_CONFIG, sampleRate: RATE, ...overrides }
}

/** Pushes `count` ticks of one level and returns every event they produced. */
function pushAll(
  segmenter: { push(tick: Tick): SegmenterEvent[] },
  count: number,
  rms: number,
  fill?: number
): SegmenterEvent[] {
  const events: SegmenterEvent[] = []
  for (let i = 0; i < count; i += 1) events.push(...segmenter.push(tick(rms, fill)))
  return events
}

const ticksFor = (ms: number): number => Math.ceil(ms / TICK_MS)

/**
 * A segmenter that has already heard the room, which is what every real take
 * starts with: the microphone opens a few ticks before anyone speaks. Without
 * it the floor seeds itself from the first word (see the dedicated test for
 * that case) and a *synthetic* constant-amplitude tone never dips low enough to
 * correct it — an artifact of test tones, not of speech.
 */
function segmenterInARoom(
  overrides: Partial<SegmenterConfig> = {}
): ReturnType<typeof createSegmenter> {
  const segmenter = createSegmenter(config(overrides))
  pushAll(segmenter, 3, QUIET)
  return segmenter
}

function segmentsIn(events: SegmenterEvent[]): Extract<SegmenterEvent, { type: 'segment' }>[] {
  return events.filter((event): event is Extract<SegmenterEvent, { type: 'segment' }> =>
    Boolean(event.type === 'segment')
  )
}

describe('createSegmenter', () => {
  it('emits `speech` on onset and nothing while the room is quiet', () => {
    const segmenter = createSegmenter(config())

    const quiet = pushAll(segmenter, 10, QUIET)
    expect(quiet).toEqual([])

    const onset = segmenter.push(tick(LOUD))
    expect(onset).toEqual([{ type: 'speech' }])

    // Onset is announced once, not on every speech tick after it.
    expect(pushAll(segmenter, 5, LOUD)).toEqual([])
  })

  // The bootstrap defect this floor model exists to avoid: a room with any real
  // noise reads as speech from the very first tick, so a floor learned only
  // from ticks *already classified as silence* can never be learned at all.
  it('seeds the floor from the first tick, so a noisy room does not read as speech', () => {
    const segmenter = createSegmenter(config())
    // A fan at 0.05 is far above any fixed threshold worth using.
    pushAll(segmenter, 40, 0.05)
    expect(segmenter.noiseFloor()).toBeCloseTo(0.05, 4)
    // Still silence: it is the floor, not a voice.
    expect(pushAll(segmenter, 5, 0.05)).toEqual([])
    // A voice over that fan is heard.
    expect(segmenter.push(tick(0.2))).toEqual([{ type: 'speech' }])
  })

  it('adapts the floor downward the instant the room quiets down', () => {
    const segmenter = createSegmenter(config())
    pushAll(segmenter, 40, 0.05)
    expect(segmenter.noiseFloor()).toBeCloseTo(0.05, 4)

    // The fan stops. One quiet tick is enough — the gate must not stay stuck at
    // the old, higher threshold.
    segmenter.push(tick(QUIET))
    expect(segmenter.noiseFloor()).toBeCloseTo(QUIET, 5)
    // …and a quiet voice that the 0.05 floor would have swallowed is now heard.
    expect(segmenter.push(tick(0.03))).toEqual([{ type: 'speech' }])
  })

  it('lets the floor rise only glacially, so a phrase cannot drag the gate up behind its own voice', () => {
    const segmenter = createSegmenter(config())
    segmenter.push(tick(QUIET))
    // A full maxSegmentMs of loud, unbroken speech.
    pushAll(segmenter, ticksFor(15_000), LOUD)
    // The floor crept up, but nowhere near the voice that has been sounding for
    // 15 s — otherwise the tail of a long phrase would read as silence.
    expect(segmenter.noiseFloor()).toBeGreaterThan(QUIET)
    expect(segmenter.noiseFloor() + DEFAULT_SEGMENTER_CONFIG.rmsMargin).toBeLessThan(LOUD)
  })

  it('a voice that starts on the very first tick is heard as soon as it dips', () => {
    const segmenter = createSegmenter(config())
    // Tick one seeds the floor from speech, so it alone reads as silence…
    expect(segmenter.push(tick(LOUD))).toEqual([])
    // …but real speech dips between words, which drops the floor to the room's
    // true level; the phrase is then detected, and the pre-roll covers the dip.
    segmenter.push(tick(QUIET))
    expect(segmenter.push(tick(LOUD))).toEqual([{ type: 'speech' }])
  })

  it('does NOT cut on a breath-length pause mid-sentence (VP-R2.6)', () => {
    const segmenter = segmenterInARoom()
    pushAll(segmenter, ticksFor(1000), LOUD) // 1 s of speech — under minSpeechMs
    // A 900 ms pause: longer than silenceHoldMs (700), but the segment has not
    // earned a boundary yet, so it stays open.
    const events = pushAll(segmenter, ticksFor(900), QUIET)
    expect(segmentsIn(events)).toEqual([])

    // Speaking on continues the same segment — no new `speech` event.
    expect(pushAll(segmenter, ticksFor(1500), LOUD)).toEqual([])
    // Now it has enough speech, so the next real pause does cut.
    expect(segmentsIn(pushAll(segmenter, ticksFor(800), QUIET))).toHaveLength(1)
  })

  it('cuts on a real pause once there is enough speech, without stopping capture', () => {
    const segmenter = segmenterInARoom()
    pushAll(segmenter, ticksFor(2500), LOUD)
    const cut = segmentsIn(pushAll(segmenter, ticksFor(750), QUIET))
    expect(cut).toHaveLength(1)
    expect(cut[0].index).toBe(0)

    // Capture continues: the next phrase is segment 1, in spoken order.
    pushAll(segmenter, ticksFor(2500), LOUD)
    const second = segmentsIn(pushAll(segmenter, ticksFor(750), QUIET))
    expect(second[0].index).toBe(1)
  })

  it('forces a cut at maxSegmentMs so no segment grows without bound (VP-R2.7)', () => {
    const segmenter = segmenterInARoom({ maxSegmentMs: 1000 })
    const events = pushAll(segmenter, ticksFor(1500), LOUD)
    const cuts = segmentsIn(events)
    expect(cuts).toHaveLength(1)
    expect(cuts[0].ms).toBeGreaterThanOrEqual(1000)
    // Unbroken speech after a forced cut opens a fresh segment.
    expect(events.filter((event) => event.type === 'speech')).toHaveLength(2)
  })

  it('includes pre-roll before onset and a tail pad after the cut (VP-R2.8)', () => {
    const segmenter = createSegmenter(config({ preRollMs: 96, tailPadMs: 64 }))
    // Silence marked with a distinct sample value, so its presence is provable.
    pushAll(segmenter, 20, QUIET, -1)
    pushAll(segmenter, ticksFor(2500), LOUD, 1)
    const [cut] = segmentsIn(pushAll(segmenter, ticksFor(750), QUIET, -1))

    // Leading pre-roll: exactly the retained silence, not the whole 20 ticks.
    expect(cut.pcm[0]).toBe(-1)
    const leading = [...cut.pcm].findIndex((sample) => sample === 1)
    expect(leading).toBe(96 * (RATE / 1000))
    // Trailing tail pad: silence after the last speech sample, capped.
    const trailing = cut.pcm.length - ([...cut.pcm].lastIndexOf(1) + 1)
    expect(trailing).toBe(64 * (RATE / 1000))
  })

  it('keeps the pre-roll bounded, holding the most recent audio only', () => {
    const segmenter = createSegmenter(config({ preRollMs: 96 }))
    pushAll(segmenter, 50, QUIET, -1)
    pushAll(segmenter, ticksFor(2500), LOUD, 1)
    const [cut] = segmentsIn(pushAll(segmenter, ticksFor(750), QUIET, -1))
    const speechSamples = ticksFor(2500) * TICK_SAMPLES
    const padSamples = Math.round(DEFAULT_SEGMENTER_CONFIG.tailPadMs * (RATE / 1000))
    expect(cut.pcm.length).toBe(96 * (RATE / 1000) + speechSamples + padSamples)
  })

  it('retains no pre-roll at all when it is configured away', () => {
    const segmenter = createSegmenter(config({ preRollMs: 0 }))
    pushAll(segmenter, 20, QUIET, -1)
    pushAll(segmenter, ticksFor(2500), LOUD, 1)
    const [cut] = segmentsIn(pushAll(segmenter, ticksFor(750), QUIET, -1))
    expect(cut.pcm[0]).toBe(1)
  })

  it('announces the silence notice once, then the autostop (VP-R4.1–4.2)', () => {
    const segmenter = createSegmenter(config())
    const events = pushAll(segmenter, ticksFor(9000), QUIET)

    const notices = events.filter((event) => event.type === 'notice')
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({ type: 'notice' })
    expect((notices[0] as { silentMs: number }).silentMs).toBeGreaterThanOrEqual(3000)
    expect(events.filter((event) => event.type === 'autostop')).toHaveLength(1)
  })

  it('re-arms the notice after speech resumes', () => {
    const segmenter = segmenterInARoom()
    expect(
      pushAll(segmenter, ticksFor(3100), QUIET).filter((e) => e.type === 'notice')
    ).toHaveLength(1)
    pushAll(segmenter, ticksFor(2500), LOUD)
    // A second silence stretch notices again — the state is per-stretch.
    const again = pushAll(segmenter, ticksFor(3100), QUIET)
    expect(again.filter((event) => event.type === 'notice')).toHaveLength(1)
    expect(again.filter((event) => event.type === 'autostop')).toHaveLength(0)
  })

  it('notices and autostops even while a below-threshold segment is still open', () => {
    const segmenter = segmenterInARoom()
    pushAll(segmenter, ticksFor(500), LOUD) // too little speech to ever cut
    const events = pushAll(segmenter, ticksFor(9000), QUIET)
    expect(events.filter((event) => event.type === 'notice')).toHaveLength(1)
    expect(events.filter((event) => event.type === 'autostop')).toHaveLength(1)
    // And the take is not lost: flush still yields the short phrase.
    expect(segmentsIn(segmenter.flush())).toHaveLength(1)
  })

  it('flush closes a short segment, so Concluir never drops the last phrase', () => {
    const segmenter = segmenterInARoom()
    pushAll(segmenter, ticksFor(400), LOUD)
    const [cut] = segmentsIn(segmenter.flush())
    expect(cut.index).toBe(0)
    expect(cut.pcm.length).toBeGreaterThan(0)
  })

  it('flush emits nothing when there is no open segment, and is idempotent', () => {
    const segmenter = segmenterInARoom()
    expect(segmenter.flush()).toEqual([])
    pushAll(segmenter, 10, QUIET)
    expect(segmenter.flush()).toEqual([])

    pushAll(segmenter, ticksFor(2500), LOUD)
    expect(segmentsIn(segmenter.flush())).toHaveLength(1)
    expect(segmenter.flush()).toEqual([])
  })

  it('reports ms consistent with the PCM it emitted', () => {
    const segmenter = segmenterInARoom({ preRollMs: 0, tailPadMs: 0 })
    pushAll(segmenter, ticksFor(2500), LOUD)
    const [cut] = segmentsIn(segmenter.flush())
    expect(cut.ms).toBeCloseTo((cut.pcm.length / RATE) * 1000, 5)
    expect(cut.ms).toBeCloseTo(ticksFor(2500) * TICK_MS, 5)
  })

  it('starts with an unmeasured floor and needs no config argument at all', () => {
    const segmenter = createSegmenter()
    expect(segmenter.noiseFloor()).toBe(0)
    // The exported defaults are the ones in force.
    pushAll(segmenter, 3, QUIET)
    expect(segmenter.push(tick(LOUD))).toEqual([{ type: 'speech' }])
    expect(segmentsIn(pushAll(segmenter, ticksFor(2500), LOUD))).toEqual([])
    expect(
      segmentsIn(pushAll(segmenter, ticksFor(DEFAULT_SEGMENTER_CONFIG.silenceHoldMs + 50), QUIET))
    ).toHaveLength(1)
  })

  // VP-R2.9 — what makes dictation live rather than segmented: the phrase can
  // be read while it is still being spoken.
  describe('draft()', () => {
    it('is null before anything is being said', () => {
      const segmenter = segmenterInARoom()
      expect(segmenter.draft()).toBeNull()
      pushAll(segmenter, ticksFor(500), QUIET)
      expect(segmenter.draft()).toBeNull()
    })

    it('grows with the phrase, and reports the phrase it belongs to', () => {
      const segmenter = segmenterInARoom()
      pushAll(segmenter, ticksFor(1000), LOUD)
      const first = segmenter.draft()
      expect(first).not.toBeNull()
      expect(first?.ms).toBeGreaterThanOrEqual(1000)
      expect(first?.index).toBe(0)

      pushAll(segmenter, ticksFor(1000), LOUD)
      expect(segmenter.draft()?.ms ?? 0).toBeGreaterThan(first?.ms ?? 0)
    })

    it('is null again once the phrase has been cut', () => {
      const segmenter = segmenterInARoom()
      pushAll(segmenter, ticksFor(2500), LOUD)
      pushAll(segmenter, ticksFor(800), QUIET)
      expect(segmenter.draft()).toBeNull()
    })

    it('counts the next phrase as a different one', () => {
      const segmenter = segmenterInARoom()
      pushAll(segmenter, ticksFor(2500), LOUD)
      pushAll(segmenter, ticksFor(800), QUIET)
      pushAll(segmenter, ticksFor(1000), LOUD)
      expect(segmenter.draft()?.index).toBe(1)
    })

    /**
     * The trailing silence a segment keeps as tail-pad material is not speech.
     * Handing Whisper a second of room tone at the end of every pass is how a
     * live transcript grows words nobody said, in the pauses.
     */
    it('stops at the last speech, not at the silence being held', () => {
      const segmenter = segmenterInARoom()
      pushAll(segmenter, ticksFor(1000), LOUD)
      const speaking = segmenter.draft()?.ms ?? 0
      // Under the silence hold, so the phrase is still open.
      pushAll(segmenter, ticksFor(500), QUIET)
      const pausing = segmenter.draft()?.ms ?? 0
      expect(pausing - speaking).toBeLessThanOrEqual(DEFAULT_SEGMENTER_CONFIG.tailPadMs + TICK_MS)
    })

    it('hands out a fresh buffer each time — the caller transfers what it is given', () => {
      const segmenter = segmenterInARoom()
      pushAll(segmenter, ticksFor(1000), LOUD)
      expect(segmenter.draft()?.pcm).not.toBe(segmenter.draft()?.pcm)
    })
  })
})
