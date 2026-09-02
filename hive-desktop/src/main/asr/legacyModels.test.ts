import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { measureLegacyModels, removeLegacyModels } from './legacyModels'

/**
 * The Whisper store an upgrading install still carries. Nothing reads it after
 * M29, and nothing deletes it either — the user is offered the space back,
 * with the measured figure, because several gigabytes someone waited for is
 * not something to remove on their behalf at startup.
 */

describe('legacy Whisper models', () => {
  let userData: string

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'hive-legacy-'))
  })

  afterEach(() => rmSync(userData, { recursive: true, force: true }))

  const seed = (): void => {
    const dir = join(userData, 'whisper-models', 'small', 'onnx')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'encoder_model.onnx'), 'x'.repeat(2048))
    writeFileSync(join(userData, 'whisper-models', 'small', 'config.json'), 'y'.repeat(52))
  }

  it('reports nothing for an install that never had the old store', () => {
    const { bytes, dir } = measureLegacyModels(userData)
    expect(bytes).toBe(0)
    expect(dir).toBe(join(userData, 'whisper-models'))
  })

  it('adds up what is really there, one directory deep and more', () => {
    seed()
    expect(measureLegacyModels(userData).bytes).toBe(2100)
  })

  it('does not count a symlink’s target as space this would free', () => {
    seed()
    const outside = join(userData, 'elsewhere.bin')
    writeFileSync(outside, 'z'.repeat(4096))
    symlinkSync(outside, join(userData, 'whisper-models', 'link.onnx'))
    // Freeing the store would not return those 4 KB, so promising them would be
    // a number the user can check and find wrong.
    expect(measureLegacyModels(userData).bytes).toBe(2100)
  })

  it('frees the space and reports what is left', () => {
    seed()
    expect(removeLegacyModels(userData).bytes).toBe(0)
    expect(measureLegacyModels(userData).bytes).toBe(0)
  })

  it('is a no-op the second time, and on an install that never had it', () => {
    expect(() => removeLegacyModels(userData)).not.toThrow()
    expect(removeLegacyModels(userData).bytes).toBe(0)
  })
})
