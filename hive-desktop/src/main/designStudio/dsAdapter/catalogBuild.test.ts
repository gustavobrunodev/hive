import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import {
  buildCatalog,
  groupOf,
  parseDefault,
  parsePropType,
  WEB_AWESOME_DS_ID,
  type CustomElementsManifest
} from './catalogBuild'
import type { CatalogProp } from '../types'

/**
 * design-studio T2.1 — DS-R13 / D-DS-5.
 *
 * The point of this task is that the catalog is *derived*, so the tests that
 * matter are the ones run against the real installed manifest: a hand-written
 * catalog would pass any number of unit tests about a fixture and still be
 * wrong about the package the app actually ships.
 */

const packageRoot = resolve(__dirname, '..', '..', '..', '..')
const dsRoot = join(packageRoot, 'node_modules', '@awesome.me', 'webawesome')

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

const realCem = readJson(join(dsRoot, 'dist', 'custom-elements.json')) as CustomElementsManifest
const dsVersion = (readJson(join(dsRoot, 'package.json')) as { version: string }).version

describe('parsePropType — the CEM type is what decides the Inspector control', () => {
  it('reads a union of string literals as an enum carrying exactly those values', () => {
    expect(parsePropType("'neutral' | 'brand' | 'danger'")).toEqual({
      kind: 'enum',
      values: ['neutral', 'brand', 'danger']
    })
  })

  it('reads boolean, number and string as themselves', () => {
    expect(parsePropType('boolean')).toEqual({ kind: 'boolean' })
    expect(parsePropType('number')).toEqual({ kind: 'number' })
    expect(parsePropType('string')).toEqual({ kind: 'string' })
  })

  it('treats null/undefined members as optionality, not as a value', () => {
    expect(parsePropType('string | null')).toEqual({ kind: 'string' })
    expect(parsePropType("'x' | 'y' | undefined")).toEqual({ kind: 'enum', values: ['x', 'y'] })
  })

  it('widens a mixed string/literal union to a free-form string', () => {
    expect(parsePropType("string | 'auto'")).toEqual({ kind: 'string' })
  })

  it('drops a type no control can edit rather than degrading it to text', () => {
    expect(parsePropType('HTMLElement')).toBeNull()
    expect(parsePropType('boolean | number')).toBeNull()
    expect(parsePropType(undefined)).toBeNull()
    expect(parsePropType('null')).toBeNull()
  })
})

describe('parseDefault', () => {
  it('unquotes a string literal default, including the empty string', () => {
    expect(parseDefault("'neutral'")).toBe('neutral')
    expect(parseDefault("''")).toBe('')
  })

  it('reads boolean and number defaults', () => {
    expect(parseDefault('false')).toBe(false)
    expect(parseDefault('true')).toBe(true)
    expect(parseDefault('0')).toBe(0)
  })

  it('has no default for null, undefined, blank or an unparseable expression', () => {
    expect(parseDefault('null')).toBeUndefined()
    expect(parseDefault('undefined')).toBeUndefined()
    expect(parseDefault('  ')).toBeUndefined()
    expect(parseDefault(undefined)).toBeUndefined()
    expect(parseDefault('new Date()')).toBeUndefined()
  })
})

describe('groupOf — §3.6 grouping travels with the prop', () => {
  it('files a prop into the group the Inspector renders it under', () => {
    expect(groupOf('variant')).toBe('appearance')
    expect(groupOf('disabled')).toBe('state')
    expect(groupOf('label')).toBe('content')
    expect(groupOf('form')).toBe('advanced')
  })
})

