import React from "react";
import { type Fonte } from "../ChipDeFonte/ChipDeFonte";
import { type DirecaoDaTendencia, type NivelDeImpacto } from "../Pilula/Pilula";
import "./NotaAutoadesiva.css";
export type NotaAutoadesivaProps = {
    fonte: Fonte;
    /** O título da Dor, até 3 linhas. */
    titulo: string;
    /** "1.284 ligações", "412 menções", "2.140 clientes". */
    volume?: string;
    impacto?: NivelDeImpacto;
    tendencia?: {
        direcao: DirecaoDaTendencia;
        valor?: string;
    };
    /** Giro em graus, entre -1.8 e 1.8 (valores fora são limitados). */
    giro?: number;
    /** Com `aoClicar` a nota vira botão alternável; `marcada` diz se está escolhida. */
    marcada?: boolean;
    aoClicar?: () => void;
    /** A frase completa do cliente, na dica. */
    descricao?: string;
    /** `grande` é a nota colada no canvas ao lado do frame. */
    tamanho?: "normal" | "grande";
    className?: string;
};
/** A Dor colada no quadro como papel: a cor diz a Fonte, o rodapé diz o tamanho e o impacto. */
export declare function NotaAutoadesiva({ fonte, titulo, volume, impacto, tendencia, giro, marcada, aoClicar, descricao, tamanho, className, }: NotaAutoadesivaProps): React.JSX.Element;
