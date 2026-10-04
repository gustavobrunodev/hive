import React from "react";
import "./AbasDeProposta.css";
export type Proposta = {
    id: string;
    /** "A · Status que avisa". */
    nome: string;
    /** `ativa` ganha o ponto laranja; `descartada` fica riscada. */
    estado?: "ativa" | "rascunho" | "descartada";
    /** Dica com o resumo da Proposta. */
    descricao?: string;
};
export type AbasDePropostaProps = {
    propostas: Proposta[];
    selecionada: string;
    aoSelecionar: (id: string) => void;
    /** Mostra o botão "Nova". */
    aoCriar?: () => void;
    className?: string;
};
/** As abas de Proposta no topo do canvas. Setas, Home e End trocam de aba. */
export declare function AbasDeProposta({ propostas, selecionada, aoSelecionar, aoCriar, className }: AbasDePropostaProps): React.JSX.Element;
