import {
  Button,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@hive/design-system'
import { useState } from 'react'
import { t } from '../i18n'
import type {
  CapabilityViolation,
  Command,
  ComponentCatalog,
  ScreenDocument
} from './documentModel'
import { addCommand, addTargetFor, componentTags, slotOptionsFor } from './treeEdits'

/**
 * Design Studio (M18) — T5.5. Adding a Component to the Tela (DS-R7 AC-1/AC-4).
 *
 * **The picker is the catalog.** Its options are `catalog.components` mapped to
 * their tags — there is no list of tags anywhere in this module to fall out of
 * date, which is what makes "adicionar exige escolher entre os Componentes do
 * Adaptador ativo" true by construction rather than by review. Swap the active
 * DS (DS-R12) and this picker changes with it, untouched.
 *
 * **The slot picker is the parent's declared slots**, the default one included
 * under its own name so the user is never asked to know that `''` means
 * "default". A parent that declares none still offers the add — and main
 * refuses it as a `CapabilityViolation` that says which slots exist. That is
 * deliberate: the refusal teaches, whereas a control greyed out with no
 * explanation only puzzles.
 *
 * **A refusal lands here, next to the choice that caused it** (§6), and the
 * picker stays open with the choice intact, because the user's next move is to
 * change one field, not to start over.
 */

export interface AddComponentProps {
  /** `null` while the catalog is still loading — there is nothing to pick from yet. */
  catalog: ComponentCatalog | null
  document: ScreenDocument
  selectedComponentId: string | null
  /** Dispatches the `AddComponent`. Resolves to the violation when it was refused. */
  onAdd: (command: Command) => Promise<CapabilityViolation | null>
}

/** The tag to add: exactly the catalog's Components. */
function TagField({
  tags,
  tag,
  onChange
}: {
  tags: string[]
  tag: string | null
  onChange: (tag: string) => void
}): React.JSX.Element {
  return (
    <Field label={t('designStudio.treeAddTagLabel')} className="wb-dstudio-add-field">
      <Select value={tag ?? undefined} onValueChange={onChange}>
        <SelectTrigger aria-label={t('designStudio.treeAddTagLabel')}>
          <SelectValue placeholder={t('designStudio.treeAddTagPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {tags.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/** The slot to land in: exactly the slots the parent declares (DS-R7 AC-4). */
function SlotField({
  slots,
  slot,
  onChange
}: {
  slots: string[]
  slot: string
  onChange: (slot: string) => void
}): React.JSX.Element {
  return (
    <Field label={t('designStudio.treeAddSlotLabel')} className="wb-dstudio-add-field">
      <Select value={slot} onValueChange={onChange}>
        <SelectTrigger aria-label={t('designStudio.treeAddSlotLabel')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {slots.map((option) => (
            <SelectItem key={option} value={option}>
              {option === '' ? t('designStudio.treeAddSlotDefault') : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function AddComponent({
  catalog,
  document,
  selectedComponentId,
  onAdd
}: AddComponentProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [tag, setTag] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [violation, setViolation] = useState<string | null>(null)

  const tags = componentTags(catalog)
  if (tags.length === 0) return null

  const target = addTargetFor(document, selectedComponentId)
  const slots = slotOptionsFor(catalog, target.parentTag)
  // Self-correcting rather than reset by an effect: a slot that the current
  // parent does not declare simply stops being the chosen one.
  const chosen = slot !== null && slots.includes(slot) ? slot : (slots[0] ?? '')

  const submit = (): void => {
    if (tag === null) return
    void onAdd(addCommand(target, tag, chosen)).then((refusal) => {
      setViolation(refusal?.reason ?? null)
      if (refusal === null) setOpen(false)
    })
  }

  if (!open) {
    return (
      <div className="wb-dstudio-add">
        <Button
          variant="ghost"
          onClick={() => {
            setViolation(null)
            setOpen(true)
          }}
        >
          {t('designStudio.treeAddLabel')}
        </Button>
      </div>
    )
  }

  return (
    <div className="wb-dstudio-add" role="group" aria-label={t('designStudio.treeAddLabel')}>
      <p className="wb-dstudio-add-target">
        {target.parentTag === null
          ? t('designStudio.treeAddAsRoot')
          : t('designStudio.treeAddInto', target.parentTag)}
      </p>
      <TagField tags={tags} tag={tag} onChange={setTag} />
      {slots.length > 0 && <SlotField slots={slots} slot={chosen} onChange={setSlot} />}
      {violation !== null && (
        <p className="wb-dstudio-add-error" role="alert">
          {violation}
        </p>
      )}
      <div className="wb-dstudio-add-actions">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t('designStudio.treeAddCancel')}
        </Button>
        <Button onClick={submit} disabled={tag === null}>
          {t('designStudio.treeAddConfirm')}
        </Button>
      </div>
    </div>
  )
}
