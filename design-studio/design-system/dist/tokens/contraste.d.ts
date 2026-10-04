import { type Tema } from "./tokens";
/** Razão de contraste WCAG 2 entre duas cores hex. */
export declare function razaoDeContraste(a: string, b: string): number;
/** O valor de um token de cor num tema; o escuro herda o claro quando não muda. */
export declare function corNoTema(nome: string, tema: Tema): string;
