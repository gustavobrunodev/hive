/**
 * Design Studio (M18) — T2.4. The concrete v1 adapter over Web Awesome.
 *
 * This is the only place in the repo authorised to know the DS package exists
 * (AD-4, enforced by the T2.7 boundary test). Everything else asks the port.
 *
 * The catalog is read from the artifact `scripts/buildDsCatalog.mjs` froze at
 * build time (D-DS-5) rather than derived at boot, and it is injected rather
 * than looked up, so `validate()` is testable without Electron, a filesystem or
 * a 2 MB manifest.
 *
 * `validate()` is the *only* gate between any surface and the document: the
 * reducer applies commands without checking (AD-2), so a rule missing here is a
 * rule that does not exist. Both automatic generation (DS-R2) and manual
 * editing (DS-R6/R7) call this same function — DS-R13 AC-3.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import type {
  CapabilityViolation,
  CatalogProp,
  Command,
  ComponentCatalog,
  ScreenDocument,
  ScreenNode
} from '../types'
import type { DesignSystemAdapter } from './types'
import { WEB_AWESOME_DS_ID } from './catalogBuild'
import { urlSchemeReason } from './urlSchemeRule'

export { WEB_AWESOME_DS_ID }

/** Where `buildDsCatalog.mjs` / `buildDsBundle.mjs` write, under `resources/`. */
export const WEB_AWESOME_DIRNAME = 'design-system-web-awesome'

export function loadWebAwesomeCatalog(resourcesRoot: string): ComponentCatalog {
  const path = join(resourcesRoot, WEB_AWESOME_DIRNAME, 'catalog.json')
  return JSON.parse(readFileSync(path, 'utf-8')) as ComponentCatalog
}

/** A catalog prop with the enum's values normalised, so no reader needs a fallback. */
interface IndexedProp extends CatalogProp {
  values: string[]
}

interface IndexedComponent {
  slots: Set<string>
  props: Map<string, IndexedProp>
}

function indexCatalog(catalog: ComponentCatalog): Map<string, IndexedComponent> {
  return new Map(
    catalog.components.map((component) => [
      component.tag,
      {
        slots: new Set(component.slots),
        props: new Map(
          component.props.map((prop) => [prop.name, { ...prop, values: prop.values ?? [] }])
        )
      }
    ])
  )
}

function violation(
  componentId: string,
  reason: string,
  attemptedValue?: unknown
): CapabilityViolation {
  return {
    kind: 'capability',
    componentId,
    reason,
    ...(attemptedValue === undefined ? {} : { attemptedValue })
  }
}

