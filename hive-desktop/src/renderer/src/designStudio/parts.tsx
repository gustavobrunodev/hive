import { SegmentedControl, SourceNote } from '@hive/design-system'
import { t } from '../i18n'
import { CheckIcon } from '../ui/icons'
import { FonteIcon } from './icons'
import { fonteName, type FonteId } from './model'
import { formatNumber, impactWord, trendText, type Catalogo, type Dor } from './relatorioModel'

/**
 * Design Studio — the small pieces several pages draw the same way: the
 * Produto picker, a Fonte's tile, a Dor as a note, and a generation's steps.
 */

/** The Produto picker (Câmbio, Extrato, Pix), as the DS segmented control. */
export function ProdutoPicker({
  catalogo,
  value,
  onChange
}: {
  catalogo: Catalogo
  value: string
  onChange: (produto: string) => void
}): React.JSX.Element {
  return (
    <SegmentedControl
      ariaLabel={t('designStudio.produto.label')}
      size="md"
      value={value}
      onChange={onChange}
      options={catalogo.produtos.map((produto) => ({ id: produto.nome, label: produto.nome }))}
    />
  )
}

/** A Fonte's tile: its glyph on its own fill, in its own ink. */
export function FonteTile({
  fonte,
  size = 'md'
}: {
  fonte: FonteId
  size?: 'sm' | 'md' | 'lg'
}): React.JSX.Element {
  const glyph = { sm: 13, md: 16, lg: 22 }[size]
  return (
    <span className="ds-fonte-tile" data-fonte={fonte} data-size={size} aria-hidden="true">
      <FonteIcon fonte={fonte} size={glyph} />
    </span>
  )
}

/** A Dor as the DS note, in its Fonte's colour (criterion 18). */
export function DorNote({
  dor,
  fonte,
  unidade,
  tilt,
  pressed,
  onActivate
}: {
  dor: Dor
  fonte: FonteId
  unidade: string
  tilt?: number
  pressed?: boolean
  onActivate: (element: HTMLElement) => void
}): React.JSX.Element {
  return (
    <SourceNote
      fonte={fonte}
      title={dor.titulo}
      volume={t('designStudio.nota.volume', formatNumber(dor.volume), unidade)}
      icon={<FonteIcon fonte={fonte} size={13} />}
      impact={dor.impacto}
      impactLabel={impactWord(dor.impacto)}
      impactPrefix={t('designStudio.nota.impacto')}
      trend={dor.tendencia}
      trendLabel={trendText(dor.tendencia)}
      tilt={tilt}
      pressed={pressed}
      onClick={(event) => onActivate(event.currentTarget)}
    />
  )
}

/**
 * A generation's four steps (criterion 12): the current one carries
 * `aria-current="step"`, the ones before it a ✓, the ones after neither. The
 * list sits in a `status` region, so each step is announced as it starts.
 */
export function GeracaoPassos({
  fonte,
  passo,
  volume,
  unidade
}: {
  fonte: FonteId
  passo: number
  volume: number | null
  unidade: string
}): React.JSX.Element {
  const passos = [
    volume === null
      ? t('designStudio.geracao.lendoSemVolume')
      : t('designStudio.geracao.lendo', formatNumber(volume), unidade),
    t('designStudio.geracao.agrupando'),
    t('designStudio.geracao.ranqueando'),
    t('designStudio.geracao.escrevendo')
  ]
  return (
    <div className="ds-passos" role="status">
      <p className="ds-passos-titulo">{t('designStudio.geracao.passosLabel', fonteName(fonte))}</p>
      <ol className="ds-passos-lista">
        {passos.map((texto, index) => {
          const n = index + 1
          const estado = n < passo ? 'feito' : n === passo ? 'atual' : 'depois'
          return (
            <li
              key={texto}
              className="ds-passo"
              data-estado={estado}
              aria-current={estado === 'atual' ? 'step' : undefined}
            >
              <span className="ds-passo-marca" aria-hidden="true">
                {estado === 'feito' && <CheckIcon size={12} className="ds-passo-check" />}
              </span>
              <span>{texto}</span>
              {estado === 'feito' && (
                <span className="ds-sr">{t('designStudio.geracao.concluido')}</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
