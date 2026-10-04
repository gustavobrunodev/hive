import React from "react";
import type { NomeDoIcone } from "../../icones/icones";
import "./Botao.css";
type Ancora = React.ComponentPropsWithoutRef<"a">;
type BotaoNativo = React.ComponentPropsWithoutRef<"button">;
export type BotaoProps = {
    /** `primario` (laranja, a ação principal), `secundario` (superfície com borda) ou `terciario` (transparente). Padrão `primario`. */
    variante?: "primario" | "secundario" | "terciario";
    /** `pequeno` para rodapés de painel. */
    tamanho?: "normal" | "pequeno";
    /** Ícone antes do rótulo. */
    icone?: NomeDoIcone;
    /** Vira link (`<a>`) quando recebe `href`. */
    href?: string;
    className?: string;
    children?: React.ReactNode;
} & Omit<Ancora & BotaoNativo, "href" | "className" | "children" | "type"> & {
    type?: "button" | "submit" | "reset";
};
/** Botão do estúdio. Repassa a ref para o `<button>` ou `<a>`. */
export declare const Botao: React.ForwardRefExoticComponent<{
    /** `primario` (laranja, a ação principal), `secundario` (superfície com borda) ou `terciario` (transparente). Padrão `primario`. */
    variante?: "primario" | "secundario" | "terciario";
    /** `pequeno` para rodapés de painel. */
    tamanho?: "normal" | "pequeno";
    /** Ícone antes do rótulo. */
    icone?: NomeDoIcone;
    /** Vira link (`<a>`) quando recebe `href`. */
    href?: string;
    className?: string;
    children?: React.ReactNode;
} & Omit<Omit<React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>, "ref"> & Omit<React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, "ref">, "className" | "href" | "children" | "type"> & {
    type?: "button" | "submit" | "reset";
} & React.RefAttributes<HTMLAnchorElement | HTMLButtonElement>>;
export type BotaoIconeProps = {
    /** Nome acessível e dica do botão ("Fechar", "Recolher a barra lateral"). Obrigatório. */
    rotulo: string;
    icone: NomeDoIcone;
    className?: string;
} & Omit<BotaoNativo, "className" | "children" | "type">;
/** Botão só de ícone, 34px, transparente. */
export declare const BotaoIcone: React.ForwardRefExoticComponent<{
    /** Nome acessível e dica do botão ("Fechar", "Recolher a barra lateral"). Obrigatório. */
    rotulo: string;
    icone: NomeDoIcone;
    className?: string;
} & Omit<Omit<React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, "ref">, "className" | "children" | "type"> & React.RefAttributes<HTMLButtonElement>>;
export type BotaoEnviarProps = {
    /** Nome acessível. Padrão "Enviar". */
    rotulo?: string;
    className?: string;
} & Omit<BotaoNativo, "className" | "children">;
/** O círculo laranja de 38px que envia a mensagem do campo do chat. */
export declare function BotaoEnviar({ rotulo, className, type, ...resto }: BotaoEnviarProps): React.JSX.Element;
export {};
