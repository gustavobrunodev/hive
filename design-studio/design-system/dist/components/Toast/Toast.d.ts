import React from "react";
import type { NomeDoIcone } from "../../icones/icones";
import "./Toast.css";
export type ToastProps = {
    /** O que acabou de acontecer ("Elemento inserido · Ponto de restauração criado"). */
    children: React.ReactNode;
    /** Padrão `ok`; use `info` ou `alerta` quando não for confirmação. */
    icone?: NomeDoIcone;
    /** Esmaece antes de sair. */
    saindo?: boolean;
    className?: string;
};
/** Aviso curto e invertido que confirma o que acabou de acontecer. */
export declare function Toast({ children, icone, saindo, className }: ToastProps): React.JSX.Element;
