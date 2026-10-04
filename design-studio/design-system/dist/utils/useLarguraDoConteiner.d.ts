import { type RefObject } from "react";
/**
 * Largura do contêiner, medida com ResizeObserver. Com `fixa`, usa ela e não mede.
 * Sem ResizeObserver (ou antes da primeira medida) devolve `padrao`.
 */
export declare function useLarguraDoConteiner(ref: RefObject<HTMLElement | null>, fixa?: number, padrao?: number): number;
