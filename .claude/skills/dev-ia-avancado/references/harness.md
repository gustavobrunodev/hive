# Harness: o que guia, mede e impede

Índice:
1. As duas acepções de "harness"
2. Guias, sensores e gates
3. AGENTS.md mínimo
4. CONTEXT.md / context map
5. Validação visual com Playwright MCP
6. Sensores e gates: o que instalar, em que ordem
7. Auditar o próprio harness
8. Escolher a ferramenta (o harness que você não controla)

---

## 1. As duas acepções de "harness"

A palavra virou guarda-chuva. Separe antes de responder, senão a conversa não fecha:

| Acepção | O que é | Seu controle |
|---|---|---|
| **Harness-ferramenta** | Cursor, Claude Code, Codex, OpenCode… o loop que chama o modelo, gerencia contexto, expõe tools | Quase nenhum. Você confia no fabricante |
| **Harness-projeto** | O que você adiciona em volta: `AGENTS.md`, skills, MCPs, estrutura do código, testes, lint, CI, hooks e gates | Todo |

Esta seção trata principalmente da segunda. O Harness Toolkit fica na fronteira: usa hooks
que o harness-ferramenta expõe, mas runtime, política e estado são controles que você opera.
Ao comparar soluções, separe **capacidade do provider** de **política implementada sobre ela**.
A primeira acepção volta no item 8.

---

## 2. Guias, sensores e gates

A sessão 3 acrescenta uma distinção operacional à decomposição original. Um gate é, em
essência, um sensor ligado a um atuador; separá-lo na tabela deixa visível a diferença entre
apenas observar e realmente impedir. Diagnostique cada peça perguntando: **isso orienta,
observa ou impede?**

| | **Guias** | **Sensores** | **Gates** |
|---|---|---|---|
| Função | orientar antes | medir e devolver evidência | permitir, pedir ou negar uma ação |
| Exemplos | `AGENTS.md`, skills, `CONTEXT.md`, ADRs, estrutura do código | testes, lint, typecheck, observabilidade, Playwright MCP | handler de hook, branch protection, CI obrigatório, pre-commit/pre-push |
| Natureza | não-determinística: o modelo interpreta | prefira comando objetivo; inspeção visual ainda envolve julgamento | determinística quando a decisão vive em código fora do modelo |
| Falha típica | excesso e falsa sensação de controle | existe, mas ninguém o roda ou reage à falha | bloqueio amplo demais, bypass ou política editável pelo supervisionado |

**O melhor guia é o código.** Um código bem estruturado, com padrão consistente, é
entendido sem você escrever nada — e não custa token. Quando o mesmo padrão já se repete o
suficiente no repo, a regra correspondente pode sair do `AGENTS.md`: o código virou o
exemplo.

**Sensor dá o sinal; gate fecha o loop.** Sem feedback determinístico o agente assume que
acertou —
não por má fé, mas porque não tem como saber. É por isso que boa arquitetura, bom teste e
bom lint deixaram de ser higiene e viraram infraestrutura de produtividade com IA: o agente
acha as coisas mais rápido (menos token) e sabe quando errou (menos retrabalho).

Um teste instalado mas nunca rodado é um sensor desconectado. Um teste rodado ao fim do
turno, cuja falha devolve o agente ao trabalho, vira parte de um gate. E **hook não é sinônimo
de proteção**: hook é só o ponto de interceptação que o editor oferece; o handler e sua
política é que decidem.

**Corolário para legado:** num repo sem teste, sem lint, sem tipo, nenhuma metodologia
funciona — não há o que verificar. Sensores vêm antes de framework, sempre.

### Autonomia muda a camada do problema

**posição da TLC:** "dar autonomia a um agente é decisão de arquitetura, não de prompt".
Prompt é conversa: continua sendo um pedido, por mais enfático que seja. Quando a ação pode
ter efeito que não se desfaz sozinho, a fronteira precisa existir fora da janela do modelo.

As quatro superfícies mostradas na aula:

| Superfície | Exemplos de falha estrutural |
|---|---|
| **Shell** | apagar fora do projeto, executar conteúdo remoto não inspecionado, vazar credencial para o transcript |
| **Arquivos** | remover teste para o gate passar, reescrever política ou estado do próprio harness |
| **Git** | `push --force`, publicar sem review/evidência |
| **Subagentes** | spawnar modelo não permitido, herdar limites incorretos, entrar em cascata ou loop caro |

Modelo melhor reduz frequência de erro; não remove a superfície. A pergunta de arquitetura é:
*o que existe entre a proposta e o efeito quando o erro finalmente ocorrer?*

### Hooks como plano de execução

O fluxo genérico é:

```text
evento do editor → adaptador do provider → política determinística → allow | ask | deny | contexto
```

- **`allow`** deixa a ação seguir.
- **`ask`** sobe uma decisão ao humano.
- **`deny`** bloqueia e explica ao agente por que e qual rota segura existe.
- **contexto injetado** orienta retry, handoff ou próximo turno sem fingir que bloqueou.

No Harness Toolkit, se um editor não consegue expressar `ask`, a decisão degrada para
`deny`. O princípio é **fail closed**: incapacidade do host não vira aprovação silenciosa.

