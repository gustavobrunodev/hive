import { t } from '../../i18n'
import { fonteName } from '../model'
import { FonteTile } from '../parts'
import { formatNumber, type DorVisivel } from '../relatorioModel'
import { opcaoId } from './useArroba'

export interface ListaDoArrobaProps {
  id: string
  produto: string
  dores: readonly DorVisivel[]
  /** The Produto has no Relatório yet: the list says so instead of "no match". */
  semRelatorio: boolean
  destaque: number
  onDestacar: (index: number) => void
  onEscolher: (dor: DorVisivel) => void
  /** What a Dor's volume counts, by Fonte (`menções`, `ligações`…). */
  unidade: (dor: DorVisivel) => string
}

/**
 * The `@` list (criterion 6, `composer.js` "Dores de <Produto>"): up to nine
 * Dores of the Produto, docked above the field. The field keeps the focus and
 * drives it with the arrows; a pointer picks on `mousedown`, so the field
 * never blurs first and loses its caret.
 */
export function ListaDoArroba({
  id,
  produto,
  dores,
  semRelatorio,
  destaque,
  onDestacar,
  onEscolher,
  unidade
}: ListaDoArrobaProps): React.JSX.Element {
  return (
    <div className="wb-slash-menu wb-mention-menu ds-arroba" role="presentation">
      <div className="wb-slash-menu-head wb-mention-menu-head">
        <span>{t('designStudio.campo.doresDe', produto)}</span>
      </div>
      {dores.length === 0 ? (
        <p className="wb-slash-empty ds-arroba-vazio" role="status">
          {semRelatorio
            ? t('designStudio.campo.arrobaVazio', produto)
            : t('designStudio.campo.arrobaNenhuma')}
        </p>
      ) : (
        <div
          id={id}
          className="ds-arroba-lista"
          role="listbox"
          aria-label={t('designStudio.campo.doresDe', produto)}
        >
          {dores.map((visivel, index) => (
            <button
              key={`${visivel.relatorio.caminho}#${visivel.dor.id}`}
              id={opcaoId(id, index)}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={index === destaque}
              className="ds-arroba-item"
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => onDestacar(index)}
              onClick={() => onEscolher(visivel)}
            >
              <FonteTile fonte={visivel.relatorio.fonte} size="sm" />
              <span className="ds-arroba-texto">
                <b>{visivel.dor.titulo}</b>
                <small>
                  {t(
                    'designStudio.campo.dorMeta',
                    fonteName(visivel.relatorio.fonte),
                    t(
                      'designStudio.nota.volume',
                      formatNumber(visivel.dor.volume),
                      unidade(visivel)
                    )
                  )}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
