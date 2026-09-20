# Harness: o que guia e o que mede

Índice:
1. As duas acepções de "harness"
2. Guias e sensores
3. AGENTS.md mínimo
4. CONTEXT.md / context map
5. Validação visual com Playwright MCP
6. Sensores: o que instalar, em que ordem
7. Auditar o próprio harness
8. Escolher a ferramenta (o harness que você não controla)

---

## 1. As duas acepções de "harness"

A palavra virou guarda-chuva. Separe antes de responder, senão a conversa não fecha:

| Acepção | O que é | Seu controle |
|---|---|---|
| **Harness-ferramenta** | Cursor, Claude Code, Codex, OpenCode… o loop que chama o modelo, gerencia contexto, expõe tools | Quase nenhum. Você confia no fabricante |
| **Harness-projeto** | O que você adiciona em volta: `AGENTS.md`, skills, MCPs, estrutura do código, testes, lint, CI, hooks | Todo |

Esta seção trata da segunda. A primeira está no item 8.

---

## 2. Guias e sensores

A decomposição mais útil do harness-projeto. Toda peça é uma das duas — e a pergunta de
diagnóstico é sempre "isso guia ou isso mede?".

| | **Guias** (direcionam) | **Sensores** (dão feedback) |
|---|---|---|
| Exemplos | `AGENTS.md`, skills, `CONTEXT.md`, ADRs, **a própria estrutura do código** | testes, lint, typecheck, CI, observabilidade, hooks, Playwright MCP |
| Natureza | não-determinística | **determinística** |
| Falha típica | excesso: instrução que o modelo descobriria sozinho | ausência: nada contra o que o agente possa se medir |

**O melhor guia é o código.** Um código bem estruturado, com padrão consistente, é
entendido sem você escrever nada — e não custa token. Quando o mesmo padrão já se repete o
suficiente no repo, a regra correspondente pode sair do `AGENTS.md`: o código virou o
exemplo.

**Sensor é o que fecha o loop.** Sem feedback determinístico o agente assume que acertou —
não por má fé, mas porque não tem como saber. É por isso que boa arquitetura, bom teste e
bom lint deixaram de ser higiene e viraram infraestrutura de produtividade com IA: o agente
acha as coisas mais rápido (menos token) e sabe quando errou (menos retrabalho).

**Corolário para legado:** num repo sem teste, sem lint, sem tipo, nenhuma metodologia
funciona — não há o que verificar. Sensores vêm antes de framework, sempre.

---

## 3. AGENTS.md mínimo

`AGENTS.md` (ou `CLAUDE.md`) é carregado em **todo** turno. Custa token sempre e compete por
atenção com o resto do contexto. O critério de entrada é único:

> **Só entra o que o modelo não descobriria sozinho.**

Modelos atuais são muito bons em usar ferramenta — acham a skill certa, chamam o MCP certo,
leem o código. Não instrua o óbvio.

**O que tipicamente merece entrar:**

- **Estratégia de teste por camada**, quando não é inferível. Exemplo real: *service* tem
  teste unitário porque concentra lógica de domínio; *rota e banco* são testados
  indiretamente por integração; *repositório* isolado não prova nada; *web* não tem teste
  unitário — é coberto por validação visual.
- **Regras de arquitetura** que o código ainda não demonstra sozinho.
- **Gatilhos de processo**: "ao fim de toda implementação que toca tela, validar com o
  Playwright MCP"; "ao concluir um item do roadmap, marcá-lo como feito".
- **Comandos do projeto** que não são descobríveis (build, test, migração).

**O que tende a sair com o tempo:**

- Convenção de dependência/injeção já repetida em dezenas de arquivos — o código ensina.
- Explicação de framework popular. O modelo conhece.
- Instrução genérica de qualidade ("escreva código limpo", "não quebre testes").

Faça isso **devagar e medindo** — ver item 7.

---

## 4. CONTEXT.md / context map

Um arquivo que define o vocabulário do domínio: o que é um item, um catálogo, uma unidade,
um *warehouse*, um estoque. E — tão importante quanto — **o que cada coisa não é**.

Exemplo do formato que funciona:

> **Warehouse** — onde itens e quantidades vivem.
> Estoque **não** vive no catálogo; vive na warehouse.

Dois motivos pelos quais isso paga:

1. **O agente para de redescobrir o domínio** a cada sessão. Sem isso ele reinventa a
   fronteira entre conceitos e cada feature sai com um entendimento levemente diferente.
2. **As negativas viram regra de arquitetura checável.** "Estoque não mora no catálogo" é
   exatamente o tipo de invariante que uma lente de review de arquitetura consegue cobrar.

Mantenha vivo: toda vez que um conceito novo entra no domínio, ele entra aqui. Dá para
amarrar isso a uma regra no `AGENTS.md` ou a uma skill de manutenção do mapa.

Diferença para `AGENTS.md`: `AGENTS.md` é sempre carregado; o context map pode ser
carregado sob demanda quando a feature toca aquele domínio. Em repo grande, prefira sob
demanda.

---

## 5. Validação visual com Playwright MCP

