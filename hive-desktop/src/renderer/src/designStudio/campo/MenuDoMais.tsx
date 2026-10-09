import { useEffect, useRef, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@hive/design-system'
import { t } from '../../i18n'
import { ArrowLeftIcon, ClipboardIcon, PaperclipIcon, PlusIcon } from '../../ui/icons'
import { DorIcon, RelatorioIcon } from '../icons'
import { fonteName } from '../model'
import { FonteTile } from '../parts'
import { capitalize, type RelatorioDeFonte } from '../relatorioModel'

export interface MenuDoMaisProps {
  produto: string
  /** The Produto's Relatórios in use — what "Anexar um Relatório de Fonte" lists (criterion 8). */
  relatorios: readonly RelatorioDeFonte[]
  onArquivos: () => void
  onColar: () => void
  onCitar: () => void
  onRelatorio: (relatorio: RelatorioDeFonte) => void
  /** After a row was chosen: the caret goes back to the field. */
  onCloseFocus: () => void
}

/**
 * The field's `+` (`composer.js`, "Adicionar ao pedido"): files, a pasted
 * print, a Dor, a Relatório. "Anexar um Relatório de Fonte" turns the same
 * menu into the list of the Produto's Relatórios rather than opening a second
 * one, so the keyboard never leaves the menu it is in.
 *
 * Not modal, like the Hive's own `+`: a modal menu hides the whole app — the
 * field this choice is about included — from assistive tech.
 */
export function MenuDoMais({
  produto,
  relatorios,
  onArquivos,
  onColar,
  onCitar,
  onRelatorio,
  onCloseFocus
}: MenuDoMaisProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [vista, setVista] = useState<'raiz' | 'relatorios'>('raiz')
  const conteudo = useRef<HTMLDivElement>(null)
  const escolheu = useRef(false)
  const commit = (run: () => void) => (): void => {
    escolheu.current = true
    run()
  }

  // The rows changed under the keyboard: focus goes to the first of the new ones.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() =>
      conteudo.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    )
    return () => cancelAnimationFrame(frame)
  }, [vista, open])

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        if (next) {
          escolheu.current = false
          setVista('raiz')
        }
        setOpen(next)
      }}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="wb-attach-btn wb-add-context-btn ds-campo-mais"
          aria-label={t('designStudio.campo.mais')}
          title={t('designStudio.campo.mais')}
        >
          <PlusIcon size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={conteudo}
        align="start"
        side="top"
        sideOffset={8}
        className="wb-add-context-menu ds-campo-menu"
        onCloseAutoFocus={(event) => {
          if (!escolheu.current) return
          event.preventDefault()
          onCloseFocus()
        }}
      >
        {vista === 'raiz' ? (
          <>
            <DropdownMenuLabel>{t('designStudio.campo.menuTitulo')}</DropdownMenuLabel>
            <DropdownMenuItem
              icon={<PaperclipIcon size={16} />}
              description={t('designStudio.campo.anexarArquivosNota')}
              textValue={t('designStudio.campo.anexarArquivos')}
              onSelect={() => {
                // The native picker takes the focus; nothing to hand back here.
                onArquivos()
              }}
            >
              {t('designStudio.campo.anexarArquivos')}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<ClipboardIcon size={16} />}
              description={t('designStudio.campo.colarPrintNota')}
              textValue={t('designStudio.campo.colarPrint')}
              onSelect={commit(onColar)}
            >
              {t('designStudio.campo.colarPrint')}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<DorIcon size={16} />}
              description={t('designStudio.campo.citarDorNota')}
              textValue={t('designStudio.campo.citarDor')}
              onSelect={commit(onCitar)}
            >
              {t('designStudio.campo.citarDor')}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<RelatorioIcon size={16} />}
              description={t('designStudio.campo.anexarRelatorioNota')}
              textValue={t('designStudio.campo.anexarRelatorio')}
              onSelect={(event) => {
                event.preventDefault()
                setVista('relatorios')
              }}
            >
              {t('designStudio.campo.anexarRelatorio')}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel>{t('designStudio.campo.relatoriosTitulo')}</DropdownMenuLabel>
            {relatorios.length === 0 ? (
              <DropdownMenuItem disabled>
                {t('designStudio.campo.arrobaVazio', produto)}
              </DropdownMenuItem>
            ) : (
              relatorios.map((relatorio) => (
                <DropdownMenuItem
                  key={relatorio.caminho}
                  icon={<FonteTile fonte={relatorio.fonte} size="sm" />}
                  description={capitalize(relatorio.destaque)}
                  textValue={t(
                    'designStudio.campo.relatorioItem',
                    fonteName(relatorio.fonte),
                    relatorio.produto
                  )}
                  onSelect={commit(() => onRelatorio(relatorio))}
                >
                  {t(
                    'designStudio.campo.relatorioItem',
                    fonteName(relatorio.fonte),
                    relatorio.produto
                  )}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuItem
              icon={<ArrowLeftIcon size={16} />}
              onSelect={(event) => {
                event.preventDefault()
                setVista('raiz')
              }}
            >
              {t('designStudio.campo.voltar')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
