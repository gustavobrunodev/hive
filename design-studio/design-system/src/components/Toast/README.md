Aviso curto e invertido que confirma o que acabou de acontecer e some em seguida.

## Use
Depois de uma ação que muda o Protótipo ("Elemento inserido · Ponto de restauração criado", "Variantes descartadas. Nada mudou."). Fundo `toast`, texto `sobre-toast`, ícone em `acento`, canto `raio-pill`, `sombra-3`; é um `status`, então o texto é anunciado. Na vista de trabalho fica centrado no canvas, acima das ferramentas; nas outras, no canto inferior direito.

## O consumidor fornece
O texto, o ícone quando não for confirmação (`info`, `alerta`), a posição e o tempo: o app mostra por 3s, marca `saindo` e remove 0.4s depois.

## Não
Um aviso por vez: ao trocar de vista, os anteriores saem.
