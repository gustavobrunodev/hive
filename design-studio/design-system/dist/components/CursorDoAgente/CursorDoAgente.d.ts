import React from "react";
import "./CursorDoAgente.css";
export type CursorDoAgenteProps = {
    /** O nome no rótulo ("Claude", "Devin"). */
    nome: string;
    /** Posição em px dentro do contêiner posicionado. */
    x?: number;
    y?: number;
    /** Some com transição quando `false`. Padrão `true`. */
    visivel?: boolean;
    className?: string;
};
/** A presença do agente no quadro: seta laranja com o nome. Decorativo para leitor de tela. */
export declare function CursorDoAgente({ nome, x, y, visivel, className }: CursorDoAgenteProps): React.JSX.Element;
