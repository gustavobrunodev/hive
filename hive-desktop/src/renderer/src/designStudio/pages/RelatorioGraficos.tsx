import { useId, useState } from 'react'
import { BarChart, Button, LineChart, SegmentedControl } from '@hive/design-system'
import { t } from '../../i18n'
import { agentIcon } from '../../ui/agentVisuals'
import { useDesignData } from '../moduleData'
import {
  insightsOrder,
  pct,
  PERIODOS,
  recorteOf,
  type CategoriaNaJanela,
  type Dias,
  type Recorte
} from '../graficosModel'
import { formatNumber, trendSigned, weekLabel, type RelatorioDeFonte } from '../relatorioModel'

/** The agent's id for its logo, from the name the Relatório records (`geradoPor.agente`). */
function agentIdOf(nome: string): string | null {
  const lower = nome.toLowerCase()
  if (lower.includes('devin')) return 'devin'
  if (lower.includes('claude')) return 'claude-cli'
  return null
}

/** % change over the window, the last half against the first. */
function windowTrend(semanas: readonly number[]): number {
  const half = Math.floor(semanas.length / 2)
  const antes = semanas.slice(0, half).reduce((a, b) => a + b, 0)
  const depois = semanas.slice(semanas.length - half).reduce((a, b) => a + b, 0)
  return antes > 0 ? Math.round((depois / antes - 1) * 100) : 0
}

/**
 * P12 — the Relatório as charts (criteria 27–30): the period and Dor filters,
 * a one-paragraph summary, the bars by category beside the week-by-week line
 * of the category in emphasis, and the agent's insight for every category.
 */
