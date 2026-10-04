import React from "react";
import type { NomeDoIcone } from "../../icones/icones";
import "./Pilula.css";
export type TomDaPilula = "alto" | "medio" | "baixo" | "ok" | "neutra";
export type PilulaProps = {
    tom: TomDaPilula;
    icone?: NomeDoIcone;
    className?: string;
    children: React.ReactNode;
};
/** Pílula de estado: Geist 600 0.75rem, canto `raio-pill`, sempre com palavra. */
export declare function Pilula({ tom, icone, className, children }: PilulaProps): React.JSX.Element;
export type NivelDeImpacto = "alto" | "medio" | "baixo";
export type PilulaDeImpactoProps = {
    nivel: NivelDeImpacto;
    /** Troca a palavra ("Impacto alto"). Padrão: Alto, Médio, Baixo. */
    rotulo?: string;
    className?: string;
};
/** O impacto de uma Dor em três níveis, com ícone e palavra. */
export declare function PilulaDeImpacto({ nivel, rotulo, className }: PilulaDeImpactoProps): React.JSX.Element;
export type DirecaoDaTendencia = "sobe" | "desce" | "igual";
export type TendenciaProps = {
    direcao: DirecaoDaTendencia;
    /** "22%"; ignorado quando a direção é `igual` (mostra "estável"). */
    valor?: string;
    /** Período de comparação, vira dica. Padrão "Comparado aos 90 dias anteriores". */
    comparacao?: string;
    className?: string;
};
/** A tendência de uma Dor: seta e porcentagem; alta em `critico-tinta`, queda em `ok-tinta`. */
export declare function Tendencia({ direcao, valor, comparacao, className }: TendenciaProps): React.JSX.Element;
