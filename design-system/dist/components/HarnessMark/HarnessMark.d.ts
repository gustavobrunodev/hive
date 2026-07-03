import * as React from "react";
import "./HarnessMark.css";
/**
 * HarnessMark — marca do produto Harness Builder (iniciativa HIVE).
 *
 * Direção "colmeia afiada": herda o hexágono da marca-mãe HIVE, com o núcleo
 * em foco (o agente sob controle / o harness firme) e as células que se
 * dispersam ao topo (a evolução contínua do harness).
 *
 * Cores 100% da paleta HIVE: coral no traço, verde no núcleo. A versão
 * monocromática (tone="mono") usa uma cor só, passada em `color`.
 */
/**
 * HarnessMark — from @hive/design-system.
 * Marca do produto Harness Builder (direção "colmeia afiada").
 */
export interface HarnessMarkProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** Qual lockup renderizar. Default: "symbol". */
    variant?: "symbol" | "horizontal" | "stacked" | "wordmark" | "icon";
    /** "color" = coral + núcleo verde; "mono" = uma cor só (usa `color`). Default: "color". */
    tone?: "color" | "mono";
    /** Cor da versão monocromática. Default: currentColor. */
    color?: string;
    /** Tamanho do símbolo em px; escala o lockup inteiro. */
    size?: number;
    /** Cor de fundo do tile (só no variant "icon"). Default: var(--bordo-2). */
    background?: string;
    /** Mostra "Uma skill · HIVE". Default: true. */
    endorsement?: boolean;
}
export declare function HarnessMark({ variant, tone, color, size, background, endorsement, className, ...rest }: HarnessMarkProps): React.JSX.Element;
export default HarnessMark;
