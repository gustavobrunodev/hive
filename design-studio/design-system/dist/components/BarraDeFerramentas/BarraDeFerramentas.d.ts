import React from "react";
import type { NomeDoIcone } from "../../icones/icones";
import "./BarraDeFerramentas.css";
export type BarraFlutuanteProps = {
    /** Nome acessível da barra ("Ferramentas"). */
    rotulo: string;
    className?: string;
    children: React.ReactNode;
};
/** A pill flutuante do canvas (`role="toolbar"`). Setas esquerda e direita andam entre os botões. */
export declare function BarraFlutuante({ rotulo, className, children }: BarraFlutuanteProps): React.JSX.Element;
export type FerramentaProps = {
    icone: NomeDoIcone;
    rotulo: string;
    /** Estado de alternância (`aria-pressed`). Omita para botões de ação. */
    pressionada?: boolean;
    /** O único item laranja da barra ("Testar"). */
    destaque?: boolean;
    /** Mostra só o ícone; o rótulo vira dica e nome acessível. */
    soIcone?: boolean;
    className?: string;
} & Omit<React.ComponentPropsWithoutRef<"button">, "className" | "children" | "type">;
/** Um botão de 34px da barra flutuante. A pressionada fica invertida em `tinta`. */
export declare function Ferramenta({ icone, rotulo, pressionada, destaque, soIcone, className, ...resto }: FerramentaProps): React.JSX.Element;
/** Divisória vertical entre grupos de ferramentas. */
export declare function SeparadorDeFerramenta(): React.JSX.Element;
