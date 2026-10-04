import React from "react";
import type { NomeDoIcone } from "../../icones/icones";
import type { Agente } from "../../marcas/marcas";
import "./Seletor.css";
export type SeletorProps = {
    /** O valor atual ("Novo Protótipo", "Claude"). */
    valor: string;
    /** Complemento em `tinta-3` depois do valor ("· Câmbio", "Sonnet"). */
    complemento?: string;
    /** Ícone à esquerda. Ignorado quando há `agente`. */
    icone?: NomeDoIcone;
    /** Mostra a logo do agente no lugar do ícone. */
    agente?: Agente;
    /** Estado do menu que o seletor abre. */
    aberto?: boolean;
    className?: string;
} & Omit<React.ComponentPropsWithoutRef<"button">, "className" | "children" | "type">;
/** Pill de 34px que abre um menu de escolha: agente e modelo, Protótipo. Repassa a ref. */
export declare const Seletor: React.ForwardRefExoticComponent<{
    /** O valor atual ("Novo Protótipo", "Claude"). */
    valor: string;
    /** Complemento em `tinta-3` depois do valor ("· Câmbio", "Sonnet"). */
    complemento?: string;
    /** Ícone à esquerda. Ignorado quando há `agente`. */
    icone?: NomeDoIcone;
    /** Mostra a logo do agente no lugar do ícone. */
    agente?: Agente;
    /** Estado do menu que o seletor abre. */
    aberto?: boolean;
    className?: string;
} & Omit<Omit<React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, "ref">, "className" | "children" | "type"> & React.RefAttributes<HTMLButtonElement>>;
