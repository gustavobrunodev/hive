A barra lateral do app: marca, Nova conversa, navegação, Recentes, tema, conta e o selo de exemplo.

## Use
264px aberta (`lat-w`), 68px recolhida (`lat-recolhida`, só ícones, nomes mantidos para leitor de tela). Fundo `superficie` com divisória `borda` à direita. A lateral ocupa a altura do contêiner: dê a ela um pai com altura.

## Anatomia
- Topo: `Marca` e o botão de recolher (`aoRecolher`).
- Nova conversa: botão com borda e `sombra-1`.
- Itens: Geist 500 em `tinta-2`, canto `raio-m`, hover `superficie-2`. O item atual leva `aria-current="page"`, fundo `acento-suave`, ícone em `acento-tinta` e peso 600.
- Recentes: ícone em quadrado de 28px, título e Produto; somem na lateral recolhida.
- Rodapé: alternador de tema (`Segmentado` pill), Configurações, conta e `SeloExemplo`.

## O consumidor fornece
Os `itens`, o `atual`, `aoNavegar` (ou `href` em cada item), os `recentes`, o `tema` e `aoMudarTema`, a `conta`. Item com `href` vira link; sem ele, botão.

## Não
Um só item atual por vez. Rótulos de seção em `label`, nunca caixa-alta.
