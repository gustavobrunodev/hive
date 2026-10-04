import React from "react";
import type { NomeDoIcone } from "../../icones/icones";
import "./ChipDeFonte.css";
export type Fonte = "likert" | "voz" | "fullstory";
export declare const FONTES: Record<Fonte, {
    nome: string;
    icone: NomeDoIcone;
}>;
export type ChipDeFonteProps = {
    fonte: Fonte;
    /** `p` (24px), `m` (36px) ou `g` (52px). */
    tamanho?: "p" | "m" | "g";
    /** Anuncia o nome da Fonte; desligado quando o nome está escrito ao lado. */
    anunciar?: boolean;
    className?: string;
};
/** O quadradinho com o ícone da Fonte, na cor dela. */
export declare function ChipDeFonte({ fonte, tamanho, anunciar, className }: ChipDeFonteProps): React.JSX.Element;
export type ChipDeDorProps = {
    fonte: Fonte;
    /** O título da Dor; corta com reticências. */
    titulo: string;
    /** Mostra o botão de remover a citação. */
    aoRemover?: () => void;
    /** Nome acessível do botão de remover. Padrão "Tirar a citação". */
    rotuloRemover?: string;
    className?: string;
};
/** A Dor citada: pill branco com o chip da Fonte e o título. */
export declare function ChipDeDor({ fonte, titulo, aoRemover, rotuloRemover, className }: ChipDeDorProps): React.JSX.Element;
