import React from "react";
import "./Painel.css";
export type PainelProps = {
    /** Título do cabeçalho (h2 por padrão). */
    titulo?: React.ReactNode;
    subtitulo?: React.ReactNode;
    /** Ação à direita do cabeçalho ("Ver tabela"). */
    acao?: React.ReactNode;
    /** Elemento do painel. `figure` para gráficos. */
    como?: "section" | "figure" | "div";
    /** Id do título, para `aria-labelledby` do painel. */
    idDoTitulo?: string;
    className?: string;
    children: React.ReactNode;
};
/** A superfície de página: `superficie`, borda `borda`, canto `raio-l`, `sombra-1`. */
export declare function Painel({ titulo, subtitulo, acao, como, idDoTitulo, className, children }: PainelProps): React.JSX.Element;
