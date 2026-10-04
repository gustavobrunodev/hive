As barras que flutuam sobre o canvas: a pill com as ferramentas do modo ao vivo na base e as ações no topo.

## Use
- **`BarraFlutuante`**: pill em `elevada`, borda `borda`, `sombra-2`, canto `raio-painel`, padding 4px. É uma `toolbar` nomeada; setas esquerda e direita andam entre os botões.
- **`Ferramenta`**: 34px em `tinta-2`. Com `pressionada` vira alternância (`aria-pressed`) e, quando ativa, fica invertida (fundo `tinta`, texto `superficie`). `destaque` é o único item laranja ("Testar").
- **`SeparadorDeFerramenta`**: divisória de 1px entre grupos.

Na base do canvas: Mover, Comentar, Editar, Inserir, Ajustar, Testar e zoom, centrados a 18px do fundo. No topo, a 14px das bordas: `AbasDeProposta`, celular/desktop, Apresentar e Compartilhar.

## O consumidor fornece
O `rotulo` da barra, cada ferramenta com ícone, rótulo e estado, e a posição da barra no canvas.

## Não
Nenhuma outra ferramenta ganha laranja. Com pouco espaço use `soIcone`; o rótulo continua como dica e nome acessível.
