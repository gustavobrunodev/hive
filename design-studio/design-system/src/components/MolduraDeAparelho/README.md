O frame onde cada tela do Protótipo vive no canvas: rótulo acima, aparelho de 390×780 (ou janela de 1040×680) e a tela dentro.

## Use
- **Rótulo**: Geist 500 em `tinta-3`, o nome da tela em 600 `tinta-2`; "· em foco" em `acento-tinta`. Tamanho e espaço divididos por `--z` (o zoom do canvas, piso 0.42), para ler igual em qualquer zoom.
- **Aparelho**: corpo `aparelho`, canto `raio-aparelho`, padding 11px, `sombra-aparelho`; tela de canto 34px com ilha no topo.
- **`estado="criando"`**: a tela mostra o esqueleto (barras em `superficie-3` com brilho) e o frame fica `aria-busy`.
- **`estado="na-fila"`**: o frame esmaece e o rótulo diz "na fila".
- **`realce`**: pulsa uma vez um anel `acento` de 4px que se afasta 26px em 0.9s; com movimento reduzido fica um anel fixo.

## O consumidor fornece
O `nome`, o estado e o conteúdo da tela. O conteúdo é o Protótipo do cliente e usa o design system do cliente, não estes tokens. A tela é sempre clara: dentro dela `acento-tinta` volta ao valor do tema claro, para as marcas do modo ao vivo manterem o contraste.

## Não
Faixas presas no topo da tela (barra de status, cabeçalho) não encolhem nem deixam fresta: o conteúdo rolado nunca vaza por uma linha.
