export type Tema = "claro" | "escuro";
export interface TokenDeCor {
    nome: string;
    claro: string;
    /** Ausente quando o valor é o mesmo nos dois temas. */
    escuro?: string;
    uso: string;
}
export interface TokenDeSombra {
    nome: string;
    claro: string;
    escuro: string;
    uso: string;
}
export interface TokenSimples {
    nome: string;
    valor: string;
    uso: string;
}
export declare const cores: readonly TokenDeCor[];
export declare const sombras: readonly TokenDeSombra[];
export declare const raios: readonly TokenSimples[];
export declare const espacos: readonly TokenSimples[];
export declare const layout: readonly TokenSimples[];
export interface ArquivoDeFonte {
    familia: string;
    /** Caminho relativo a src/. */
    arquivo: string;
    peso: string;
}
export declare const arquivosDeFonte: readonly ArquivoDeFonte[];
/** Pilhas de fonte. No CSS viram --f-ui e --f-titulo. */
export declare const familias: {
    readonly ui: "'Geist', 'Segoe UI', system-ui, -apple-system, sans-serif";
    readonly titulo: "'Bricolage Grotesque', 'Geist', 'Segoe UI', system-ui, sans-serif";
};
export interface EstiloDeTexto {
    nome: string;
    familia: keyof typeof familias;
    tamanho: string;
    alturaDeLinha: number;
    peso: number;
    espacamento?: string;
    tamanhoOptico?: number;
    amostra: string;
    uso: string;
}
export declare const estilosDeTexto: readonly EstiloDeTexto[];
/** A curva de toda transição do app; o cursor do agente usa a mesma em 0.62s. */
export declare const curva = "cubic-bezier(0.16, 1, 0.3, 1)";
/**
 * Pares de texto (e marcas) que o sistema promete, com o mínimo WCAG de cada um.
 * src/tokens/tokens.test.ts cobra todos nos dois temas.
 */
export interface ParDeContraste {
    frente: string;
    fundo: string;
    minimo: number;
    onde: string;
}
export declare const paresDeContraste: readonly ParDeContraste[];
/**
 * Pares reais do app que ficam abaixo do ideal, com o valor medido. O teste
 * confere que continuam assim: se alguém corrigir, o teste pede para tirar
 * a exceção daqui e das notas dos tokens.
 */
export interface ExcecaoDeContraste {
    frente: string;
    fundo: string;
    tema: Tema;
    medido: number;
    motivo: string;
}
export declare const excecoesDeContraste: readonly ExcecaoDeContraste[];