export function RelatorioGraficos({
  relatorio
}: {
  relatorio: RelatorioDeFonte
}): React.JSX.Element {
  const dados = useDesignData()
  const [dias, setDias] = useState<Dias>(90)
  const [dorId, setDorId] = useState<string | null>(null)
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const recorte = recorteOf(relatorio, dias, dorId, categoriaId)
  const unidadeDor = dados.catalogo?.fontes.find((f) => f.id === relatorio.fonte)?.unidadeDor ?? ''
  const filtrado = dias !== 90 || dorId !== null
  return (
    <div className="ds-graficos">
      <div className="ds-graf-filtros" role="group" aria-label={t('designStudio.graficos.filtros')}>
        <SegmentedControl
          ariaLabel={t('designStudio.graficos.periodo')}
          size="md"
          value={String(dias)}
          onChange={(id) => setDias(Number(id) as Dias)}
          options={PERIODOS.map((periodo) => ({
            id: String(periodo.dias),
            label: t('designStudio.graficos.dias', periodo.dias)
          }))}
        />
        <label className="ds-graf-dor">
          <span>{t('designStudio.graficos.dor')}</span>
          <select
            value={dorId ?? ''}
            onChange={(event) => {
              setDorId(event.target.value === '' ? null : event.target.value)
              setCategoriaId(null)
            }}
          >
            <option value="">{t('designStudio.graficos.todas')}</option>
            {recorte.categorias.map((entry) => (
              <optgroup key={entry.categoria.id} label={entry.categoria.nome}>
                {entry.dores.map((dor) => (
                  <option key={dor.id} value={dor.id}>
                    {dor.titulo}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {filtrado && (
          <Button
            cut={false}
            variant="ghost"
            className="wb-btn wb-btn-sm ds-btn-sec"
            onClick={() => {
              setDias(90)
              setDorId(null)
              setCategoriaId(null)
            }}
          >
            {t('designStudio.graficos.limpar')}
          </Button>
        )}
      </div>
      <Resumo recorte={recorte} dias={dias} unidade={unidadeDor} />
      <div className="ds-graf-grade">
        <div className="ds-card ds-graf-card" data-chart="barras">
          <BarChart
            title={t('designStudio.graficos.barras')}
            description={t('designStudio.graficos.barrasDescricao', unidadeDor)}
            data={recorte.categorias.map((entry) => ({
              id: entry.categoria.id,
              label: entry.categoria.nome,
              value: entry.volume,
              valueLabel: formatNumber(entry.volume),
              shareLabel: t('designStudio.graficos.porcento', entry.participacao),
              part: recorte.dor && entry === recorte.enfase ? recorte.dorVolume : undefined,
              ariaLabel: t(
                'designStudio.graficos.barra',
                entry.categoria.nome,
                formatNumber(entry.volume),
                unidadeDor,
                entry.participacao
              )
            }))}
            emphasis={recorte.enfase?.categoria.id ?? null}
            onEmphasisChange={(id) => {
              setCategoriaId(id)
              setDorId(null)
            }}
            labels={{
              showTable: t('designStudio.graficos.verTabela'),
              showChart: t('designStudio.graficos.verGrafico'),
              category: t('designStudio.graficos.categoria'),
              value: unidadeDor.charAt(0).toUpperCase() + unidadeDor.slice(1),
              share: t('designStudio.graficos.participacao')
            }}
          />
        </div>
        <div className="ds-card ds-graf-card" data-chart="linha">
          <Linha relatorio={relatorio} recorte={recorte} unidade={unidadeDor} />
        </div>
      </div>
      <Insights relatorio={relatorio} recorte={recorte} />
    </div>
  )
}

function Resumo({
  recorte,
  dias,
  unidade
}: {
  recorte: Recorte
  dias: Dias
  unidade: string
}): React.JSX.Element | null {
  const enfase = recorte.enfase
  if (!enfase) return null
  const periodo = t('designStudio.graficos.dias', dias)
  return (
    <p className="ds-graf-resumo">
      {recorte.dor
        ? t(
            'designStudio.graficos.resumoDor',
            recorte.dor.titulo,
            formatNumber(recorte.dorVolume),
            unidade,
            periodo,
            pct(recorte.dorVolume, enfase.volume),
            enfase.categoria.nome
          )
        : t(
            'designStudio.graficos.resumo',
            periodo,
            formatNumber(recorte.total),
            unidade,
            recorte.categorias.length,
            enfase.categoria.nome,
            enfase.participacao
          )}
    </p>
  )
}

function Linha({
  relatorio,
  recorte,
  unidade
}: {
  relatorio: RelatorioDeFonte
  recorte: Recorte
  unidade: string
}): React.JSX.Element {
  const nome = recorte.dor?.titulo ?? recorte.enfase?.categoria.nome ?? ''
  const pontos = recorte.serie.map((value, i) => ({
    label: weekLabel(relatorio.periodo.fim, 13 - recorte.semanas + i),
    value,
    valueLabel: formatNumber(value)
  }))
  return (
    <LineChart
      title={t('designStudio.graficos.linha')}
      description={
        recorte.dor
          ? t('designStudio.graficos.linhaDor', recorte.dor.titulo)
          : t('designStudio.graficos.linhaCategoria', nome)
      }
      points={pontos}
      seriesLabel={nome}
      ariaLabel={t(
        'designStudio.graficos.linhaAria',
        nome,
        pontos[0]?.valueLabel ?? '0',
        pontos[pontos.length - 1]?.valueLabel ?? '0',
        unidade
      )}
      reading={(ponto) =>
        t('designStudio.graficos.leitura', ponto.label, ponto.valueLabel ?? String(ponto.value))
      }
      formatTick={formatNumber}
      labels={{
        showTable: t('designStudio.graficos.verTabela'),
        showChart: t('designStudio.graficos.verGrafico'),
        point: t('designStudio.graficos.semanaDe'),
        value: unidade.charAt(0).toUpperCase() + unidade.slice(1)
      }}
    />
  )
}

/** "Insights por categoria" (criterion 27): the agent's reading of each, the one in focus marked. */
function Insights({
  relatorio,
  recorte
}: {
  relatorio: RelatorioDeFonte
  recorte: Recorte
}): React.JSX.Element {
  const headingId = useId()
  const AgentLogo = agentIcon(agentIdOf(relatorio.geradoPor.agente))
  return (
    <section className="ds-card ds-insights" aria-labelledby={headingId}>
      <div className="ds-insights-cab">
        <h2 id={headingId} className="ds-insights-titulo">
          {t('designStudio.graficos.insights')}
        </h2>
        <p className="ds-insights-descricao">
          {t('designStudio.graficos.insightsDescricao', relatorio.geradoPor.agente)}
        </p>
      </div>
      {insightsOrder(recorte).map((entry: CategoriaNaJanela) => (
        <article
          key={entry.categoria.id}
          className="ds-insight"
          aria-current={entry === recorte.enfase ? 'true' : undefined}
        >
          <div className="ds-insight-lado">
            <h3>{entry.categoria.nome}</h3>
            <dl className="ds-insight-fig">
              <div>
                <dt>{t('designStudio.graficos.doVolume')}</dt>
                <dd>{t('designStudio.graficos.porcento', entry.participacao)}</dd>
              </div>
              <div>
                <dt>{t('designStudio.graficos.noPeriodo')}</dt>
                <dd>{trendSigned(windowTrend(entry.semanas))}</dd>
              </div>
            </dl>
          </div>
          <div className="ds-insight-corpo">
            <p className="ds-insight-autor">
              <span className="ds-insight-logo" aria-hidden="true">
                <AgentLogo size={14} />
              </span>
              <span>{relatorio.geradoPor.agente}</span>
            </p>
            <p>{entry.categoria.insight}</p>
          </div>
        </article>
      ))}
    </section>
  )
}
