As marcas do estúdio que o Inserir desenha sobre a tela: a mira entre blocos, a vaga reservada e o contorno da prévia.

## Use
- **`MiraDeInsercao`**: linha `acento` de 2px na largura do bloco, ponto `acento` de 14px com halo em `superficie` e pílula invertida em `toast` ("Inserir depois do bloco …"). Segue o ponteiro; use cursor `copy` sobre a tela.
- **`VagaDeInsercao`**: contorno tracejado `acento`, fundo laranja a 6%, texto `acento-tinta`, canto `raio`; altura mínima de 56, 96 ou 160px (`p`, `m`, `g`). Com `gerando`, um brilho a varre em 1.1s e o `CursorDoAgente` vai até ela. É um `status`: o texto é anunciado.
- **`PreviaDeInsercao`**: contorno tracejado `acento` afastado 4px em volta da Variante em teste.

Traços e afastamentos são divididos por `--z`, como os rótulos do canvas. Dentro da `MolduraDeAparelho`, `acento-tinta` volta ao valor do tema claro, porque a tela é sempre clara.

## O consumidor fornece
A posição da mira (topo, esquerda e largura do bloco), o texto do alvo, o tamanho da vaga e o elemento novo dentro da prévia. Esse elemento é conteúdo do Protótipo e veste o design system do cliente.

## Não
O laranja aqui é seleção do estúdio, nunca parte do elemento inserido.
