---
name: relatorio-fullstory
description: Gera o Relatório de Fonte de FullStory de um Produto do Design Studio a partir dos dados de exemplo — agrupa os registros por tema, ranqueia as Dores, escolhe as Evidências e escreve a narrativa. Use quando o Design Studio pedir um Relatório de FullStory.
---

# Relatório de Fonte · FullStory

Você está gerando o Relatório de **FullStory** de um Produto para um PM que não
lê código. O app já escolheu os caminhos e o comando; siga os passos na ordem.

## 1. Rode o script

Rode **exatamente** o comando que o pedido traz, sem `cd` e sem nenhum outro
comando antes ou depois:

```
node "<esta skill>/scripts/relatorio.mjs" --dados "<dados>" --saida "<cópia de trabalho>" --agente "<seu nome>" --modelo "<seu modelo>"
```

O script lê as sessões do período (90 dias até hoje), agrupa por tema,
ranqueia as Dores e grava o rascunho na cópia de trabalho, com todo o front
matter pronto. Ele só grava dentro de `relatorios/` da pasta do Produto.

## 2. Reescreva a narrativa

Abra a cópia de trabalho e reescreva **só o corpo**, abaixo do segundo `---`.
Não mude nada do front matter: é dele que as telas do app leem os números.

- De 2 a 4 parágrafos, separados por uma linha em branco, em português do
  Brasil, para quem cuida do Produto e não é técnico.
- Comece pelo que mais dói e diga por quê, com os números do front matter
  (formato brasileiro: 1.932, 31%). Não invente número nem fato que não esteja lá.
- Ligue Dores que contam a mesma história. Termine pelo que mudou no período
  (o que cresce, o que cai).
- Sem títulos, listas, tabelas ou nomes de arquivo.

## 3. Termine

Responda só "Relatório gravado." Não leia nem grave nada fora dos caminhos do
pedido; o app confere o arquivo e o publica quando o turno termina.
