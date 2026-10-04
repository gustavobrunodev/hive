import React from "react";
import type { NomeDoIcone } from "../../icones/icones";
import "./Segmentado.css";
export type OpcaoSegmentada<T extends string> = {
    valor: T;
    rotulo: string;
    icone?: NomeDoIcone;
    /** Mostra só o ícone; o rótulo fica para leitor de tela e dica. */
    soIcone?: boolean;
};
export type SegmentadoProps<T extends string> = {
    opcoes: readonly OpcaoSegmentada<T>[];
    valor: T;
    aoMudar: (valor: T) => void;
    /** Nome acessível do grupo ("Período", "Tema"). Obrigatório. */
    rotulo: string;
    /** `padrao` (trilho de 12px), `pill` (tema claro/escuro, só ícones) ou `compacto` (escolhas curtas do painel do modo ao vivo). */
    forma?: "padrao" | "pill" | "compacto";
    className?: string;
};
/** Escolha curta e exclusiva: um botão `aria-pressed` por opção. */
export declare function Segmentado<T extends string>({ opcoes, valor, aoMudar, rotulo, forma, className }: SegmentadoProps<T>): React.JSX.Element;
