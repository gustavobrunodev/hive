# MolduraDeAparelho

O frame onde cada tela do Protótipo vive no canvas: rótulo acima, aparelho de 390×780 e a tela dentro.

## Use
- **`frame`** posicionado no mundo do canvas, a `entre-frames` (72px) do vizinho na mesma linha.
- **`frame-rotulo`** acima: Geist 500 em `tinta-3`, o nome da tela em 600 `tinta-2`; "· em foco" (`em-foco`) em `acento-tinta`. Tamanho e margem divididos por `--z` (piso 0.42) para ler igual em qualquer zoom.
- **`aparelho`**: corpo `aparelho`, canto `raio-aparelho`, padding 11px, `sombra-aparelho`; tela com canto de 34px e ilha no topo. Desktop usa `janela` (1040×680) com barra cinza.
- **Criando**: a tela mostra `esqueleto` (barras em `superficie-3` com brilho).
- **Acabou de mudar**: a classe `realce` pulsa uma vez um anel `acento` de 4px que se afasta 26px em 0.9s; com movimento reduzido, fica um anel fixo.

## O consumidor fornece
O nome da tela e o conteúdo da tela. O conteúdo é o Protótipo do cliente e usa o design system do cliente, não estes tokens.

## Não
Faixas presas no topo da tela (barra de status, cabeçalho) não encolhem e não deixam fresta: o conteúdo rolado nunca vaza por uma linha.
