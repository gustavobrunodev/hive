import { useEffect } from 'react'
import { Attachment } from '@hive/design-system'
import { t } from '../../i18n'
import { AttachmentTray } from '../../chat/AttachmentTray'
import type { AttachmentsApi } from '../../chat/useAttachments'
import { CloseIcon } from '../../ui/icons'
import { RelatorioIcon } from '../icons'
import type { ModuleData } from '../moduleData'
import { FonteTile } from '../parts'
import type { DorCitada } from '../relatorioModel'

/** The chip of a cited Dor in the field: its Fonte, its title, and the "×" that takes it out (criterion 6). */
function ChipDaCitacao({
  citacao,
  dados,
  onTirar
}: {
  citacao: DorCitada
  dados: ModuleData
  onTirar: () => void
}): React.JSX.Element | null {
  const relatorio = dados.relatorioEm(citacao.relatorio)
  const { carregar } = dados
  // A Dor of an older Relatório (cited from its Leitura) is read on demand.
  useEffect(() => {
    if (relatorio === undefined) carregar(citacao.relatorio)
  }, [relatorio, carregar, citacao.relatorio])
  const dor = relatorio?.dores.find((entry) => entry.id === citacao.dor)
  if (!relatorio || !dor) return null
  return (
    <span className="ds-chip-dor" data-fonte={relatorio.fonte}>
      <FonteTile fonte={relatorio.fonte} size="sm" />
      <span className="ds-chip-dor-titulo">{dor.titulo}</span>
      <button
        type="button"
        className="ds-chip-x"
        aria-label={t('designStudio.campo.tirarCitacao', dor.titulo)}
        onClick={onTirar}
      >
        <CloseIcon size={12} />
      </button>
    </span>
  )
}

/**
 * What the next message carries, above the text: the cited Dores, the
 * attached Relatórios ("Relatório de <Fonte> · <Produto>", criterion 8) and
 * the files (the Hive's own tray, criterion 7) — each one removable.
 */
export function ContextoDoCampo({
  citadas,
  relatorios,
  attachments,
  dados,
  onTirar,
  onTirarRelatorio
}: {
  citadas: readonly DorCitada[]
  relatorios: ReadonlyArray<{ caminho: string; nome: string }>
  attachments: AttachmentsApi
  dados: ModuleData
  onTirar: (citacao: DorCitada) => void
  onTirarRelatorio: (caminho: string) => void
}): React.JSX.Element {
  return (
    <div className="ds-campo-contexto" role="group" aria-label={t('designStudio.campo.citadas')}>
      {citadas.map((citacao) => (
        <ChipDaCitacao
          key={`${citacao.relatorio}#${citacao.dor}`}
          citacao={citacao}
          dados={dados}
          onTirar={() => onTirar(citacao)}
        />
      ))}
      {relatorios.map((relatorio) => (
        <Attachment
          key={relatorio.caminho}
          className="wb-composer-chip"
          name={relatorio.nome}
          icon={<RelatorioIcon size={14} />}
          onRemove={() => onTirarRelatorio(relatorio.caminho)}
          removeLabel={t('designStudio.campo.removerAnexo', relatorio.nome)}
        />
      ))}
      <AttachmentTray
        items={attachments.items}
        onRemove={attachments.removeAt}
        onClear={attachments.clear}
        restored={null}
      />
    </div>
  )
}
