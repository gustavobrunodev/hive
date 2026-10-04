import React from "react";
import "./Inserir.css";
export type MiraDeInsercaoProps = {
    /** "Inserir depois do bloco “Beneficiário”". */
    rotulo: string;
    /** Posição e largura em px, no contêiner posicionado da tela. */
    topo: number;
    esquerda: number;
    largura: number;
    className?: string;
};
/** A linha laranja que mostra onde o elemento novo vai entrar. Decorativa: o painel diz o alvo. */
export declare function MiraDeInsercao({ rotulo, topo, esquerda, largura, className }: MiraDeInsercaoProps): React.JSX.Element;
export type VagaDeInsercaoProps = {
    /** Altura mínima: `p` 56px, `m` 96px, `g` 160px. */
    tamanho?: "p" | "m" | "g";
    /** Um brilho varre a vaga enquanto o agente gera. */
    gerando?: boolean;
    /** O texto da vaga ("Gerando Variante 2 de 3…"). */
    children?: React.ReactNode;
    className?: string;
};
/** O espaço reservado na tela para o elemento novo. */
export declare function VagaDeInsercao({ tamanho, gerando, children, className }: VagaDeInsercaoProps): React.JSX.Element;
export type PreviaDeInsercaoProps = {
    /** A Variante em teste: conteúdo do Protótipo. */
    children: React.ReactNode;
    className?: string;
};
/** O contorno tracejado em volta da Variante em teste, até ser aceita ou descartada. */
export declare function PreviaDeInsercao({ children, className }: PreviaDeInsercaoProps): React.JSX.Element;
