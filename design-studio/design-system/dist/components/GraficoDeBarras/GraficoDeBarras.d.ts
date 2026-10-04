import React from "react";
import "./GraficoDeBarras.css";
export type CategoriaDoGrafico = {
    id: string;
    nome: string;
    volume: number;
    dores?: number;
};
export type GraficoDeBarrasProps = {
    categorias: CategoriaDoGrafico[];
    /** A categoria em ênfase (laranja); as outras ficam em cinza de contexto. */
    emFoco?: string;
    /** Volume de uma Dor filtrada dentro da categoria em foco: a barra se parte. */
    recorte?: {
        volume: number;
        rotulo: string;
    };
    /** Torna cada linha um botão que troca a ênfase. */
    aoFocar?: (id: string) => void;
    titulo?: string;
    subtitulo?: string;
    /** O que o volume conta, no cabeçalho da tabela ("Ligações", "Menções"). */
    unidade?: string;
    className?: string;
};
/** Volume por categoria de Dor, em forma de ênfase, com tabela gêmea. */
export declare function GraficoDeBarras({ categorias, emFoco, recorte, aoFocar, titulo, subtitulo, unidade, className, }: GraficoDeBarrasProps): React.JSX.Element;
