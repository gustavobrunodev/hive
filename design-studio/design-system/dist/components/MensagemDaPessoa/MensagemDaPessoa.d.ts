import React from "react";
import type { NomeDoIcone } from "../../icones/icones";
import { type Fonte } from "../ChipDeFonte/ChipDeFonte";
import "./MensagemDaPessoa.css";
export type MensagemDaPessoaProps = {
    hora: string;
    /** De onde veio ("Atalho", "Ponto de inserção no canvas"), antes da hora. */
    origem?: string;
    /** O texto do balão. Ignorado quando há `selecao`. */
    children?: React.ReactNode;
    /** Uma seleção feita no canvas no lugar do texto. */
    selecao?: {
        elemento: string;
        pedido?: string;
        icone?: NomeDoIcone;
    };
    /** Dores citadas, abaixo do balão. */
    citacoes?: {
        fonte: Fonte;
        titulo: string;
    }[];
    className?: string;
};
/** O que a pessoa disse ou fez: balão de texto ou seleção no canvas. */
export declare function MensagemDaPessoa({ hora, origem, children, selecao, citacoes, className }: MensagemDaPessoaProps): React.JSX.Element;
