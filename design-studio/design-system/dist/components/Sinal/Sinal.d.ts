import React from "react";
import "./Sinal.css";
export type SinalProps = {
    /** Lado em px. Padrão 30, o tamanho da lateral. */
    tamanho?: number;
    /** Texto para leitor de tela; sem ele o sinal é decorativo. */
    rotulo?: string;
    className?: string;
};
/** O sinal do Design Studio. As cores seguem o tema (`acento` e `sobre-acento`). */
export declare function Sinal({ tamanho, rotulo, className }: SinalProps): React.JSX.Element;
export type MarcaProps = {
    /** Vira link quando recebe `href`. */
    href?: string;
    /** Mostra só o sinal (lateral recolhida); o nome continua para leitor de tela. */
    soSinal?: boolean;
    className?: string;
};
/** O sinal ao lado de "Design Studio" em Bricolage 700. */
export declare function Marca({ href, soSinal, className }: MarcaProps): React.JSX.Element;
