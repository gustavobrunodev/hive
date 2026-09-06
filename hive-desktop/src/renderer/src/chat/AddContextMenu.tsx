import React, { useRef, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Kbd
} from '@hive/design-system'
import { ComputerUploadIcon, FolderFilesIcon, PlusIcon } from '../ui/icons'
import { t } from '../i18n'

export interface AddContextMenuProps {
  /**
   * The native picker is an agent capability, not a universal one. When the
   * running agent can't take file paths, that row is *gone* rather than
   * disabled: a permanently dead row in a two-row menu is a worse answer than
   * a menu that only offers what works here.
   */
  canUpload: boolean
  /** Types `@` at the caret and opens the workspace picker inline. */
  onMention: () => void
  /** Opens the OS file picker (the old paperclip's whole behaviour). */
  onUpload: () => void
  /** Called after the menu closes, to put the caret back where the typing happens. */
  onCloseFocus: () => void
}

/**
 * The composer's "add context" affordance.
 *
 * It replaced a paperclip that did one thing and named a second one badly.
 * There were always two ways to give the agent a file — a path from the
 * workspace (`@`, cheap, what the user wants nine times out of ten) and a file
 * from the disk — and only one of them had a button. The paperclip was that
 * button, so the cheap route was reachable only by knowing a sigil, and the
 * expensive one looked like the whole feature.
 *
 * So: one `+`, the universal "add" glyph, opening a menu that names the two
 * sources and lets the user pick. Three things it does deliberately.
 *
 *  - **The rows differ by source, not by verb.** "Arquivos do workspace" and
 *    "Arquivos do computador" are the actual decision; a pair of verbs
 *    ("Referenciar" / "Enviar") would make the reader translate them back into
 *    sources before choosing. The second line then says what each one is *for*.
 *  - **The `@` hint is on the row, not in a tooltip.** The menu is where a user
 *    who doesn't know the shortcut ends up, which makes it the one place the
 *    shortcut is worth teaching. Clicking the row does exactly what typing `@`
 *    does, so the hint is a promise the next keystroke keeps.
 *  - **The `+` turns into an `×` while open.** The trigger is also the way out,
 *    and rotating the same strokes 45° says so without adding a second control.
 */
export function AddContextMenu({
  canUpload,
  onMention,
  onUpload,
  onCloseFocus
}: AddContextMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  // Where focus goes when the menu closes depends on WHY it closed, and the two
  // answers are opposite. Committing a row means the user got what they came
  // for and is about to keep typing, so focus follows the context into the
  // composer. Escaping means "never mind" — and a cancel that moves the caret
  // somewhere the user never asked for loses their place in the toolbar they
  // were tabbing through. That one gets the platform behaviour: back to the
  // control they opened.
  const committedRef = useRef(false)
  const commit = (run: () => void) => (): void => {
    committedRef.current = true
    run()
  }
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        if (next) committedRef.current = false
        setOpen(next)
      }}
      // Not modal. A modal menu marks the whole app `aria-hidden` and locks the
      // page scroll for a two-row list docked to a text field — it hides the
      // very composer the choice is about from assistive tech, and the
      // scroll-lock is the same `react-remove-scroll` seam the engine picker
      // already paid for.
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="wb-attach-btn wb-add-context-btn"
          aria-label={t('chat.addContextLabel')}
          title={t('chat.addContextTitle')}
        >
          <PlusIcon size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="wb-add-context-menu"
        onCloseAutoFocus={(event) => {
          if (!committedRef.current) return
          event.preventDefault()
          onCloseFocus()
        }}
      >
        <DropdownMenuLabel>{t('chat.addContextMenuLabel')}</DropdownMenuLabel>
        <DropdownMenuItem
          icon={<FolderFilesIcon size={16} />}
          description={t('chat.addContextMentionDesc')}
          shortcut={<Kbd>@</Kbd>}
          textValue={t('chat.addContextMention')}
          onSelect={commit(onMention)}
        >
          {t('chat.addContextMention')}
        </DropdownMenuItem>
        {canUpload && (
          <DropdownMenuItem
            icon={<ComputerUploadIcon size={16} />}
            description={t('chat.addContextUploadDesc')}
            textValue={t('chat.addContextUpload')}
            onSelect={commit(onUpload)}
          >
            {t('chat.addContextUpload')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
