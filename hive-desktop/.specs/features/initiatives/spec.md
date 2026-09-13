---
title: Iniciativas — as demandas do workspace na aba Chat & Cowork
type: feature
created: 2026-09-10
status: complete
baseline_commit: 36a34fe5d7f25da448792d81350990bfe1547023
review_loop_iteration: 0
---

<frozen-after-approval reason="escopo definido pelo pedido do usuário (transcrição da foto anexada)">

## Intent

**Problema:** o trabalho do time é organizado por **demanda**, e o Hive não
tinha onde dizer isso. A conversa, os artefatos que o BMAD produz e o
andamento do fluxo viviam em três lugares sem ligação: o histórico de
conversas, o explorador de arquivos e a cabeça de quem estava conduzindo. Não
havia como responder "em que pé está esta demanda e qual é a próxima etapa"
sem abrir pastas e ler nomes de arquivo.

**Abordagem:** uma seção **Iniciativas** acima do histórico da conversa, com a
hierarquia `Iniciativas → Ano → Release (R1–R4) → Nome da demanda`. Clicar numa
demanda abre uma seção no lugar da conversa — **com o chat embutido** — e, na
lateral direita, os arquivos de contexto daquela demanda (o mesmo núcleo do
gerenciador de arquivos, enraizado na pasta) mais uma **visão do fluxo BMAD**
que diz o que já foi feito, qual é a próxima etapa e permite iniciar cada uma.
A aba passa a se chamar **Chat & Cowork**. Referência de experiência: os
projetos do Claude Desktop.

## Boundaries & Constraints

**Sempre:** a pasta é a iniciativa — `docs/iniciativas/<release>/<demanda>/`,
espelhando o workspace, sem banco paralelo. Reutilizar `@hive/design-system` e
o `FileTree` do explorador; copy via `t()`; o BMAD continua sendo a fonte da
verdade dos workflows (orquestramos, não reimplementamos).

**Consultar antes:** mudar o formato das pastas em disco ou o conjunto de
etapas do fluxo.

**Nunca:** inventar um status de etapa armazenado em paralelo aos arquivos;
criar um segundo gerenciador de arquivos; deixar uma etapa gravar fora da pasta
da demanda.

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Resultado | Tratamento |
| --- | --- | --- | --- |
| Primeiro uso | Sem `docs/iniciativas/` | Convite para criar a primeira | `listTree` lança; é "nenhuma ainda", não falha |
| Sem manifesto | Pasta criada à mão ou pelo BMAD | Nome lido do slug, ano corrente | Manifesto é opcional |
| Manifesto | `iniciativa.json` presente | Título com acento e ano próprios | Campo ruim custa o campo, nunca a pasta |
| Release fora do padrão | `hotfix/` ao lado de `R2/` | Aparece, depois das numeradas | Ordena, não filtra |
| R10 | `R10` ao lado de `R9` | R9 antes de R10 | Ordem numérica, não alfabética |
| Etapa fora de ordem | `arquitetura.md` sem PRD | Arquitetura concluída, pesquisa é a próxima | Uma só etapa é "a próxima" |
| Idioma do artefato | `prd.md` ou `architecture.md`/`arquitetura.md` | Ambos contam | Padrões nos dois idiomas |
| Nome duplicado | Demanda que já existe na release | Recusa com motivo | `exists` antes de `createDirectory` |
| Nome sem letras | `!!!` | Recusa com motivo | Slug vazio é erro de formulário |
| Ferramenta do chat aberta | Revisão/Bases sobre o transcrito | A lateral da demanda sai da tela | Ela vive ao lado do chat, não de um painel |
| Reinício | App fechado dentro de uma demanda | Reabre nela | Persistido como caminho, relido do disco |

</frozen-after-approval>

## Code Map

- `src/renderer/src/initiatives/initiatives.ts`: o modelo — leitura da árvore,
  agrupamento por ano/release, slug, manifesto.
- `src/renderer/src/initiatives/initiativeStages.ts`: as sete etapas do BMAD, a
  detecção por artefato e o `RoleAction` que lança uma etapa na pasta certa.
- `src/renderer/src/initiatives/useInitiatives.ts`: a leitura viva do disco
  (walk + manifestos + watcher) e a criação.
- `src/renderer/src/initiatives/useOpenInitiative.ts`: o estado da demanda
  aberta, fora do `WorkUI` por causa do teto de complexidade dele.
- `src/renderer/src/initiatives/{InitiativesPanel,InitiativeContext,NewInitiativeDialog}.tsx`:
  a seção na lateral, o trilho da demanda e o formulário.
- `src/renderer/src/WorkUI.tsx` + `chat/ChatSidebar.tsx`: a fiação.
- `design-system/src/components/StageTracker/`: o componente novo — um trilho de
  etapas **acionável** (o `StepFlow` existente é, por construção, inerte).
- `e2e/initiatives.spec.ts`, `tools/visual/initiatives{,-contrast}.mjs`,
  `src/renderer/src/initiatives/initiativesLive.e2e.test.ts`: as três validações.

## Tasks & Acceptance

- [x] Renomear a aba para **Chat & Cowork**.
- [x] Modelo das iniciativas a partir da árvore de `docs/iniciativas/`.
- [x] Seção na lateral, acima do histórico, com a hierarquia pedida.
- [x] Demanda aberta no lugar da conversa, com o chat embutido.
- [x] Contexto pelo mesmo `FileTree`, enraizado na pasta da demanda.
- [x] Visão do fluxo BMAD com status, próxima etapa e atalho para iniciar.
- [x] Botão de criar nova iniciativa dentro da seção.
- [x] Componente novo no design system onde o existente não servia.
- [x] Testes, passe visual nos três temas, E2E no Electron real e validação com
      o CLI real do Claude.

**Critérios:**

- Dada uma pasta `docs/iniciativas/R2/<demanda>/` no disco, ao abrir a aba
  Chat & Cowork, então a demanda aparece sob seu ano e sua release.
- Dada uma demanda com `prd.md`, ao abri-la, então PRD consta como concluída,
  Arquitetura como a próxima, e o transcrito continua na tela ao lado.
- Dado o trilho, ao iniciar uma etapa, então o turno lançado carrega a pasta da
  demanda e o agente trabalha dentro dela.
- Dado "Nova iniciativa", ao confirmar, então a pasta e o manifesto existem no
  disco e a demanda já está aberta.
- Dada uma demanda aberta, ao fechar e reabrir o app, então ela volta.

## Design Notes

**O trilho fica em cima e a árvore embaixo, os dois visíveis.** Eles respondem
as duas metades da mesma pergunta — o plano diz *onde você está*, os arquivos
dizem *o que aquilo produziu* — e o plano só é confiável porque é derivado da
pasta, o que só vale alguma coisa se der para conferir um contra o outro sem
trocar de aba.

**Um `Chat` só.** A demanda não monta um segundo transcrito: ela abre um trilho
ao lado do que já está lá. Abrir e fechar uma demanda não derruba a sessão viva.

## Verification

Registro em `.specs/project/STATE.md` (seção "Iniciativas, 2026-09-10").
