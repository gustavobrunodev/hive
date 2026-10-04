A resposta do agente na conversa: quem é, o que fez e o registro do que mudou.

## Use
- **Cabeçalho**: `LogoDoAgente`, nome em 600, modelo em chip `superficie-3` e hora em `tinta-3`.
- **Texto**: estilo `mensagem` (0.9375rem/1.6), parágrafos a 10px.
- **Carimbo**: pill `acento` com `sobre-acento` dizendo o que foi aplicado ("Aviso inserido · Variante 2").
- **Ações**: lista em `superficie-2` com marcas de confirmação em `ok-tinta`, uma linha por coisa que o agente fez e conferiu.
- **Ponto de restauração**: a linha em `tinta-3` no fim; com `aoAbrirPonto` vira botão.

## O consumidor fornece
Agente, modelo, hora, o texto e, quando houver mudança, o carimbo, as ações e o Ponto de restauração. A mensagem é um `article` nomeado pelo agente e pela hora.

## Não
Nada de jargão técnico (git, MCP, checkpoint): o agente fala em Protótipo, Proposta, tela e Variante.
