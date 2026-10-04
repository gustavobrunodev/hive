# Lateral

A barra lateral do app: marca, Novo, navegação, Recentes, selo de exemplo, tema e conta.

## Use
264px aberta (`lat-w`), 68px recolhida (só ícones); no celular vira uma barra de ícones no topo. Fundo `superficie` com divisória `borda` à direita.

## Anatomia
- Marca: o sinal (asset `Marca/sinal.svg`) e "Design Studio" em Bricolage 700.
- Itens (`lat-item`): Geist 500 em `tinta-2`, canto `raio-m`, hover `superficie-2`. O item atual leva `aria-current="page"`, fundo `acento-suave`, ícone em `acento-tinta` e peso 600.
- Recentes: ícone em quadrado de 28px, título e Produto.
- Rodapé: `SeloExemplo`, alternador de tema (`Segmentado`) e a conta.

## Não
Um só item atual por vez. Rótulos de seção em `label`, nunca caixa-alta.
