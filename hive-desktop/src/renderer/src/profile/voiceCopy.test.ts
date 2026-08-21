import { describe, expect, it } from 'vitest'
import { modelTradeoff, preferenceCaption, preferenceSummary, reasonCopy } from './voiceCopy'
import { AUTO, modelRowMeta, pickedModel } from './modelChoiceValue'
import { profileScopes, scopeMeta } from './scopes'
import { whisperModelFixture } from '../testSupport/hiveWhisperMock'
import type { RecommendationReason } from '../../../main/whisperTypes'

/** A probe result with the reason under test. */
function probe(
  reason: RecommendationReason,
  over: Record<string, unknown> = {}
): Parameters<typeof reasonCopy>[0] & object {
  return {
    recommendedId: 'small' as const,
    reason,
    gpu: true,
    ramGB: 32,
    cores: 12,
    ...over
  }
}

describe('voiceCopy', () => {
  describe('reasonCopy', () => {
    /**
     * Every rung of the ladder has to be able to explain itself. Three of the
     * five reasons land on the SAME model (`tiny`), which is exactly why the
     * sentence matters: without it the user sees the app pick the smallest
     * model and has no idea whether that was about memory, about the GPU, or
     * about a probe that failed.
     */
    it('explains each reason in its own terms, naming what it measured', () => {
      expect(reasonCopy(probe('lowMemory', { ramGB: 6 }))).toContain('6 GB')
      expect(reasonCopy(probe('cpuOnly', { cores: 4 }))).toContain('4 núcleos')
      expect(reasonCopy(probe('noGpu'))).toContain('placa de vídeo dedicada')
      expect(reasonCopy(probe('discreteGpu', { ramGB: 32 }))).toContain('32 GB')
      expect(reasonCopy(probe('unknown'))).toContain('Não foi possível avaliar')
    })

    it('says nothing at all when there is no probe result yet', () => {
      expect(reasonCopy(null)).toBeNull()
    })
  })

  describe('modelTradeoff', () => {
    /**
     * The trade-off, not the parameter count, is the choice being made. The
     * `.en` variants share their base model's character — a reader picking
     * `small.en` is picking accuracy, same as `small`.
     */
    it('maps each family to the choice it represents, English-only included', () => {
      expect(modelTradeoff('tiny')).toBe('O mais rápido')
      expect(modelTradeoff('tiny.en')).toBe('O mais rápido')
      expect(modelTradeoff('base')).toBe('Equilibrado')
      expect(modelTradeoff('base.en')).toBe('Equilibrado')
      expect(modelTradeoff('small')).toBe('O mais preciso')
      expect(modelTradeoff('large-v3')).toBe('O mais preciso')
    })
  })

  describe('preferenceSummary', () => {
    it('names what automatic resolved to, never just "Automático"', () => {
      expect(preferenceSummary({ id: 'small', auto: true })).toBe('Automático · small')
    })

    it('is just the id when the user pinned one', () => {
      expect(preferenceSummary({ id: 'tiny', auto: false })).toBe('tiny')
    })

    it('is null — a skeleton, not a guess — before main answers', () => {
      expect(preferenceSummary(null)).toBeNull()
    })
  })

  describe('preferenceCaption', () => {
    it('distinguishes the app choosing from the user choosing', () => {
      expect(preferenceCaption({ id: 'small', auto: true })).toBe('O Hive está usando small.')
      expect(preferenceCaption({ id: 'tiny', auto: false })).toBe('Você fixou tiny.')
    })
  })
})

describe('modelChoiceValue', () => {
  it('round-trips the automatic sentinel back to "hand it to the probe"', () => {
    expect(pickedModel(AUTO)).toBeNull()
    expect(pickedModel('small')).toBe('small')
  })

  /**
   * A bundled model's size is the fp32 copy **already on disk** — never what a
   * download at some other precision would have cost. Quoting the download
   * figure for a file that is already here describes a hypothetical.
   */
  it('quotes the on-disk size and flags what the row is', () => {
    expect(
      modelRowMeta(whisperModelFixture({ params: '74 M', sizeMB: { fp32: 278, q8: 73 } }))
    ).toBe('74 M · 278 MB · No aplicativo')
  })

  it('marks an English-only model, and omits the bundled suffix for a download', () => {
    const meta = modelRowMeta(
      whisperModelFixture({
        id: 'medium.en',
        params: '769 M',
        sizeMB: { fp32: 2916, q8: 740 },
        multilingual: false,
        bundled: false
      })
    )
    expect(meta).toBe('769 M · 2.8 GB · só inglês')
  })
})

describe('profileScopes', () => {
  it('lists every scope the sheet can open, in reading order', () => {
    expect(profileScopes().map((scope) => scope.id)).toEqual([
      'account',
      'agents',
      'shortcuts',
      'voice',
      'shell'
    ])
  })

  it('resolves a scope to its copy, and the index to nothing', () => {
    expect(scopeMeta('voice')?.label).toBe('Voz e transcrição')
    // `null` is the index itself, which has its own title — not a scope.
    expect(scopeMeta(null)).toBeNull()
  })
})