A garantia mais forte vem da ordem de execução. O **floor** roda antes de ler configuração;
logo, a configuração não consegue desligá-lo. A superfície que contém política, estado e
wiring também é protegida de escrita pelo próprio agente. Do contrário, o supervisionado
pode desligar o supervisor.

Um desenho portável separa a decisão dos dialetos de editor: core e contratos não conhecem
Cursor, Claude Code ou outro fornecedor; adaptadores traduzem payload e resposta. No toolkit,
essa direção de dependência é checada no build. O padrão transferível é: suportar um novo
provider deve exigir um adaptador, não uma segunda política divergente.

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

## 6. Sensores e gates: o que instalar, em que ordem

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

### Quando promover um sensor a gate

Use a consequência, não a ansiedade, como régua:

| Situação | Camada suficiente |
|---|---|
| preferência de estilo ou caminho recomendado | guia |
| erro reversível que precisa aparecer | sensor + feedback |
| afirmação de pronto sem prova | gate de saída: só encerrar com evidência recente |
| ação destrutiva, vazamento ou corrupção de política | gate antes da ação |
| ambiguidade que muda materialmente o resultado | `ask` depois de esgotar fontes |

O gate deve negar a **cauda destrutiva**, não a família inteira de comandos. Bloquear leitura
de `.env` mas permitir `grep` pelo endereço literal; negar `push --force` mas permitir
`--force-with-lease`; negar pipe de rede para shell mas permitir baixar sem executar são
exemplos da aula. Segurança que interrompe o caminho legítimo toda hora não sobrevive ao uso.

### Floor, sempre ativo e rails

O Harness Toolkit organiza controles por autoridade, não só por categoria:

| Camada | Pode desligar por config? | Papel |
|---|---:|---|
| **Floor** | não | intercepta riscos básicos antes de a política ser lida |
| **Sempre ativo** | não | detecta integridade da própria política e colisão de sessão |
| **Rails** | sim | aplica escolhas do time e do projeto, com benefício e custo explícitos |

No snapshot verificado em 22/set/2026, o floor público lista oito regras: destruição fora do
projeto, destruição cujo alvo não pode ser provado, acesso a segredo, reescrita de histórico,
controle da máquina, execução remota não inspecionável, escrita na superfície de política e
adulteração do wiring. O Tier 2 acrescenta divergência de baseline da política, escrita via
tools nessa superfície e colisão de edição entre sessões. Consulte o catálogo atual antes de
citar contagens — o produto está evoluindo.

Os rails cobrem, entre outros: rodar lint/test e devolver o agente ao trabalho (**grind**),
provar uma declaração de pronto (**ship gate**), limitar comentários novos a *why*,
*invariant* ou *hazard*, detectar duplicação adicionada no turno, conferir supply chain,
restringir modelos de subagente, cortar repetição de shell, manter lessons/handoff, detectar
docs obsoletos, comparar plano com diff, aplicar regra custom do operador e mascarar segredo
na saída. Não presuma que todos devem estar ligados: cada um compra proteção com latência,
ruído e manutenção.

O loop de retry também precisa de saída. Na demonstração, repetição do mesmo fracasso por
três tentativas tirava o agente do ciclo. O número é configuração/snapshot; o princípio é
limitar repetição e escalar com o histórico da falha, em vez de reenviar o mesmo pedido.

### Governança que sobrevive à adoção

Ferramenta de governança que exige configurar tudo antes de entregar valor tende a não
passar da primeira semana. O desenho da aula oferece baseline útil logo após instalar e deixa
a política por repositório para quando o projeto pedir mais rigor. A política compartilhada
fica versionada com o código e muda por PR; runtime, handoff e observabilidade vivem no estado
do harness. Times com editores diferentes consomem a mesma intenção por adaptadores.

As posturas `paired`, `solo` e `focus` **não mudam o rigor**: mudam quanto sobe ao humano.
Gates, evidência e critérios de pronto permanecem iguais. Confundir autonomia com afrouxar
controle é exatamente o erro que essa separação evita.

Observabilidade precisa responder pelo menos: qual evento ocorreu, qual regra decidiu, qual
foi o veredito, que prova existia e quanto custou. No toolkit, `tlc harness doctor` inspeciona
instalação/política; `tlc harness obs report` mostra decisões e custo; `tlc harness attest`
encadeia o registro por hash. Cadeia de hash detecta reescrita; não prova autoria como
assinatura.

---

## 7. Auditar o próprio harness

Comece distinguindo **saúde do runtime** de **qualidade do harness do projeto**. Para o
Harness Toolkit, `tlc harness doctor` verifica wiring, comandos e rails mal configurados;
`obs report` mostra se as regras de fato dispararam. Isso não responde se o conjunto de
controles é suficiente ou vale o custo — aí entram as auditorias abaixo.

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

Quando a intenção inclui autonomia real, compare também a superfície de hooks: quais eventos
são interceptáveis, quais respostas o host entende (`allow`, `ask`, `deny`, contexto), como
ele trata fim de turno e subagentes, e se a falha fecha ou abre. Um controle que o editor não
consegue expressar não existe só porque está documentado.

Se a resposta envolver recomendar ferramenta, seja explícito: o que muda entre elas, hoje, é
mais o gerenciamento de contexto e o ecossistema (skills, MCPs, subagentes) do que o modelo —
o modelo você escolhe dentro delas.
