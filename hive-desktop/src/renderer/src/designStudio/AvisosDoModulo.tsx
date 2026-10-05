import { Toast, ToastProvider, ToastViewport } from '@hive/design-system'
import { t } from '../i18n'
import { AlertTriangleIcon, CheckCircleIcon, CloseIcon } from '../ui/icons'
import type { Aviso, GeracaoStore } from './useGeracao'

/**
 * The module's notices (criteria 13, 15, 16): "pronto", why a generation
 * failed — with "Tentar de novo" — and "wait for the one in progress".
 * A success goes away on its own; a failure stays until dismissed, because the
 * person has a decision to make about it.
 */
export function AvisosDoModulo({ geracao }: { geracao: GeracaoStore }): React.JSX.Element {
  return (
    <ToastProvider swipeDirection="right">
      {geracao.avisos.map((aviso) => (
        <AvisoToast key={aviso.id} aviso={aviso} geracao={geracao} />
      ))}
      <ToastViewport className="ds-avisos" label={t('designStudio.geracao.avisos')} />
    </ToastProvider>
  )
}

function AvisoToast({
  aviso,
  geracao
}: {
  aviso: Aviso
  geracao: GeracaoStore
}): React.JSX.Element {
  const falha = aviso.tipo === 'falha'
  return (
    <Toast
      className="ds-aviso"
      data-tipo={aviso.tipo}
      duration={falha ? Infinity : 6000}
      onOpenChange={(open) => {
        if (!open) geracao.dispensar(aviso.id)
      }}
    >
      <span className="ds-aviso-glifo" aria-hidden="true">
        {falha ? <AlertTriangleIcon size={15} /> : <CheckCircleIcon size={15} />}
      </span>
      <span className="ds-aviso-texto">{aviso.texto}</span>
      {aviso.repetir && (
        <button
          type="button"
          className="ds-aviso-acao"
          onClick={() => {
            const { produto, fonte } = aviso.repetir as NonNullable<Aviso['repetir']>
            geracao.dispensar(aviso.id)
            geracao.pedir(produto, fonte)
          }}
        >
          {t('designStudio.geracao.tentarDeNovo')}
        </button>
      )}
      <button
        type="button"
        className="ds-icon-btn"
        aria-label={t('designStudio.geracao.dispensar')}
        onClick={() => geracao.dispensar(aviso.id)}
      >
        <CloseIcon size={13} />
      </button>
    </Toast>
  )
}
