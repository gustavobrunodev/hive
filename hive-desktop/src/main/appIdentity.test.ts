import { readFileSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { APP_ID, APP_NAME } from './appIdentity'

/**
 * The packaged app reads `electron-builder.yml`; a dev run reads
 * `appIdentity.ts`. Nothing links them but this test, and a drift between
 * them only surfaces on a real Windows install — as user data landing in the
 * wrong folder, or a pinned taskbar button that opens a second, unrelated
 * icon.
 */
describe('app identity', () => {
  const builder = yaml.load(
    readFileSync(join(__dirname, '../../electron-builder.yml'), 'utf-8')
  ) as Record<string, unknown> & { win?: { executableName?: string } }

  it('matches electron-builder.yml productName', () => {
    expect(builder.productName).toBe(APP_NAME)
  })

  it('matches electron-builder.yml appId', () => {
    expect(builder.appId).toBe(APP_ID)
  })

  it('names the Windows executable after the product, so the taskbar label reads "Hive"', () => {
    expect(builder.win?.executableName).toBe(APP_NAME)
  })

  it('is a reverse-DNS id, which is what Windows and macOS both expect', () => {
    expect(APP_ID).toMatch(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/)
  })
})
