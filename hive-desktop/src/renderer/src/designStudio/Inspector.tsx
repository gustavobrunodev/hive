import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '@hive/design-system'
import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import type {
  CapabilityViolation,
  CatalogProp,
  ComponentCatalog,
  ScreenDocument
} from './documentModel'
import { findNode } from './screenTree'

/**
 * Design Studio (M18) — T5.2. The selected Component's props (DS-R6 AC-1/AC-2).
 *
 * **Every control is chosen by the catalog, never by a hand-written table.**
 * The CEM says `variant` is a union of five literals, so `variant` is a Select
 * with exactly those five; it says `pill` is a boolean, so `pill` is a Switch.
 * That is what makes "each editable prop corresponds to a real prop of the
 * Component in the active DS" true *by construction* rather than by
 * maintenance — and it is why a prop absent from the catalog cannot appear
 * here even by accident: there is nothing to iterate but the catalog.
 *
 * **Grouped, with Avançado closed.** A `wa-button` has 25 attributes. Dumping
 * 25 into a flat list is what turns an inspector into a spreadsheet, so they
 * arrive as Aparência → Estado → Conteúdo → Avançado (design §3.6), and the
 * long tail starts collapsed. Empty groups are not rendered: an accordion of
 * headings with nothing behind them is worse than no accordion.
 *
 * **A refused value is shown where it was typed, and nothing is applied**
 * (T5.3, DS-R6 AC-4). `onChange` resolves to the `CapabilityViolation` main
 * sent back; it lands as the `Field`'s `error`, which is the same rendering the
 * Chat uses for the same fact (AD-10), and the control keeps showing the value
 * the document still has — because the document really was left alone.
 *
 * **Text debounces at 120 ms; enum and boolean do not** (R-6). A dropdown or a
 * switch produces one deliberate value per interaction, so waiting would only
 * add lag to a finished decision. A text field produces one per keystroke, and
 * a round trip per keystroke is what would make typing feel stuck.
 */

/** R-6: long enough to coalesce a burst of typing, short enough to feel live. */
export const TEXT_DEBOUNCE_MS = 120

/** The groups, in the order the design fixes them, with the copy for each. */
const GROUP_ORDER: CatalogProp['group'][] = ['appearance', 'state', 'content', 'advanced']

const GROUP_LABEL: Record<CatalogProp['group'], () => string> = {
  appearance: () => t('designStudio.inspectorGroupAppearance'),
  state: () => t('designStudio.inspectorGroupState'),
  content: () => t('designStudio.inspectorGroupContent'),
  advanced: () => t('designStudio.inspectorGroupAdvanced')
}

export type PropValue = string | number | boolean | null

export interface InspectorProps {
  catalog: ComponentCatalog | null
  document: ScreenDocument
  selectedComponentId: string | null
  /** Dispatches one `SetProp`. Resolves to the violation when it was refused. */
  onChange: (key: string, value: PropValue) => Promise<CapabilityViolation | null>
}

function asText(value: PropValue): string {
  return value === null || value === undefined ? '' : String(value)
}

/** An enum: exactly the catalog's values, dispatched the moment one is picked. */
function EnumControl({
  prop,
  value,
  onChange
}: {
  prop: CatalogProp
  value: PropValue
  onChange: (value: PropValue) => void
}): React.JSX.Element {
  return (
    <Select
      value={value === null || value === undefined ? undefined : String(value)}
      onValueChange={onChange}
    >
      <SelectTrigger aria-label={prop.name}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(prop.values ?? []).map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Text and numbers: the field shows the keystroke at once and the `SetProp`
 * follows 120 ms later, so a burst of typing is one edit rather than one per
 * character (R-6).
 *
 * The draft is reset from the document during render — React's documented way
 * of adjusting state to a prop — so an undo, a chat turn or a refused value all
 * put the field back to what the document actually holds.
 */
function TextControl({
  prop,
  value,
  onChange
}: {
  prop: CatalogProp
  value: PropValue
  onChange: (value: PropValue) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(() => asText(value))
  const [committed, setCommitted] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (value !== committed) {
    setCommitted(value)
    setDraft(asText(value))
  }

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    []
  )

  return (
    <Input
      type={prop.kind === 'number' ? 'number' : 'text'}
      aria-label={prop.name}
      value={draft}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        if (timer.current !== null) clearTimeout(timer.current)
        timer.current = setTimeout(
          () => onChange(prop.kind === 'number' ? Number(next) : next),
          TEXT_DEBOUNCE_MS
        )
      }}
    />
  )
}

/** One control, chosen by the prop's `kind` — the whole of DS-R6 AC-2. */
function PropControl({
  prop,
  value,
  onChange
}: {
  prop: CatalogProp
  value: PropValue
  onChange: (value: PropValue) => void
}): React.JSX.Element {
  if (prop.kind === 'enum') return <EnumControl prop={prop} value={value} onChange={onChange} />
  if (prop.kind === 'boolean') {
    return <Switch checked={value === true} onCheckedChange={onChange} aria-label={prop.name} />
  }
  return <TextControl prop={prop} value={value} onChange={onChange} />
}

function PropField({
  prop,
  value,
  error,
  onChange
}: {
  prop: CatalogProp
  value: PropValue
  error?: string
  onChange: (key: string, value: PropValue) => void
}): React.JSX.Element {
  return (
    <Field label={prop.name} error={error} className="wb-dstudio-prop">
      <PropControl prop={prop} value={value} onChange={(next) => onChange(prop.name, next)} />
    </Field>
  )
}

export function Inspector({
  catalog,
  document,
  selectedComponentId,
  onChange
}: InspectorProps): React.JSX.Element | null {
  // One reason per prop. Keyed rather than singular because a refusal on
  // `variant` must not wipe the one still explaining what went wrong on `size`.
  const [violations, setViolations] = useState<Record<string, string>>({})
  const node = findNode(document.root, selectedComponentId)
  const component = catalog?.components.find((candidate) => candidate.tag === node?.tag)
  if (!node || !component) return null

  const change = (key: string, value: PropValue): void => {
    void onChange(key, value).then((violation) =>
      setViolations((current) => {
        const rest = Object.fromEntries(Object.entries(current).filter(([name]) => name !== key))
        return violation ? { ...rest, [key]: violation.reason } : rest
      })
    )
  }

  const groups = GROUP_ORDER.map((group) => ({
    group,
    fields: component.props.filter((prop) => prop.group === group)
  })).filter((entry) => entry.fields.length > 0)

  return (
    <div className="wb-dstudio-inspector">
      <p className="wb-dstudio-inspector-tag">{node.tag}</p>
      <Accordion
        type="multiple"
        // Everything but Avançado starts open: the long tail is the only part
        // whose cost of being visible outweighs the cost of one more click.
        defaultValue={groups.map((entry) => entry.group).filter((group) => group !== 'advanced')}
      >
        {groups.map(({ group, fields }) => (
          <AccordionItem key={group} value={group}>
            <AccordionTrigger>{GROUP_LABEL[group]()}</AccordionTrigger>
            <AccordionContent>
              {fields.map((prop) => (
                <PropField
                  key={prop.name}
                  prop={prop}
                  value={node.props[prop.name] ?? null}
                  error={violations[prop.name]}
                  onChange={change}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
