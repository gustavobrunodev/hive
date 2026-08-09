import { describe, expect, it } from 'vitest'
import {
  createLocalIconResolver,
  iconDataUrl,
  iconFolder,
  iconKey,
  LOCAL_BRAND_ICONS,
  LOCAL_SOLID_ICONS,
  localIconKeys
} from './iconLibrary'

/**
 * design-studio T2.6 — R-1 / D-DS-8.
 *
 * P-6: `wa-icon` resolves through a Font Awesome CDN by default and the package
 * ships no SVGs, so with the network gone every icon disappears *silently*. The
 * behaviour that matters here is therefore the negative one: an icon the bundle
 * does not carry must resolve to nothing, never back to a URL.
 */

describe('iconFolder', () => {
  it('maps the free tier: brands by family or variant, everything else solid', () => {
    expect(iconFolder('brands', undefined)).toBe('brands')
    expect(iconFolder(undefined, 'brands')).toBe('brands')
    expect(iconFolder('classic', 'solid')).toBe('solid')
    expect(iconFolder(undefined, undefined)).toBe('solid')
    // A Pro family the free set does not have falls back rather than fetching.
    expect(iconFolder('duotone', 'light')).toBe('solid')
  })
})

describe('iconDataUrl', () => {
  it('inlines the SVG so nothing leaves the document', () => {
    expect(iconDataUrl('<svg viewBox="0 0 1 1"/>')).toBe(
      'data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%201%201%22%2F%3E'
    )
  })
})

describe('the local icon resolver', () => {
  const icons = {
    'solid/house': '<svg id="house"/>',
    'brands/github': '<svg id="github"/>'
  }
  const resolve = createLocalIconResolver(icons)

  it('resolves an embedded icon to its inline data URL', () => {
    expect(resolve('house')).toBe(iconDataUrl('<svg id="house"/>'))
    expect(resolve('github', 'brands')).toBe(iconDataUrl('<svg id="github"/>'))
  })

  it('falls back to the solid folder when the requested folder has no such icon', () => {
    expect(resolve('house', 'duotone', 'light')).toBe(iconDataUrl('<svg id="house"/>'))
    expect(resolve('house', 'brands')).toBe(iconDataUrl('<svg id="house"/>'))
  })

  it('resolves an unknown icon to nothing rather than to a URL', () => {
    expect(resolve('nao-existe')).toBeUndefined()
    expect(resolve('nao-existe', 'brands')).toBeUndefined()
  })

  it('returns the same URL for a repeated lookup', () => {
    expect(resolve('house')).toBe(resolve('house'))
  })
})

describe('the shipped icon set', () => {
  it('has no duplicate keys and names each icon by folder', () => {
    const keys = localIconKeys()
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.length).toBe(LOCAL_SOLID_ICONS.length + LOCAL_BRAND_ICONS.length)
    expect(keys).toContain(iconKey('solid', 'house'))
    expect(keys).toContain(iconKey('brands', 'github'))
  })
})
