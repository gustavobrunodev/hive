# MensagemDoAgente

A resposta do agente na conversa: quem é, o que fez e o registro do que mudou.

## Use
- **Cabeçalho** (`msg-cab`): `LogoDoAgente`, nome em 600, modelo em chip (`msg-modelo`) e hora em `tinta-3`.
- **Texto** (`msg-texto`): estilo `mensagem` (0.9375rem/1.6), parágrafos a 10px.
- **Carimbo** (`carimbo`): pill `acento` com `sobre-acento` dizendo o que foi aplicado ("Aviso inserido · Variante 2").
- **Ações** (`acoes-agente`): lista em `superficie-2` com marcas de confirmação, uma linha por coisa que o agente fez e conferiu.
- Abaixo, a linha do Ponto de restauração.

## O consumidor fornece
Agente, modelo, hora, o texto e, quando houver mudança, o carimbo e as ações.

## Não
Nada de jargão técnico (git, MCP, checkpoint): o agente fala em Protótipo, Proposta, tela e Variante.
