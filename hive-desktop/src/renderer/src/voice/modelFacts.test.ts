import { describe, expect, it } from 'vitest'
import { libraryOrder, modelRating, modelTradeoff, type ModelInfo } from './modelFacts'
import { whisperModelFixture } from '../testSupport/hiveWhisperMock'

function model(over: Partial<ModelInfo> = {}): ModelInfo {
  return whisperModelFixture(over)
}

describe('modelFacts', () => {
  describe('modelRating', () => {
    /**
     * Both readings are **derived from the row's own published numbers**, never
     * from a hand-written table — a second source of truth would drift the
     * first time a model is added to the catalog.
     */
    it('reads accuracy off the parameter count, in both M and B', () => {
      expect(modelRating(model({ params: '39 M' })).accuracy).toBe(1)
      expect(modelRating(model({ params: '74 M' })).accuracy).toBe(2)
      expect(modelRating(model({ params: '244 M' })).accuracy).toBe(3)
      expect(modelRating(model({ params: '769 M' })).accuracy).toBe(4)
      expect(modelRating(model({ params: '1.55 B' })).accuracy).toBe(5)
    })

    it('reads speed off the published multiplier', () => {
      expect(modelRating(model({ relativeSpeed: '~10x' })).speed).toBe(5)
      expect(modelRating(model({ relativeSpeed: '~7x' })).speed).toBe(4)
      expect(modelRating(model({ relativeSpeed: '~4x' })).speed).toBe(3)
      expect(modelRating(model({ relativeSpeed: '~2x' })).speed).toBe(2)
      expect(modelRating(model({ relativeSpeed: '1x' })).speed).toBe(1)
    })

    it('never produces NaN from a figure it cannot parse', () => {
      const rating = modelRating(model({ params: 'unknown', relativeSpeed: 'fast' }))
      expect(rating.accuracy).toBe(1)
      expect(rating.speed).toBe(1)
    })
  })

  describe('modelTradeoff', () => {
    it('describes the character each pair of readings adds up to', () => {
      expect(modelTradeoff(model({ params: '39 M', relativeSpeed: '~10x' }))).toBe('O mais rápido')
      expect(modelTradeoff(model({ params: '244 M', relativeSpeed: '~4x' }))).toBe('Equilibrado')
      expect(modelTradeoff(model({ params: '769 M', relativeSpeed: '~2x' }))).toBe('O mais preciso')
      // large-v3-turbo: accurate AND fast, which is a different thing to say.
      expect(modelTradeoff(model({ params: '809 M', relativeSpeed: '~8x' }))).toBe(
        'Preciso e rápido'
      )
    })

    it('has a sentence for every catalog row, without anyone writing one', () => {
      const rows = [
        model({ params: '74 M', relativeSpeed: '~7x' }),
        model({ params: '1.55 B', relativeSpeed: '1x' })
      ]
      for (const row of rows) expect(modelTradeoff(row).length).toBeGreaterThan(0)
    })
  })

  describe('libraryOrder', () => {
    /**
     * The `.en` builds are a specialist's choice in a pt-BR product — they
     * transcribe Portuguese into confident nonsense — so they belong in the
     * list, findable, and below what anyone here would reach for. Sorting
     * purely by size would put `tiny.en` second.
     */
    it('puts every multilingual model first, each group by ascending size', () => {
      const ordered = libraryOrder([
        model({ id: 'small.en', multilingual: false, sizeMB: { fp32: 923, q8: 238 } }),
        model({ id: 'base', sizeMB: { fp32: 278, q8: 73 } }),
        model({ id: 'tiny.en', multilingual: false, sizeMB: { fp32: 144, q8: 39 } }),
        model({ id: 'tiny', sizeMB: { fp32: 144, q8: 39 } })
      ])
      expect(ordered.map((m) => m.id)).toEqual(['tiny', 'base', 'tiny.en', 'small.en'])
    })

    it('does not mutate the list it was handed', () => {
      const input = [model({ id: 'base' }), model({ id: 'tiny' })]
      libraryOrder(input)
      expect(input.map((m) => m.id)).toEqual(['base', 'tiny'])
    })
  })
})
