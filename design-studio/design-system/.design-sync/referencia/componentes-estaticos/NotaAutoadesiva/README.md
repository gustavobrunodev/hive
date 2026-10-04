# NotaAutoadesiva

A Dor colada no quadro como papel: a cor diz a Fonte, o rodapé diz o tamanho e o impacto.

## Use
- **`nota nota-likert | nota-voz | nota-fullstory`**: fundo da Fonte, texto `nota-tinta`, canto `raio-nota` (3px), `sombra-nota`.
- **Giro**: cada nota recebe `--r` entre -1.8deg e 1.8deg; no hover se endireita e sobe 3px.
- **Marcada** (`aria-pressed="true"`): contorno `acento` de 2.5px e selo de confirmação laranja no canto.
- **No canvas** (`notas-canvas`): título em `nota-grande` (24px), ao lado do frame que resolve, ligada a ele por conector tracejado.

## Anatomia
Chip da Fonte, título em `nota` (até 3 linhas) e rodapé com volume, `nota-imp` translúcida (ponto colorido + nível) e tendência.

## O consumidor fornece
A Dor: Fonte, título, volume, impacto, tendência. O `title` leva a frase completa do cliente.

## Não
Não use a cor da Fonte em outra coisa. Não gire mais que 1.8deg.
