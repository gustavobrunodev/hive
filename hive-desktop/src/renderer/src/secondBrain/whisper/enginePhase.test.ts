import { describe, expect, it } from 'vitest'
import { enginePhaseView } from './enginePhase'

describe('enginePhaseView', () => {
  it('says nothing when the engine is idle', () => {
    expect(enginePhaseView({ status: 'idle' })).toBeNull()
  })

  it('says nothing on error — the failure surface owns that message', () => {
    expect(enginePhaseView({ status: 'error', message: 'boom' })).toBeNull()
  })

  it('reports download as measurable, with its real percentage', () => {
    const view = enginePhaseView({ status: 'downloading', pct: 42, file: 'encoder.onnx' })
    expect(view).toMatchObject({ kind: 'downloading', pct: 42 })
    expect(view?.hint).toBeTruthy()
  })

  it('reports loading as measurable', () => {
    expect(enginePhaseView({ status: 'loading', pct: 7 })).toMatchObject({
      kind: 'loading',
      pct: 7
    })
  })

  // The regression this whole phase exists for: session building reports no
  // progress, so claiming a number there is what produced a frozen "100%".
  it('reports warming as UNmeasurable, and says the first run is slow', () => {
    const view = enginePhaseView({ status: 'warming' })
    expect(view?.kind).toBe('warming')
    expect(view?.pct).toBeNull()
    expect(view?.hint).toContain('porcentagem')
  })

  it('reports transcribing as unmeasurable too, and says it stays local', () => {
    const view = enginePhaseView({ status: 'transcribing' })
    expect(view?.pct).toBeNull()
    expect(view?.hint).toContain('seu computador')
  })

  it('gives every visible phase a label', () => {
    for (const phase of [
      { status: 'downloading', pct: 1, file: 'f' },
      { status: 'loading', pct: 1 },
      { status: 'warming' },
      { status: 'transcribing' }
    ] as const) {
      expect(enginePhaseView(phase)?.label).toBeTruthy()
    }
  })
})
