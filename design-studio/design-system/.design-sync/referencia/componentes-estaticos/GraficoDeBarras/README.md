# GraficoDeBarras

Volume por categoria de Dor, em forma de ênfase: uma categoria em laranja, as outras em cinza.

## Use
Rótulo à esquerda (36%, mínimo 120px), barra de 20px com no máximo 74% do trilho (o rótulo de valor nunca é cortado), valor e participação em `tinta-2` tabular. A categoria em foco usa `graf-enfase` e peso 600; as outras, `graf-contexto`. Com um filtro de Dor, a barra em foco se parte: a Dor em `graf-enfase`, o resto em `graf-enfase-lavada`. Só a ponta do dado é arredondada (4px). Cada linha é um botão: tocar troca a ênfase.

## O consumidor fornece
As categorias com volume, participação e número de Dores, e qual está em foco. "Ver tabela" troca o desenho pela tabela gêmea (0.875rem, números à direita).

## Não
Nunca uma cor por categoria. Um só eixo.
