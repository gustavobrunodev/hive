# BarrasDoCanvas

As barras que flutuam sobre o canvas: Propostas e ações no topo, ferramentas na base.

## Use
- **Topo** (`canvas-topo`, a 14px das bordas): abas de Proposta (`propostas` com `prop-aba`; selecionada em `superficie-3` com peso 600, Proposta ativa com ponto `acento`, descartada riscada), Nova, celular/desktop, Apresentar e Compartilhar.
- **Base** (`ferramentas barra-flutua`, centrada a 18px do fundo): Mover, Comentar, Editar, Inserir, Ajustar, Testar e zoom.

Pill de canto `raio-painel` em `elevada`, borda `borda`, `sombra-2`, padding 4px. Ferramentas (`ferr`) de 34px em `tinta-2`; a ativa leva `aria-pressed="true"` e fica invertida (fundo `tinta`, texto `superficie`). "Testar" é o único item laranja.

## Não
Nenhuma outra ferramenta ganha laranja. Abaixo de 1180px os rótulos viram só ícone; o `title` e o `aria-label` ficam.
