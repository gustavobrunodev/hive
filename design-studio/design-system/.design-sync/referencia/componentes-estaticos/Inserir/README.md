# Inserir

As marcas do estúdio que o Inserir desenha sobre a tela: a mira entre blocos, a vaga reservada e o contorno da prévia.

## Use
- **Mira** (`mira-ins`): linha `acento` de 2px na largura do bloco, ponto `acento` de 14px com halo em `superficie` e pílula invertida em `toast` ("Inserir depois do bloco …"). Segue o ponteiro; cursor `copy` sobre a tela.
- **Vaga** (`ins-vaga tam-p | tam-m | tam-g`): contorno tracejado `acento`, fundo laranja a 6%, texto `acento-tinta`, canto `raio`; altura mínima de 56, 96 ou 160px. Com `gerando`, um brilho a varre em 1.1s e o `CursorDoAgente` vai até ela.
- **Prévia** (`ins-previa`): contorno tracejado `acento` afastado 4px em volta da Variante em teste, até ser aceita ou descartada.

Traços e afastamentos são divididos por `--z`, como os rótulos do canvas. A vaga e a prévia vivem dentro da tela, por isso as regras pedem um ancestral `pt`. A tela é sempre clara, nos dois temas: dentro de `aparelho-tela` e `janela-tela`, `acento-tinta` volta ao valor do tema claro para o texto da vaga manter o contraste.

## O consumidor fornece
A posição da mira (topo e largura do bloco), o texto do alvo, o tamanho da vaga e o elemento novo dentro da prévia. Esse elemento é conteúdo do Protótipo e veste o design system do cliente.

## Não
Laranja aqui é seleção do estúdio, nunca parte do elemento inserido.
