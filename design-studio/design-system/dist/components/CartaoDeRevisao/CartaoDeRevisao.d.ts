import React from "react";
import "./CartaoDeRevisao.css";
export type Achado = {
    nivel: "resolvido" | "alto" | "medio" | "baixo";
    texto: string;
};
export type CartaoDeRevisaoProps = {
    /** "Revisão de usabilidade da Proposta A". */
    titulo: string;
    achados: Achado[];
    className?: string;
};
/** O cartão em que o agente devolve uma revisão: um achado por linha, com o nível à esquerda. */
export declare function CartaoDeRevisao({ titulo, achados, className }: CartaoDeRevisaoProps): React.JSX.Element;
