/**
 * Design Studio (M18) — T6.1. The Skill's two halves: what we ask, and what we
 * are willing to accept back.
 *
 * **The prompt contract is (Spec + catalog).** Not "the Spec, and by the way
 * use nice components": the catalog of the *active* Adapter is written into the
 * prompt in full — every tag, every prop with its kind and its exact enum
 * values, every slot — because DS-R13 makes the catalog the single source of
 * truth for generation as much as for manual editing. Anything the model
 * invents outside it is caught later by `validate()`, but a prompt that never
 * showed the catalog would be inviting the invention.
 *
 * **The parse is strict, and its failure shape is load-bearing.** A response
 * that is markup, or that is not the exact JSON envelope, is an
 * `OperationError` — *never* a `CapabilityViolation`. The distinction is not
 * cosmetic: a `CapabilityViolation` says "the active Design System cannot do
 * this", which is a true statement about the user's DS and sends them to change
 * their request. A malformed answer says nothing about the DS at all — it is
 * the agent having a bad turn, which is retryable and about which the right
 * advice is "tentar de novo". Collapsing the two would make every flaky turn
 * look like a limitation of the Design System (spec.md, Edge Cases; design.md
 * §6).
 *
 * Nothing here talks to an agent — this file is pure, so both halves of the
 * contract are testable without a process. `createDesignSkill` (T6.2) is what
 * drives an `AgentSession` through them.
 */

import type { Command, ComponentCatalog, OperationError, ScreenNode } from './types'

/** One accepted turn: the Commands to apply, plus what the Skill wants to say. */
export interface SkillBatch {
  commands: Command[]
  /**
   * The Skill's own words for the turn. Carries DS-R11 AC-5: a request the
   * active DS cannot satisfy comes back as an *explanation* with zero
   * Commands, never as a partial application.
   */
  message: string
}

/** Every rejection this module can produce. `scope: 'agent'`, retryable — none of them is about the catalog. */
function agentError(message: string): OperationError {
  return { kind: 'operation', scope: 'agent', message, retryable: true }
}

const EMPTY_RESPONSE = 'O agente terminou o turno sem responder nada.'
const MARKUP_RESPONSE =
  'O agente respondeu com markup. O contrato da Skill é um único objeto JSON — nenhum HTML é aceito.'
const NOT_JSON = 'A resposta do agente não é JSON válido.'
const NOT_ENVELOPE = 'A resposta do agente não tem a forma { "commands": [...], "message": "..." }.'
const BAD_COMMAND = (index: number): string =>
  `O Command na posição ${index} não pertence ao vocabulário fechado do Design Studio.`

/** How one Component is described to the model: its slots, and each prop with its exact domain. */
function describeComponent(component: ComponentCatalog['components'][number]): string {
  const props = component.props.map((prop) => {
    const domain = prop.kind === 'enum' ? (prop.values ?? []).join(' | ') : prop.kind
    return `${prop.name}: ${domain}`
  })
  const slots = component.slots.map((slot) => (slot === '' ? '(default)' : slot)).join(', ')
  return `- ${component.tag}\n  slots: ${slots || '(none)'}\n  props: ${props.join('; ') || '(none)'}`
}

/**
 * The catalog, verbatim, as prompt text (DS-R13). Written out rather than
 * summarised: a summary is a second source of truth, and the enum values are
 * exactly the part a summary would drop.
 */
export function describeCatalog(catalog: ComponentCatalog): string {
  return [
    `Design System: ${catalog.dsId} ${catalog.version}`,
    'These are the ONLY Components that exist. Never emit a tag, a prop or a value outside this list.',
    ...catalog.components.map(describeComponent)
  ].join('\n')
}

/**
 * The response contract, stated to the model in the terms the parser actually
 * enforces — so a refusal is always something the prompt already forbade.
 */
export const RESPONSE_CONTRACT = [
  'Answer with ONE JSON object and nothing else. No prose, no markdown, no code fences, no HTML.',
  'Shape: {"commands": Command[], "message": string}',
  'Command is one of:',
  '  {"type":"AddComponent","parentId":string|null,"slot"?:string,"index":number,"node":ScreenNode}',
  '  {"type":"RemoveComponent","componentId":string}',
  '  {"type":"MoveComponent","componentId":string,"newParentId":string,"slot"?:string,"index":number}',
  '  {"type":"SetProp","componentId":string,"key":string,"value":string|number|boolean|null}',
  'ScreenNode is {"id":string,"tag":string,"props":object,"slot"?:string,"children":ScreenNode[]}.',
  'Every "id" must be unique within the Tela.',
  'If the request cannot be met with the Components above, return "commands": [] and explain the limitation in "message", in pt-BR. Never apply a partial change.'
].join('\n')