**O fato que sustenta a prática:** modelos são muito bons interpretando uma imagem e muito
ruins julgando algo visual **sem** a imagem. Peça um componente a partir de descrição e o
resultado não chega perto; mande um print e ele se aproxima muito. Sem ver o resultado, o
agente assume que ficou bom — e te entrega essa suposição como fato.

**A prática:** regra no `AGENTS.md` mandando o agente abrir a aplicação com o Playwright MCP
ao fim de qualquer mudança que toque tela, navegar pelo fluxo alterado e conferir. A partir
daí toda sessão herda a regra.

**Por que MCP e não o browser embutido da ferramenta:** o MCP é portável. Se o time usa
ferramentas diferentes, ou se você troca de ferramenta, a regra continua valendo. Se todo
mundo usa a mesma ferramenta e o browser nativo funciona bem, usar o nativo é legítimo.

**A distinção que quase todo mundo erra:**

| | Validação visual no loop | Teste E2E |
|---|---|---|
| Quando roda | ao fim de cada implementação | na suíte, no CI |
| Custo | alguns tokens | alto: lento, flaky, manutenção cara |
| O que dá | o agente **viu** o que fez | regressão garantida ao longo do tempo |
| Recomendação | faça sempre que tocar tela | seja seletivo — fluxos críticos (caminhos felizes principais), não tudo |

Manter uma suíte E2E grande é caro e frágil; é uma decisão de engenharia separada. Usar
Playwright como **prova de trabalho no loop** é barato perto do retrabalho que evita.
Não confunda um com o outro na resposta.

---

## 6. Sensores: o que instalar, em que ordem

Num repo que está começando ou é legado, esta é a ordem de retorno:

1. **Test runner que roda rápido e um comando único.** Se rodar teste é difícil, o agente
   não roda.
2. **Typecheck.** Feedback mais barato que existe por bug encontrado.
3. **Lint/format com autofix.** Elimina uma classe inteira de ruído em review.
4. **CI** que roda os três. Transforma "eu rodei aqui" em fato verificável.
5. **Hooks de pre-commit** para o que precisa ser bloqueado antes de entrar.
6. **Validação visual**, se há interface.
7. **Observabilidade**, quando o comportamento em produção é a fonte de verdade.

Tudo isso já era boa engenharia antes da IA. A diferença é que agora cada sensor também é
**um canal de feedback para o agente** — o retorno dobrou.

---

## 7. Auditar o próprio harness

O problema real de quem já tem harness: ele envelhece. Modelo novo torna redundante metade
das instruções, e ninguém tira nada porque tirar dá medo. Duas ferramentas abertas:

### `harness-eval` (skill)
https://agent-skills.techleads.club/skills/harness-eval

Três trilhas, de confiança decrescente:

| Trilha | Pergunta | Certeza | Custo |
|---|---|---|---|
| **A — Correção** (sempre roda) | Os caminhos e comandos citados no `AGENTS.md` existem? Os arquivos linkados existem? | Máxima — script determinístico | ~0 tokens |
| **B — Redundância** (opcional) | O agente redescobriria isso sozinho? | Média — dois juízes LLM + testes-armadilha plantados | Alto |
| **C — Utilidade** (opcional) | Muda comportamento de fato, ou só parece bom? | Baixa/subjetiva | Máximo |

Desenho que vale copiar: **duplo juiz cego.** Juiz 1 pontua; Juiz 2 avalia sem ver a nota do
Juiz 1 nem o gabarito das armadilhas; o merge compara e decide Ship/Review/Hold.

Duas ressalvas que mudam como você usa o resultado:

- **Redundância ≠ inutilidade.** Algo pode ser redescoberto e ainda valer a pena estar
  escrito — se a redescoberta custa tokens toda sessão, a instrução se paga.
- **A trilha C é sensível ao modelo.** Rode com o modelo que você usa no dia a dia, registre
  qual foi, e antes de deletar em lote re-julgue num segundo modelo. **Delete seguro é a
  interseção.**

### `harness-score` (CLI)
https://github.com/paladini/harness-score

Avalia a estrutura: existem guias, skills, documentos; estão nos lugares certos; rodando em
múltiplos repositórios. Bom como primeiro retrato.

**Ordem sugerida:** `harness-score` para o retrato estrutural → `harness-eval` trilha A para
consertar o que está quebrado → trilhas B/C para decidir o que cortar. **Corte devagar.**

---

## 8. Escolher a ferramenta (o harness que você não controla)

A ferramenta interfere pesado no resultado — mesmo modelo, harness ruim, saída pior e conta
maior. Um harness mal feito gasta mais token para o mesmo trabalho: carrega contexto demais,
repete chamada, gerencia mal a janela.

Critério prático: prefira ferramenta conhecida e com manutenção ativa (Cursor, Claude Code,
Codex, OpenCode e similares). Desconfie de harness aleatório baixado só porque promete rodar
modelo open-source de graça — a economia no modelo costuma voltar como desperdício de token.

Se a resposta envolver recomendar ferramenta, seja explícito: o que muda entre elas, hoje, é
mais o gerenciamento de contexto e o ecossistema (skills, MCPs, subagentes) do que o modelo —
o modelo você escolhe dentro delas.
