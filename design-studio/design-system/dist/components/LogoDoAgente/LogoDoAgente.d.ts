import React from "react";
import { type Agente } from "../../marcas/marcas";
import "./LogoDoAgente.css";
export type LogoDoAgenteProps = {
    agente: Agente;
    /** `normal` (24px, mensagens e seletores), `pequeno` (20px, autoria do insight) ou `grande` (40px, Configurações). */
    tamanho?: "normal" | "pequeno" | "grande";
    /** Anuncia o nome do agente para leitor de tela. Desligado quando o nome já está escrito ao lado. */
    anunciar?: boolean;
    className?: string;
};
/** A logo oficial do agente num ladrilho neutro. */
export declare function LogoDoAgente({ agente, tamanho, anunciar, className }: LogoDoAgenteProps): React.JSX.Element;
