import { useId } from 'react'
import { t } from '../../i18n'
import { useDesignData } from '../moduleData'
import {
  capitalize,
  formatNumber,
  impactWord,
  trendSigned,
  type RelatorioDeFonte
} from '../relatorioModel'

/**
 * P11 — the Relatório read as text (criterion 25): on the left, one card with
 * the highlight, the narrative and "Como foi feito." at its end; on the right,
 * the ranked Dores, each opening its folha.
 */
export function RelatorioLeitura({
  relatorio
}: {
  relatorio: RelatorioDeFonte
}): React.JSX.Element {
  const dados = useDesignData()
  const rankingId = useId()
  const unidadeDor = dados.catalogo?.fontes.find((f) => f.id === relatorio.fonte)?.unidadeDor ?? ''
  const dores = [...relatorio.dores].sort((a, b) => a.rank - b.rank)
  return (
    <div className="ds-leitura">
      <article className="ds-card ds-leitura-texto">
        <h2 className="ds-destaque">{capitalize(relatorio.destaque)}.</h2>
        <div className="ds-narrativa">
          {relatorio.narrativa.map((paragrafo) => (
            <p key={paragrafo}>{paragrafo}</p>
          ))}
        </div>
        <p className="ds-metodo">
          <b>{t('designStudio.relatorio.comoFoiFeito')}</b> {relatorio.metodo}
        </p>
      </article>
      <section className="ds-card ds-ranking" aria-labelledby={rankingId}>
        <h2 id={rankingId} className="ds-ranking-titulo">
          {t('designStudio.relatorio.doresRanqueadas')}
          <small>{t('designStudio.relatorio.doresRanqueadasN', dores.length)}</small>
        </h2>
        <ol className="ds-ranking-lista">
          {dores.map((dor) => (
            <li key={dor.id}>
              <button
                type="button"
                className="ds-rank-linha"
                aria-label={t('designStudio.relatorio.rankLinha', dor.rank, dor.titulo, [
                  t('designStudio.nota.volume', formatNumber(dor.volume), unidadeDor),
                  trendSigned(dor.tendencia),
                  ...(dor.tela ? [t('designStudio.relatorio.telaDor', dor.tela)] : []),
                  t('designStudio.relatorio.impactoLinha', impactWord(dor.impacto))
                ])}
                onClick={(event) =>
                  dados.folha.abrir(
                    { relatorio: relatorio.caminho, dor: dor.id },
                    event.currentTarget
                  )
                }
              >
                <span className="ds-rank-num">{dor.rank}</span>
                <span className="ds-rank-txt">
                  <b>{dor.titulo}</b>
                  <span className="ds-rank-meta">
                    <span>
                      {t('designStudio.nota.volume', formatNumber(dor.volume), unidadeDor)}
                    </span>
                    <span data-trend={Math.sign(dor.tendencia)}>{trendSigned(dor.tendencia)}</span>
                    {dor.tela && <span>{t('designStudio.relatorio.telaDor', dor.tela)}</span>}
                  </span>
                </span>
                <span className="ds-impacto" data-impacto={dor.impacto}>
                  {impactWord(dor.impacto)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
