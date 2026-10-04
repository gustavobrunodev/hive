import React from "react";
import { type NomeDoIcone } from "../../icones/icones";
import "./Icone.css";
export type IconeProps = {
    /** Qual ícone do conjunto. */
    nome: NomeDoIcone;
    /** Lado em px quando o ícone aparece sozinho. Dentro dos componentes, o CSS de cada um define o tamanho. Padrão 18. */
    tamanho?: number;
    /** Texto para leitor de tela. Sem ele o ícone é decorativo (`aria-hidden`). */
    rotulo?: string;
    className?: string;
};
/** Um ícone de traço do estúdio. Segue a cor do texto (`currentColor`). */
export declare function Icone({ nome, tamanho, rotulo, className }: IconeProps): React.JSX.Element;
