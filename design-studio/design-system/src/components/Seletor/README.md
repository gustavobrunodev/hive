Pill de 34px que abre um menu de escolha no campo do chat: agente e modelo, Protótipo.

## Use
Para escolhas que mudam o contexto do que vai ser enviado (com qual agente, em qual Protótipo). Fundo `superficie-2`, borda `borda`, ícone em `tinta-2`, canto `raio-pill`. O complemento ("· Câmbio", "Sonnet") fica em `tinta-3`.

## O consumidor fornece
O `valor`, o `complemento`, um `icone` ou o `agente` (que troca o ícone pela `LogoDoAgente`) e o estado `aberto` do menu. O menu em si é do consumidor: use `elevada` e `sombra-3`. A ref vai para o `<button>`, então o seletor serve de gatilho de popover.

## Não
Não use o seletor para ações; ação é `Botao`.
