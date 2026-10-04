Um ícone de traço do estúdio: grade de 24, traço de 1.75, pontas e junções arredondadas, sem preenchimento.

## Use
`<Icone nome="raio" />`. O ícone segue a cor do texto (`currentColor`): `tinta-2` na maior parte da interface, `acento-tinta` no item atual, `acento` dentro dos toasts. Tamanhos do app: 17px em botões, 18px na lateral, 13px em pílulas. Dentro dos componentes o CSS deles define o tamanho; `tamanho` vale para o ícone solto.

## O consumidor fornece
O `nome` (um dos 67 do conjunto, tipado como `NomeDoIcone`) e, se o ícone carrega sentido sozinho, um `rotulo` para leitor de tela.

## Não
Sem emoji no lugar de ícone. Não pinte o ícone com cor de Fonte ou de estado sem a palavra ao lado.
