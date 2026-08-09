/**
 * Design Studio (M18) — T2.1. Custom Elements Manifest → `ComponentCatalog`.
 *
 * D-DS-5: the catalog is **derived**, never hand-written. The DS package
 * publishes a 2.0 MB `dist/custom-elements.json` (P-2) that already carries the
 * one thing the whole module hangs on — the *type* of every attribute
 * (`'neutral' | 'brand' | …`, `boolean`, `string | null`). Deriving from it is
 * what makes DS-R13 ("o catálogo é a única fonte de verdade") mechanically true
 * instead of aspirational: nobody can add a prop the Inspector offers but the
 * component does not accept, because nobody types the list.
 *
 * This file is the pure transform, so it is testable against the real installed
 * manifest with no build step. `scripts/buildDsCatalog.mjs` is the thin runner
 * that freezes its output into `resources/design-system-web-awesome/catalog.json`
 * — frozen at build time so the main process never parses 2 MB on boot and the
 * catalog stays reviewable in a diff.
 *
 * It reads the manifest as data (a JSON file path), so it does **not** import
 * the DS package; the T2.7 boundary guard covers imports, and this file lives
 * inside `dsAdapter/` in any case.
 */

import type { CatalogComponent, CatalogProp, ComponentCatalog } from '../types'

/** The id of the v1 adapter. Persisted in the session so Telas never migrate (DS-R12). */
export const WEB_AWESOME_DS_ID = 'web-awesome'

/** The slice of the CEM schema this transform reads. */
export interface CemAttribute {
  name?: string
  type?: { text?: string }
  default?: string
}

export interface CemDeclaration {
  customElement?: boolean
  tagName?: string
  summary?: string
  slots?: { name?: string }[]
  attributes?: CemAttribute[]
}

export interface CustomElementsManifest {
  modules?: { declarations?: CemDeclaration[] }[]
}

const STRING_LITERAL = /^'([^']*)'$/

/**
 * Props the eye reads first, in the order the Inspector groups them (§3.6). A
 * `wa-button` declares 20+ attributes; a flat list of 20 turns an inspector
 * into a spreadsheet, so the group travels with the prop rather than being
 * re-derived by every surface that renders it.
 */
const APPEARANCE_PROPS = new Set([
  'variant',
  'appearance',
  'size',
  'pill',
  'shape',
  'orientation',
  'placement'
])

const STATE_PROPS = new Set([
  'disabled',
  'loading',
  'checked',
  'open',
  'expanded',
  'active',
  'selected',
  'indeterminate',
  'readonly',
  'required'
])

const CONTENT_PROPS = new Set([
  'label',
  'title',
  'caption',
  'placeholder',
  'hint',
  'text',
  'value',
  'src',
  'href'
])

export function groupOf(name: string): CatalogProp['group'] {
  if (APPEARANCE_PROPS.has(name)) return 'appearance'
  if (STATE_PROPS.has(name)) return 'state'
  if (CONTENT_PROPS.has(name)) return 'content'
  return 'advanced'
}

/**
 * The declared TypeScript type of an attribute → the control the Inspector can
 * actually render. Anything that does not land in one of the four kinds
 * (`HTMLElement`, `Date`, an array, a function) is **dropped** rather than
 * degraded to a text field: an editable prop that cannot be edited correctly is
 * worse than an absent one, and DS-R6 says every prop the Inspector offers is a
 * prop the component really accepts.
 */
export function parsePropType(text: string | undefined): {
  kind: CatalogProp['kind']
  values?: string[]
} | null {
  if (!text) return null
  const members = text
    .split('|')
    .map((member) => member.trim())
    // `null`/`undefined` members only say "optional" — they never change the control.
    .filter((member) => member.length > 0 && member !== 'null' && member !== 'undefined')
  if (members.length === 0) return null

  if (members.every((member) => STRING_LITERAL.test(member))) {
    return { kind: 'enum', values: members.map((member) => STRING_LITERAL.exec(member)![1]) }
  }
  if (members.length === 1) {
    const only = members[0]
    if (only === 'boolean' || only === 'number' || only === 'string') return { kind: only }
    return null
  }
  // A widened union such as `string | 'auto'`: the free-form side wins, because
  // a Select with a subset of the legal values would reject valid input.
  if (members.every((member) => member === 'string' || STRING_LITERAL.test(member))) {
    return { kind: 'string' }
  }
  return null
}

/** The CEM writes defaults as source text (`'neutral'`, `false`, `0`, `null`). */
export function parseDefault(raw: string | undefined): string | number | boolean | undefined {
  if (raw === undefined) return undefined
  const text = raw.trim()
  if (text === '' || text === 'null' || text === 'undefined') return undefined
  const literal = STRING_LITERAL.exec(text)
  if (literal) return literal[1]
  if (text === 'true') return true
  if (text === 'false') return false
  const asNumber = Number(text)
  return Number.isFinite(asNumber) ? asNumber : undefined
}

function toProps(attributes: CemAttribute[]): CatalogProp[] {
  const props: CatalogProp[] = []
  const seen = new Set<string>()
  for (const attribute of attributes) {
    const name = attribute.name
    if (!name || seen.has(name)) continue
    const parsed = parsePropType(attribute.type?.text)
    if (!parsed) continue
    seen.add(name)
    const value = parseDefault(attribute.default)
    props.push({
      name,
      kind: parsed.kind,
      ...(parsed.values ? { values: parsed.values } : {}),
      ...(value !== undefined ? { default: value } : {}),
      group: groupOf(name)
    })
  }
  return props
}

function toComponent(declaration: CemDeclaration & { tagName: string }): CatalogComponent {
  const slots = [...new Set((declaration.slots ?? []).map((slot) => slot.name ?? ''))]
  const component: CatalogComponent = {
    tag: declaration.tagName,
    slots,
    props: toProps(declaration.attributes ?? [])
  }
  // The CEM summary is a full doc paragraph; the Inspector shows one line.
  const summary = declaration.summary?.split('\n')[0].trim()
  if (summary) component.summary = summary
  return component
}

export function buildCatalog(cem: CustomElementsManifest, version: string): ComponentCatalog {
  const byTag = new Map<string, CatalogComponent>()
  for (const module of cem.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.customElement !== true || typeof declaration.tagName !== 'string') continue
      if (byTag.has(declaration.tagName)) continue
      byTag.set(
        declaration.tagName,
        toComponent(declaration as CemDeclaration & { tagName: string })
      )
    }
  }
  return {
    dsId: WEB_AWESOME_DS_ID,
    version,
    components: [...byTag.values()].sort((a, b) => a.tag.localeCompare(b.tag))
  }
}
