import React from "react";
import { type Agente } from "../../marcas/marcas";
import { type Fonte } from "../ChipDeFonte/ChipDeFonte";
import "./Insight.css";
export type InsightProps = {
    /** A categoria ("Cotação e taxas"). */
    titulo: string;
    /** Os números grandes do lado: parcela, tendência, recorrência. */
    numeros: {
        rotulo: string;
        valor: string;
    }[];
    agente: Agente;
    nomeDoAgente?: string;
    /** A leitura do agente. */
    children: React.ReactNode;
    /** O próximo passo sugerido, em negrito no começo. */
    proximoPasso?: string;
    dores?: {
        fonte: Fonte;
        titulo: string;
    }[];
    /** Botões do pé ("Resolver esta Dor", "Perguntar ao agente"). */
    acoes?: React.ReactNode;
    /** A categoria em foco nos gráficos ganha `acento-suave`. */
    foco?: boolean;
    className?: string;
};
/** A leitura do agente sobre uma categoria de Dor. */
export declare function Insight({ titulo, numeros, agente, nomeDoAgente, children, proximoPasso, dores, acoes, foco, className }: InsightProps): React.JSX.Element;
export type PainelDeInsightsProps = {
    titulo?: string;
    subtitulo?: string;
    children: React.ReactNode;
    className?: string;
};
/** O painel inteiro com um `Insight` por categoria. */
export declare function PainelDeInsights({ titulo, subtitulo, children, className }: PainelDeInsightsProps): React.JSX.Element;
