import React from "react";
import { type Agente } from "../../marcas/marcas";
import "./MensagemDoAgente.css";
export type MensagemDoAgenteProps = {
    agente: Agente;
    /** Padrão: o nome do agente ("Claude", "Devin"). */
    nome?: string;
    /** O modelo em chip ("Sonnet"). */
    modelo?: string;
    hora: string;
    /** O texto da resposta; parágrafos ficam a 10px um do outro. */
    children: React.ReactNode;
    /** O que foi aplicado, em pill laranja ("Aviso inserido · Variante 2"). */
    carimbo?: string;
    /** Uma linha por coisa que o agente fez e conferiu. */
    acoes?: string[];
    /** "Aviso inserido": o Ponto de restauração criado por esta resposta. */
    pontoDeRestauracao?: string;
    /** Torna o Ponto de restauração clicável. */
    aoAbrirPonto?: () => void;
    className?: string;
};
/** A resposta do agente na conversa: quem é, o que fez e o registro do que mudou. */
export declare function MensagemDoAgente({ agente, nome, modelo, hora, children, carimbo, acoes, pontoDeRestauracao, aoAbrirPonto, className, }: MensagemDoAgenteProps): React.JSX.Element;
