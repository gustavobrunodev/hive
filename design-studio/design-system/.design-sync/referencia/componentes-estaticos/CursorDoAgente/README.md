# CursorDoAgente

A presença do agente no quadro: seta laranja com o nome do agente, que desliza até o que ele está criando.

## Use
Enquanto o agente trabalha: cria um frame, gera Variantes, insere um elemento. Some quando ele termina. Seta em `acento` com contorno branco; rótulo pill em `acento` com o nome em `sobre-acento`, 600 15px, canto inferior esquerdo de 4px apontando para a seta. Desliza em 0.62s com a curva do app.

## O consumidor fornece
O nome do agente (Claude ou Devin) e a posição (`transform: translate(x, y)`) sobre o elemento-alvo.

## Não
É decorativo para leitores de tela (`aria-hidden`): o que o agente faz é dito na conversa.
