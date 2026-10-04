# CampoDoChat

O campo onde a pessoa conversa com o agente: texto, Dores citadas, anexos, agente e modelo, voz e enviar.

## Use
No Início, centralizado em 780px e grande (canto `raio-xl`, `sombra-2`, texto em `body-lead`). Na vista de trabalho, compacto (canto `raio-l`, `sombra-1`) no pé da conversa.

## Anatomia
1. Linha de contexto acima do texto: `chip-dor` de cada Dor citada e os anexos.
2. `textarea` sem borda. Placeholder no Início: "Descreva o que você quer criar ou melhorar. Cole prints, cite Dores com @…"; na vista de trabalho: "Peça uma mudança, cite uma Dor com @…".
3. Barra: `+` para anexar, `Seletor` de agente/modelo e de Protótipo, microfone, `cmp-enviar`.

## O consumidor fornece
O texto, as Dores citadas e os anexos; o agente e o modelo escolhidos. Gravando, o microfone vira `critico` cheio e a onda é desenhada em barras de 3px em `acento`.

## Não
Enviar fica desabilitado enquanto não houver texto nem Dor citada.