describe('buildCatalog', () => {
  it('keeps only custom elements, sorts by tag and dedupes a repeated declaration', () => {
    const cem: CustomElementsManifest = {
      modules: [
        {
          declarations: [
            { customElement: true, tagName: 'wa-zebra', attributes: [] },
            { customElement: false, tagName: 'not-an-element', attributes: [] },
            { customElement: true, attributes: [] },
            {
              customElement: true,
              tagName: 'wa-alpha',
              summary: 'First line.\nSecond line.',
              slots: [{ name: '' }, { name: 'start' }, { name: 'start' }, {}],
              attributes: [
                { name: 'variant', type: { text: "'a' | 'b'" }, default: "'a'" },
                { name: 'variant', type: { text: 'string' } },
                { name: 'ref', type: { text: 'HTMLElement' } },
                { type: { text: 'string' } }
              ]
            },
            { customElement: true, tagName: 'wa-zebra', attributes: [{ name: 'late' }] }
          ]
        },
        {}
      ]
    }

    const catalog = buildCatalog(cem, '3.11.0')

    expect(catalog).toEqual({
      dsId: WEB_AWESOME_DS_ID,
      version: '3.11.0',
      components: [
        {
          tag: 'wa-alpha',
          summary: 'First line.',
          slots: ['', 'start'],
          props: [
            { name: 'variant', kind: 'enum', values: ['a', 'b'], default: 'a', group: 'appearance' }
          ]
        },
        { tag: 'wa-zebra', slots: [], props: [] }
      ]
    })
  })

  it('omits summary when the manifest has none and defaults slots/attributes to empty', () => {
    const catalog = buildCatalog(
      { modules: [{ declarations: [{ customElement: true, tagName: 'wa-bare' }] }] },
      '1.0.0'
    )
    expect(catalog.components[0]).toEqual({ tag: 'wa-bare', slots: [], props: [] })
    expect(catalog.components[0]).not.toHaveProperty('summary')
  })

  it('is empty for an empty manifest', () => {
    expect(buildCatalog({}, '1.0.0').components).toEqual([])
  })
})

describe('the catalog derived from the real installed manifest (DS-R13)', () => {
  const catalog = buildCatalog(realCem, dsVersion)

  it('covers every custom element the package publishes', () => {
    const declared = (realCem.modules ?? [])
      .flatMap((module) => module.declarations ?? [])
      .filter((declaration) => declaration.customElement === true && declaration.tagName)
    const tags = new Set(declared.map((declaration) => declaration.tagName))

    expect(tags.size).toBe(70)
    expect(catalog.components.map((component) => component.tag).sort()).toEqual([...tags].sort())
    expect(catalog.version).toBe(dsVersion)
  })

  it('exposes wa-button.variant as an enum with exactly its five values', () => {
    const button = catalog.components.find((component) => component.tag === 'wa-button')
    const variant = button?.props.find((prop) => prop.name === 'variant')

    expect(variant).toEqual({
      name: 'variant',
      kind: 'enum',
      values: ['neutral', 'brand', 'success', 'warning', 'danger'],
      default: 'neutral',
      group: 'appearance'
    })
    expect(button?.slots).toEqual(['', 'start', 'end'])
    expect(button?.props.find((prop) => prop.name === 'pill')).toEqual({
      name: 'pill',
      kind: 'boolean',
      default: false,
      group: 'appearance'
    })
  })

  it('gives every prop one of the four kinds, with values iff it is an enum', () => {
    const kinds: CatalogProp['kind'][] = ['enum', 'boolean', 'string', 'number']
    const props = catalog.components.flatMap((component) => component.props)
    expect(props.length).toBeGreaterThan(0)

    const offenders = props.filter(
      (prop) =>
        !kinds.includes(prop.kind) ||
        (prop.kind === 'enum') !== Array.isArray(prop.values) ||
        (prop.values !== undefined && prop.values.length === 0)
    )
    expect(offenders).toEqual([])
  })

  it('matches the committed catalog.json byte for byte — it is generated, not written', () => {
    const committed = readFileSync(
      join(packageRoot, 'resources', 'design-system-web-awesome', 'catalog.json'),
      'utf-8'
    )
    expect(committed).toBe(`${JSON.stringify(catalog, null, 2)}\n`)
  })
})
