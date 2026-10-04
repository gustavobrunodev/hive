O painel de 300px do modo ao vivo, que nasce junto do elemento escolhido no canvas: serve ao Editar, ao Inserir e ao Ajustar.

## Use
Fundo `elevada`, borda `borda`, canto `raio-l`, `sombra-3`; entra em 0.18s. Largura `painel-vivo`.
- **Cabeçalho**: ícone da ferramenta, o alvo ("Depois do bloco “Beneficiário”") e a tela em `tinta-3`, fechar.
- **Corpo** (14px entre grupos): `LinhaDoPainel` com um `Segmentado` compacto à direita (Onde, Tamanho, Quantas Variantes); `Sugestoes` em grade de duas colunas (a marcada invertida em `tinta`); texto livre com borda de 1px e canto `raio-m`, foco em `acento`; `BarraDeProgresso` enquanto gera; `NavegacaoDeVariantes` no ciclo.
- **Rodapé**: botões pequenos que dividem a largura; a ação principal à direita.

## O consumidor fornece
O `rotulo` (nome acessível), o alvo e a tela, o conteúdo do corpo, os botões do rodapé e a posição do painel no canvas (`style`). O painel é um `dialog` não modal: o canvas continua usável.

## Não
No Inserir, Gerar fica desabilitado até haver pedido.
