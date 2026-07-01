import * as React from "react";

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

export declare const HarnessMark: React.ComponentType<HarnessMarkProps>;
export default HarnessMark;
