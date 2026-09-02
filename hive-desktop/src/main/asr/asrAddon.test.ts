import { describe, expect, it } from 'vitest'
import { sherpaBinaryPackage, sherpaModuleSpecifier } from './asrAddon'

describe('sherpaModuleSpecifier', () => {
  it('uses the bare package name when unpackaged', () => {
    expect(sherpaModuleSpecifier({ appPath: '/repo/hive-desktop', packaged: false })).toBe(
      'sherpa-onnx-node'
    )
  })

  it('redirects into the unpacked tree when packaged', () => {
    // The addon walks relative paths from its own __dirname; inside the archive
    // that walk lands on a path Node cannot dlopen, and the package resolves to
    // `undefined` instead of throwing.
    expect(sherpaModuleSpecifier({ appPath: '/opt/Hive/resources/app.asar', packaged: true })).toBe(
      '/opt/Hive/resources/app.asar.unpacked/node_modules/sherpa-onnx-node'
    )
  })

  it('leaves an already-unpacked app path alone', () => {
    expect(sherpaModuleSpecifier({ appPath: '/opt/Hive/resources/app', packaged: true })).toBe(
      '/opt/Hive/resources/app/node_modules/sherpa-onnx-node'
    )
  })
})

describe('sherpaBinaryPackage', () => {
  it('follows the addon author’s win32 → win rename', () => {
    expect(sherpaBinaryPackage('win32', 'x64')).toBe('sherpa-onnx-win-x64')
  })

  it('leaves the other platforms as node reports them', () => {
    expect(sherpaBinaryPackage('linux', 'x64')).toBe('sherpa-onnx-linux-x64')
    expect(sherpaBinaryPackage('darwin', 'arm64')).toBe('sherpa-onnx-darwin-arm64')
  })
})
