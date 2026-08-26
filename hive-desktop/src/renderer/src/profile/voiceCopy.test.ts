import { describe, expect, it } from 'vitest'
import { preferenceSummary, reasonCopy } from './voiceCopy'
import { profileScopes, scopeMeta } from './scopes'
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

  describe('preferenceSummary', () => {
    it('names what automatic resolved to, never just "Automático"', () => {
      expect(preferenceSummary({ id: 'small', auto: true })).toBe('Automático · small')
    })

    it('is just the id when the user pinned one', () => {
      expect(preferenceSummary({ id: 'tiny', auto: false })).toBe('tiny')
    })

    /**
     * M26 — three answers, not two. The app ships no weights, so "nenhum
     * modelo" is a real resting state, and the profile index is where a user is
     * most likely to notice it before reaching for the microphone.
     */
    it('says so when nothing is downloaded, rather than showing a dash', () => {
      expect(preferenceSummary({ id: null, auto: true })).toBe('Nenhum modelo baixado')
    })

    it('is null — a skeleton, not a guess — before main answers', () => {
      expect(preferenceSummary(null)).toBeNull()
    })
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
