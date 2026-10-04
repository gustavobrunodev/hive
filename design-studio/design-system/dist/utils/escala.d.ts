/** Escala "bonita" com uns 4 passos (1, 2, 2.5, 5 ou 10 × 10^k) até cobrir o máximo. */
export declare function escalaBonita(maximo: number): {
    passo: number;
    topo: number;
};
/** De quantos em quantos rótulos do eixo x mostrar para cada um ter ~52px. */
export declare function passoDosRotulos(quantidade: number, larguraUtil: number): number;
