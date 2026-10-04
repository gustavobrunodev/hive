O campo onde a pessoa conversa com o agente: texto, Dores citadas, anexos, agente e modelo, voz e enviar.

## Use
- **`tamanho="inicio"`**: no Início, centralizado em `inicio-max`, canto `raio-xl`, `sombra-2`, texto em `body-lead`. Placeholder: "Descreva o que você quer criar ou melhorar. Cole prints, cite Dores com @…".
- **`tamanho="compacto"`**: no pé da conversa, canto `raio-l`, `sombra-1`. Placeholder padrão: "Peça uma mudança, cite uma Dor com @…".

## Anatomia
1. Linha de contexto acima do texto: um `ChipDeDor` por Dor citada.
2. `textarea` sem borda, com rótulo para leitor de tela ("Mensagem para o agente").
3. Barra: `+` para anexar, os `seletores` (Protótipo), espaço, o seletor de `agente`, microfone e `BotaoEnviar`.

## O consumidor fornece
O texto controlado (`valor`/`aoMudar`), as `citacoes` e o que fazer ao remover cada uma, os seletores (use `Seletor`) e `aoEnviar`. Enter envia; Shift+Enter quebra a linha. Gravando, o microfone vira `critico` cheio e se anuncia "Parar de gravar".

## Não
Enviar fica desabilitado enquanto não houver texto nem Dor citada.
