# GraficoDeLinha

Recorrência semana a semana de uma série: a Dor filtrada ou a categoria em foco.

## Use
Traço de 2px em `graf-enfase`, pontos com halo de `superficie`, área em `graf-area` sob a série, grade horizontal de 1px em `borda`, linha de base em `borda-forte`, rótulo final com o último valor. Rótulos do eixo com passo adaptado à largura para não colidir. Mira vertical em `tinta-3` e dica flutuante (`elevada`, canto `raio`, `sombra-2`) que segue o ponteiro; com foco no gráfico, setas, Home e End percorrem as semanas.

## O consumidor fornece
As semanas com valor, o nome da série no subtítulo e a participação no total para a dica. Desenhe o SVG na largura real do contêiner.

## Não
Nunca eixo duplo: duas medidas viram dois gráficos.
