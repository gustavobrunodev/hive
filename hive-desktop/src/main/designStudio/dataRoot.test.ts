import { describe, expect, it } from 'vitest'
import { join } from 'path'
import { DATA_ROOT_DIR, documentsDir, resolveDataRoot } from './dataRoot'

/**
 * Design Studio — where the module's data lives (Landing 3 and 11).
 *
 * `<raiz>` is the person's Documents folder plus `Design Studio`. The E2E
 * points it somewhere disposable through `HIVE_E2E_DOCUMENTS`, which — same
 * shape as the scripted-agent seam — takes BOTH conditions: the launcher's
 * `HIVE_E2E=1` and the variable itself. The matrix below is that pair, each
 * alone, and neither.
 */

const DOCUMENTS = join('/home', 'marina', 'Documentos')
const E2E_DOCUMENTS = join('/tmp', 'hive-e2e-docs')

describe('designStudio data root', () => {
  it('names the module folder with its display name, space included', () => {
    expect(DATA_ROOT_DIR).toBe('Design Studio')
  })

  it('lives in the Documents folder in production', () => {
    expect(resolveDataRoot(DOCUMENTS, {})).toBe(join(DOCUMENTS, 'Design Studio'))
  })

  it('takes the E2E Documents folder only with the launcher flag on', () => {
    const env = { HIVE_E2E: '1', HIVE_E2E_DOCUMENTS: E2E_DOCUMENTS }
    expect(documentsDir(DOCUMENTS, env)).toBe(E2E_DOCUMENTS)
    // The variable replaces the Documents folder, not the root: the E2E still
    // walks the production shape, `Design Studio` segment and all.
    expect(resolveDataRoot(DOCUMENTS, env)).toBe(join(E2E_DOCUMENTS, 'Design Studio'))
  })

  it('ignores a stray HIVE_E2E_DOCUMENTS without the flag', () => {
    for (const flag of [undefined, '0', 'true']) {
      const env = { HIVE_E2E: flag, HIVE_E2E_DOCUMENTS: E2E_DOCUMENTS }
      expect(resolveDataRoot(DOCUMENTS, env)).toBe(join(DOCUMENTS, 'Design Studio'))
    }
  })

  it('stays on the real Documents when the flag has nothing to redirect to', () => {
    expect(resolveDataRoot(DOCUMENTS, { HIVE_E2E: '1' })).toBe(join(DOCUMENTS, 'Design Studio'))
    expect(resolveDataRoot(DOCUMENTS, { HIVE_E2E: '1', HIVE_E2E_DOCUMENTS: '' })).toBe(
      join(DOCUMENTS, 'Design Studio')
    )
  })

  it('redirects to a folder that does not exist yet — never back to the real Documents', () => {
    const missing = join(E2E_DOCUMENTS, 'ainda-nao-existe')
    expect(resolveDataRoot(DOCUMENTS, { HIVE_E2E: '1', HIVE_E2E_DOCUMENTS: missing })).toBe(
      join(missing, 'Design Studio')
    )
  })

  it('reads process.env when no environment is handed in', () => {
    const before = { flag: process.env.HIVE_E2E, docs: process.env.HIVE_E2E_DOCUMENTS }
    try {
      process.env.HIVE_E2E = '1'
      process.env.HIVE_E2E_DOCUMENTS = E2E_DOCUMENTS
      expect(resolveDataRoot(DOCUMENTS)).toBe(join(E2E_DOCUMENTS, 'Design Studio'))
    } finally {
      if (before.flag === undefined) delete process.env.HIVE_E2E
      else process.env.HIVE_E2E = before.flag
      if (before.docs === undefined) delete process.env.HIVE_E2E_DOCUMENTS
      else process.env.HIVE_E2E_DOCUMENTS = before.docs
    }
  })
})
