import React from "react";
import "./GraficoDeLinha.css";
export type PontoDaSerie = {
    /** Início da semana ("1 jul"). */
    rotulo: string;
    valor: number;
    /** Total do Relatório na semana, para a participação na dica. */
    total?: number;
};
export type GraficoDeLinhaProps = {
    serie: PontoDaSerie[];
    /** O nome da série em ênfase ("Cotação e taxas"). */
    nomeDaSerie: string;
    titulo?: string;
    subtitulo?: string;
    /** O que o valor conta, no plural ("ligações"). */
    unidade?: string;
    /** Largura do desenho em px; sem ela o gráfico mede o contêiner. */
    largura?: number;
    className?: string;
};
/** Recorrência semana a semana de uma série, com mira, dica, teclado e tabela gêmea. */
export declare function GraficoDeLinha({ serie, nomeDaSerie, titulo, subtitulo, unidade, largura, className, }: GraficoDeLinhaProps): React.JSX.Element;