function findNode(node: ScreenNode | null, id: string): ScreenNode | null {
  if (!node) return null
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

/**
 * `null`/`''` on any prop means "remove the prop", not "invalid value" — the
 * spec's edge case for an enum cleared in the Inspector.
 */
function isClearing(value: string | number | boolean | null): boolean {
  return value === null || value === ''
}

const KIND_LABEL: Record<Exclude<CatalogProp['kind'], 'enum'>, string> = {
  boolean: 'um booleano',
  number: 'um número',
  string: 'um texto'
}

function propValueReason(
  tag: string,
  prop: IndexedProp,
  value: string | number | boolean | null
): string | null {
  if (isClearing(value)) return null
  if (prop.kind === 'enum') {
    return prop.values.includes(String(value))
      ? null
      : `"${String(value)}" não é um valor válido para "${prop.name}" em "${tag}" ` +
          `(esperado: ${prop.values.join(', ')}).`
  }
  const expected = prop.kind === 'boolean' ? 'boolean' : prop.kind
  return typeof value === expected
    ? null
    : `A propriedade "${prop.name}" em "${tag}" espera ${KIND_LABEL[prop.kind]}.`
}

/** Extra per-prop rules layered on top of the catalog kind (T2.5 adds the URL allowlist). */
export type PropRule = (
  tag: string,
  prop: CatalogProp,
  value: string | number | boolean | null
) => string | null

function checkProp(
  index: Map<string, IndexedComponent>,
  rules: PropRule[],
  componentId: string,
  tag: string,
  key: string,
  value: string | number | boolean | null
): CapabilityViolation | null {
  const component = index.get(tag)
  if (!component) {
    return violation(componentId, `O Componente "${tag}" não existe no design system ativo.`)
  }
  const prop = component.props.get(key)
  if (!prop) {
    return violation(componentId, `A propriedade "${key}" não existe em "${tag}".`, value)
  }
  for (const rule of [propValueReason as PropRule, urlSchemeReason, ...rules]) {
    const reason = rule(tag, prop, value)
    if (reason) return violation(componentId, reason, value)
  }
  return null
}

function checkSubtree(
  index: Map<string, IndexedComponent>,
  rules: PropRule[],
  node: ScreenNode
): CapabilityViolation | null {
  if (!index.has(node.tag)) {
    return violation(node.id, `O Componente "${node.tag}" não existe no design system ativo.`)
  }
  for (const [key, value] of Object.entries(node.props)) {
    const bad = checkProp(index, rules, node.id, node.tag, key, value)
    if (bad) return bad
  }
  for (const child of node.children) {
    const bad = checkSlot(index, node.tag, child) ?? checkSubtree(index, rules, child)
    if (bad) return bad
  }
  return null
}

/** DS-R7 AC-4: a Component may only land in a slot the parent declares. */
function checkSlot(
  index: Map<string, IndexedComponent>,
  parentTag: string,
  child: { id: string; slot?: string }
): CapabilityViolation | null {
  const parent = index.get(parentTag)
  const slot = child.slot ?? ''
  if (!parent || parent.slots.has(slot)) return null
  const declared = [...parent.slots].map((name) => name || '(padrão)').join(', ') || '(nenhum)'
  return violation(
    child.id,
    `O slot "${slot}" não existe em "${parentTag}" (slots: ${declared}).`,
    child.slot
  )
}

function parentTagOf(
  document: ScreenDocument,
  parentId: string,
  componentId: string
): { tag: string } | CapabilityViolation {
  const parent = findNode(document.root, parentId)
  if (!parent) return violation(componentId, `O Componente "${parentId}" não está nesta Tela.`)
  return { tag: parent.tag }
}

function validateAdd(
  index: Map<string, IndexedComponent>,
  rules: PropRule[],
  document: ScreenDocument,
  command: Extract<Command, { type: 'AddComponent' }>
): CapabilityViolation | null {
  if (command.parentId !== null) {
    const parent = parentTagOf(document, command.parentId, command.node.id)
    if ('kind' in parent) return parent
    const badSlot = checkSlot(index, parent.tag, { id: command.node.id, slot: command.slot })
    if (badSlot) return badSlot
  }
  return checkSubtree(index, rules, command.node)
}

function validateMove(
  index: Map<string, IndexedComponent>,
  document: ScreenDocument,
  command: Extract<Command, { type: 'MoveComponent' }>
): CapabilityViolation | null {
  if (!findNode(document.root, command.componentId)) {
    return violation(
      command.componentId,
      `O Componente "${command.componentId}" não está nesta Tela.`
    )
  }
  const parent = parentTagOf(document, command.newParentId, command.componentId)
  if ('kind' in parent) return parent
  return checkSlot(index, parent.tag, { id: command.componentId, slot: command.slot })
}

function validateSetProp(
  index: Map<string, IndexedComponent>,
  rules: PropRule[],
  document: ScreenDocument,
  command: Extract<Command, { type: 'SetProp' }>
): CapabilityViolation | null {
  const node = findNode(document.root, command.componentId)
  if (!node) {
    return violation(
      command.componentId,
      `O Componente "${command.componentId}" não está nesta Tela.`
    )
  }
  return checkProp(index, rules, node.id, node.tag, command.key, command.value)
}

/**
 * Builds the adapter over an already-loaded catalog.
 *
 * The catalog kind check and the URL scheme allowlist (T2.5) always run; `rules`
 * are additional per-prop checks a caller layers on top.
 */
export function createWebAwesomeAdapter(
  catalog: ComponentCatalog,
  rules: PropRule[] = []
): DesignSystemAdapter {
  const index = indexCatalog(catalog)
  return {
    id: catalog.dsId,
    catalog: () => catalog,
    validate(command: Command, document: ScreenDocument): CapabilityViolation | null {
      switch (command.type) {
        case 'AddComponent':
          return validateAdd(index, rules, document, command)
        case 'RemoveComponent':
          return findNode(document.root, command.componentId)
            ? null
            : violation(
                command.componentId,
                `O Componente "${command.componentId}" não está nesta Tela.`
              )
        case 'MoveComponent':
          return validateMove(index, document, command)
        case 'SetProp':
          return validateSetProp(index, rules, document, command)
      }
    }
  }
}
