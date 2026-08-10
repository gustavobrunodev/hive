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
import { t } from '../i18n'
import type { CatalogProp, ComponentCatalog, ScreenDocument } from './documentModel'
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
 */

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
  onChange: (key: string, value: PropValue) => void
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
  if (prop.kind === 'enum') {
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
  if (prop.kind === 'boolean') {
    return <Switch checked={value === true} onCheckedChange={onChange} aria-label={prop.name} />
  }
  return (
    <Input
      type={prop.kind === 'number' ? 'number' : 'text'}
      aria-label={prop.name}
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(event) =>
        onChange(prop.kind === 'number' ? Number(event.target.value) : event.target.value)
      }
    />
  )
}

function PropField({
  prop,
  value,
  onChange
}: {
  prop: CatalogProp
  value: PropValue
  onChange: (key: string, value: PropValue) => void
}): React.JSX.Element {
  return (
    <Field label={prop.name} className="wb-dstudio-prop">
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
  const node = findNode(document.root, selectedComponentId)
  const component = catalog?.components.find((candidate) => candidate.tag === node?.tag)
  if (!node || !component) return null

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
                  onChange={onChange}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
