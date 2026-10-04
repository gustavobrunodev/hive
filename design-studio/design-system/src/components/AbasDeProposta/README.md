As abas de Proposta no topo do canvas: qual Proposta está na tela, qual é a ativa e quais foram descartadas.

## Use
Pill flutuante em `elevada` com borda `borda` e `sombra-2`, canto `raio-painel`. A aba selecionada fica em `superficie-3` com peso 600; a Proposta ativa leva um ponto `acento`; a descartada fica riscada em `tinta-3`. "Nova" fica ao lado, no mesmo estilo.

## O consumidor fornece
As `propostas` (id, nome, estado, descrição para a dica), a `selecionada`, `aoSelecionar` e, para mostrar "Nova", `aoCriar`.

## Acessibilidade
É uma `tablist`: só a aba selecionada entra no Tab; setas, Home e End trocam de aba e levam o foco junto. O estado (ativa, descartada) é dito ao leitor de tela, não só mostrado.

## Não
Não use as abas para navegar entre páginas; elas trocam a Proposta dentro do mesmo Protótipo.
