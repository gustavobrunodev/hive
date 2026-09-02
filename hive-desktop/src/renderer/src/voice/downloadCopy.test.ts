import { describe, expect, it } from 'vitest'
import {
  downloadPercent,
  failureCopy,
  formatBytes,
  formatEta,
  formatMegabytes,
  formatRate,
  isRetryable,
  type AsrDownload
} from './downloadCopy'
import { asrDownloadFixture } from '../testSupport/hiveAsrMock'

const MB = 1024 * 1024

function download(over: Partial<AsrDownload> = {}): AsrDownload {
  return asrDownloadFixture(over)
}

describe('downloadCopy', () => {
  describe('formatBytes', () => {
    /**
     * The unit switches at 1 GB, not at 1000 MB: `923 MB` must never render as
     * `0,9 GB`, and `2.847 MB` and `2,8 GB` are the same download where only
     * one is a size a person can hold in their head.
     */
    it('keeps MB whole and switches to one-decimal GB at the real boundary', () => {
      expect(formatBytes(144 * MB)).toBe('144 MB')
      expect(formatBytes(923 * MB)).toBe('923 MB')
      expect(formatBytes(1024 * MB)).toBe('1,0 GB')
      expect(formatBytes(2916 * MB)).toBe('2,8 GB')
    })

    it('writes the decimal with a comma, as pt-BR does', () => {
      expect(formatBytes(1536 * MB)).toContain(',')
      expect(formatBytes(1536 * MB)).not.toContain('.')
    })

    it('never rounds a real download down to zero', () => {
      expect(formatBytes(100)).toBe('1 MB')
    })

    it('says zero only for zero (and for nonsense)', () => {
      expect(formatBytes(0)).toBe('0 MB')
      expect(formatBytes(Number.NaN)).toBe('0 MB')
    })

    it('formats the catalog size the same way', () => {
      expect(formatMegabytes(2916)).toBe('2,8 GB')
    })
  })

  describe('formatRate', () => {
    it('states MB/s once there is a measurement', () => {
      expect(formatRate(3.5 * MB)).toBe('3,5 MB/s')
    })

    it('says nothing rather than a confident zero before two samples exist', () => {
      expect(formatRate(0)).toBeNull()
    })
  })

  describe('formatEta', () => {
    it('stops counting under a minute instead of ticking down seconds', () => {
      expect(
        formatEta(download({ loaded: 90 * MB, total: 100 * MB, bytesPerSecond: 1 * MB }))
      ).toBe('menos de 1 min restante')
    })

    it('rounds to whole minutes, and to tenths of an hour beyond one', () => {
      expect(formatEta(download({ loaded: 0, total: 600 * MB, bytesPerSecond: 1 * MB }))).toContain(
        'cerca de 10 min'
      )
      expect(
        formatEta(download({ loaded: 0, total: 7200 * MB, bytesPerSecond: 1 * MB }))
      ).toContain('h restantes')
    })

    /**
     * Three ways there is no honest answer, and all three say nothing rather
     * than printing `Infinity` or `NaN` into the row.
     */
    it('says nothing when there is nothing to compute from', () => {
      expect(formatEta(download({ total: 0 }))).toBeNull()
      expect(formatEta(download({ bytesPerSecond: 0 }))).toBeNull()
      expect(formatEta(download({ loaded: 100, total: 100 }))).toBeNull()
    })
  })

  describe('downloadPercent', () => {
    it('rounds, and caps at 100 so a resumed byte count cannot overshoot', () => {
      expect(downloadPercent(download({ loaded: 50, total: 200 }))).toBe(25)
      expect(downloadPercent(download({ loaded: 210, total: 200 }))).toBe(100)
    })

    it('is null — "preparing", not 0% — before the file index lands', () => {
      expect(downloadPercent(download({ total: 0 }))).toBeNull()
    })
  })

  describe('failureCopy', () => {
    /**
     * The surface this replaces had one sentence for every cause: "O download
     * falhou." A full disk, a dropped connection and an unpublished model are
     * three problems with three different next steps.
     */
    it('says something different, and actionable, for each cause', () => {
      const sentences = (['offline', 'server', 'notFound', 'disk', 'unsupported'] as const).map(
        (kind) => failureCopy({ kind, detail: '' })
      )
      expect(new Set(sentences).size).toBe(sentences.length)
      expect(failureCopy({ kind: 'disk', detail: '' })).toContain('espaço em disco')
      expect(failureCopy({ kind: 'offline', detail: '' })).toContain('conexão')
    })

    it('has an honest sentence for a cause it could not read', () => {
      expect(failureCopy(null)).toContain('não soube ler')
      expect(failureCopy({ kind: 'unknown', detail: 'x' })).toContain('não soube ler')
    })
  })

  describe('isRetryable', () => {
    it('offers no retry for an answer that will not change', () => {
      expect(isRetryable({ kind: 'notFound', detail: '' })).toBe(false)
      expect(isRetryable({ kind: 'unsupported', detail: '' })).toBe(false)
    })

    it('offers one for everything that might', () => {
      expect(isRetryable({ kind: 'offline', detail: '' })).toBe(true)
      expect(isRetryable({ kind: 'server', detail: '' })).toBe(true)
      expect(isRetryable({ kind: 'disk', detail: '' })).toBe(true)
      expect(isRetryable(null)).toBe(true)
    })
  })
})
