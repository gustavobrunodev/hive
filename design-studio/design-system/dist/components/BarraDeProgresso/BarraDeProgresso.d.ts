import React from "react";
import "./BarraDeProgresso.css";
export type BarraDeProgressoProps = {
    /** De 0 a 1; valores fora são limitados. */
    valor: number;
    /** Nome acessível ("Progresso das Variantes"). */
    rotulo: string;
    className?: string;
};
/** Barra de 6px em `superficie-3` com o progresso em `acento`. */
export declare function BarraDeProgresso({ valor, rotulo, className }: BarraDeProgressoProps): React.JSX.Element;
