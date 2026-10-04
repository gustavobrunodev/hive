import React from "react";
import "./SeloExemplo.css";
export type SeloExemploProps = {
    /** `pill` (cabeçalho, lateral recolhida, celular) ou `linha` (lateral aberta). */
    forma?: "pill" | "linha";
    /** Padrão "Dados de exemplo". */
    texto?: string;
    className?: string;
};
/** O selo que acompanha todo dado sintético. */
export declare function SeloExemplo({ forma, texto, className }: SeloExemploProps): React.JSX.Element;