export interface GenerateInput {
  /** The UX Spec, verbatim — it is read-only to the Studio. */
  specText: string
  /** The Tela being generated, as the detector named it. */
  screenTitle: string
  catalog: ComponentCatalog
}

/**
 * DS-R2: the first Component tree of one Tela, from the Spec and the catalog
 * and nothing else.
 */
export function buildGeneratePrompt({ specText, screenTitle, catalog }: GenerateInput): string {
  return [
    `You are the Design System Skill of Hive's Design Studio. Compose the initial Component tree for the Tela "${screenTitle}".`,
    '',
    '<catalog>',
    describeCatalog(catalog),
    '</catalog>',
    '',
    '<ux-spec>',
    specText,
    '</ux-spec>',
    '',
    `Emit the Commands that build "${screenTitle}" from an empty Tela: one AddComponent per node, parents before children, parentId null for the first one.`,
    '',
    RESPONSE_CONTRACT
  ].join('\n')
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isProps(value: unknown): value is ScreenNode['props'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value).every(isScalar)
}

function isOptionalSlot(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isNode(value: unknown): value is ScreenNode {
  if (typeof value !== 'object' || value === null) return false
  const node = value as Record<string, unknown>
  return (
    typeof node.id === 'string' &&
    node.id.length > 0 &&
    typeof node.tag === 'string' &&
    node.tag.length > 0 &&
    isProps(node.props) &&
    isOptionalSlot(node.slot) &&
    Array.isArray(node.children) &&
    node.children.every(isNode)
  )
}

function isIndex(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** The closed vocabulary, checked by shape only — catalog membership is `validate()`'s job, not the parser's. */
const COMMAND_SHAPE: Record<string, (cmd: Record<string, unknown>) => boolean> = {
  AddComponent: (cmd) =>
    (typeof cmd.parentId === 'string' || cmd.parentId === null) &&
    isOptionalSlot(cmd.slot) &&
    isIndex(cmd.index) &&
    isNode(cmd.node),
  RemoveComponent: (cmd) => typeof cmd.componentId === 'string',
  MoveComponent: (cmd) =>
    typeof cmd.componentId === 'string' &&
    typeof cmd.newParentId === 'string' &&
    isOptionalSlot(cmd.slot) &&
    isIndex(cmd.index),
  SetProp: (cmd) =>
    typeof cmd.componentId === 'string' &&
    typeof cmd.key === 'string' &&
    (isScalar(cmd.value) || cmd.value === null)
}

function isCommand(value: unknown): value is Command {
  if (typeof value !== 'object' || value === null) return false
  const cmd = value as Record<string, unknown>
  const shape = typeof cmd.type === 'string' ? COMMAND_SHAPE[cmd.type] : undefined
  return shape !== undefined && shape(cmd)
}

/**
 * The strict parse (DS-R11 AC-2). Everything it refuses is an `OperationError`
 * with `retryable: true` — a bad turn, not a limitation of the Design System.
 */
export function parseSkillResponse(raw: string): SkillBatch | OperationError {
  const text = raw.trim()
  if (text.length === 0) return agentError(EMPTY_RESPONSE)
  // Markup is called out by name because it is the failure the contract
  // forbids most explicitly, and "not valid JSON" would send the user looking
  // for a typo in something that was never JSON to begin with.
  if (text.startsWith('<')) return agentError(MARKUP_RESPONSE)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return agentError(NOT_JSON)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return agentError(NOT_ENVELOPE)
  }
  const envelope = parsed as Record<string, unknown>
  if (!Array.isArray(envelope.commands)) return agentError(NOT_ENVELOPE)
  if (envelope.message !== undefined && typeof envelope.message !== 'string') {
    return agentError(NOT_ENVELOPE)
  }

  const commands: Command[] = []
  for (const [index, candidate] of envelope.commands.entries()) {
    if (!isCommand(candidate)) return agentError(BAD_COMMAND(index))
    commands.push(candidate)
  }
  return { commands, message: envelope.message ?? '' }
}
