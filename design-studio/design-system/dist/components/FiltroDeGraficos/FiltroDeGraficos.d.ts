import React from "react";
import "./FiltroDeGraficos.css";
export type GrupoDeDores = {
    rotulo: string;
    dores: {
        id: string;
        titulo: string;
    }[];
};
export type FiltroDeGraficosProps = {
    periodos: readonly {
        valor: string;
        rotulo: string;
    }[];
    periodo: string;
    aoMudarPeriodo: (periodo: string) => void;
    /** Dores agrupadas por categoria (viram `optgroup`). */
    grupos: GrupoDeDores[];
    /** Id da Dor filtrada ou `"todas"`. */
    dor: string;
    aoMudarDor: (dor: string) => void;
    /** Mostra "Limpar filtro" quando há uma Dor filtrada. */
    aoLimpar?: () => void;
    className?: string;
};
/** A linha de filtros acima dos Gráficos do Relatório: período e Dor. */
export declare function FiltroDeGraficos({ periodos, periodo, aoMudarPeriodo, grupos, dor, aoMudarDor, aoLimpar, className }: FiltroDeGraficosProps): React.JSX.Element;
